using KBYTE.Data;
using KBYTE.DTOs;
using KBYTE.Models;
using KBYTE.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ImportController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ImportController(ApplicationDbContext context)
        {
            _context = context;
        }

        // 1. AŞAMA: Sadece okur ve rapor verir. Veritabanına HİÇBİR ŞEY yazmaz.
        [HttpPost("analyze")]
        public async Task<IActionResult> Analyze([FromBody] ImportAnalyzeDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Csv))
                return BadRequest(new { message = "CSV içeriği boş." });

            var parsed = CsvParser.Parse(dto.Csv);
            var preview = await BuildPreviewAsync(parsed);

            return Ok(preview);
        }

        // 2. AŞAMA: Kullanıcı önizlemeyi onayladıktan sonra yazar.
        // CSV baştan tekrar parse edilir — istemciden gelen satırlara güvenilmez.
        [HttpPost("commit")]
        public async Task<IActionResult> Commit([FromBody] ImportCommitDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Csv))
                return BadRequest(new { message = "CSV içeriği boş." });

            var parsed = CsvParser.Parse(dto.Csv);

            if (parsed.Errors.Count > 0)
                return BadRequest(new { message = "Dosyada hatalı satırlar var. Önce önizlemeyi kontrol edin." });

            if (parsed.Rows.Count == 0)
                return BadRequest(new { message = "İçe aktarılacak satır yok." });

            var assets = await _context.Assets.ToListAsync();
            var assetsByTicker = assets.ToDictionary(a => a.Ticker, StringComparer.OrdinalIgnoreCase);

            var banks = await _context.BankAccounts.ToListAsync();
            var banksByName = banks.ToDictionary(b => b.Name, StringComparer.OrdinalIgnoreCase);

            // Her şey tek transaction içinde: ya hepsi yazılır ya hiçbiri.
            await using var tx = await _context.Database.BeginTransactionAsync();

            try
            {
                var createdAssets = 0;

                // Kullanıcının cevapladığı bilinmeyen ticker'ları çöz
                foreach (var answer in dto.NewAssets)
                {
                    if (string.IsNullOrWhiteSpace(answer.Ticker)) continue;
                    if (assetsByTicker.ContainsKey(answer.Ticker)) continue;

                    if (answer.MapToAssetId.HasValue)
                    {
                        // Mevcut bir varlığa eşle (takma ad durumu)
                        var existing = assets.FirstOrDefault(a => a.Id == answer.MapToAssetId.Value);
                        if (existing == null)
                            return BadRequest(new { message = $"'{answer.Ticker}' için seçilen varlık bulunamadı." });

                        assetsByTicker[answer.Ticker] = existing;
                    }
                    else
                    {
                        var newAsset = new Asset
                        {
                            Ticker = answer.Ticker,
                            Name = string.IsNullOrWhiteSpace(answer.Name) ? answer.Ticker : answer.Name!,
                            AssetCategory = string.IsNullOrWhiteSpace(answer.Category) ? "Diğer" : answer.Category!,
                            CurrentPrice = answer.CurrentPrice,
                            LastUpdated = DateTime.UtcNow
                        };

                        _context.Assets.Add(newAsset);
                        await _context.SaveChangesAsync();   // Id ataması için

                        assetsByTicker[newAsset.Ticker] = newAsset;
                        createdAssets++;
                    }
                }

                // Hâlâ çözülemeyen ticker var mı?
                var stillUnknown = parsed.Rows
                    .Where(r => r.Ticker != null && !assetsByTicker.ContainsKey(r.Ticker))
                    .Select(r => r.Ticker!)
                    .Distinct()
                    .ToList();

                if (stillUnknown.Count > 0)
                {
                    await tx.RollbackAsync();
                    return BadRequest(new
                    {
                        message = $"Şu varlıklar için cevap verilmedi: {string.Join(", ", stillUnknown)}"
                    });
                }

                var batch = new ImportBatch
                {
                    ImportedAt = DateTime.UtcNow,
                    FileName = dto.FileName,
                    RowCount = parsed.Rows.Count,
                    CreatedAssetCount = createdAssets
                };

                _context.ImportBatches.Add(batch);
                await _context.SaveChangesAsync();

                foreach (var row in parsed.Rows)
                {
                    int? assetId = null;
                    if (row.Ticker != null && assetsByTicker.TryGetValue(row.Ticker, out var asset))
                        assetId = asset.Id;

                    int? bankId = null;
                    if (row.BankName != null && banksByName.TryGetValue(row.BankName, out var bank))
                        bankId = bank.Id;

                    // NOT: İçe aktarma banka bakiyelerini DEĞİŞTİRMEZ.
                    // Geçmiş veri yüklemesidir; güncel borç Bankalar sayfasından elle girilir.
                    var transaction = new Transaction
                    {
                        TransactionDate = row.Date,
                        Type = row.Type,
                        AmountTRY = row.AmountTRY,
                        Description = row.Description,
                        AssetId = assetId,
                        Quantity = row.Quantity,
                        Direction = row.Direction,
                        UnitPrice = row.UnitPrice,
                        BankAccountId = bankId,
                        ImportBatchId = batch.Id
                    };

                    _context.Transactions.Add(transaction);
                }

                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                return Ok(new ImportResultDto
                {
                    BatchId = batch.Id,
                    ImportedRows = parsed.Rows.Count,
                    CreatedAssets = createdAssets,
                    Message = $"{parsed.Rows.Count} işlem içe aktarıldı."
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return StatusCode(500, new { message = "İçe aktarma başarısız: " + ex.Message });
            }
        }

        [HttpGet("batches")]
        public async Task<IActionResult> GetBatches()
        {
            var batches = await _context.ImportBatches
                .OrderByDescending(b => b.ImportedAt)
                .Select(b => new
                {
                    b.Id,
                    b.ImportedAt,
                    b.FileName,
                    b.RowCount,
                    b.CreatedAssetCount
                })
                .ToListAsync();

            return Ok(batches);
        }

        // GERİ AL: O partide gelen işlemleri siler. Yaratılan varlıklara dokunmaz.
        [HttpDelete("batch/{id}")]
        public async Task<IActionResult> UndoBatch(int id)
        {
            var batch = await _context.ImportBatches.FindAsync(id);
            if (batch == null)
                return NotFound(new { message = "İçe aktarma kaydı bulunamadı." });

            var transactions = await _context.Transactions
                .Where(t => t.ImportBatchId == id)
                .ToListAsync();

            _context.Transactions.RemoveRange(transactions);
            _context.ImportBatches.Remove(batch);
            await _context.SaveChangesAsync();

            return Ok(new { message = $"{transactions.Count} işlem geri alındı." });
        }

        // --- yardımcı ---

        private async Task<ImportPreviewDto> BuildPreviewAsync(ParseResult parsed)
        {
            var preview = new ImportPreviewDto
            {
                TotalRows = parsed.Rows.Count,
                IncomeRows = parsed.Rows.Count(r => r.Type == TransactionType.Income),
                ExpenseRows = parsed.Rows.Count(r => r.Type == TransactionType.Expense),
                InvestmentRows = parsed.Rows.Count(r => r.Type == TransactionType.Investment),
                CardExpenseRows = parsed.Rows.Count(r => r.Type == TransactionType.CardExpense),
                Warnings = parsed.Warnings,
                Errors = parsed.Errors
                    .Select(e => new RowErrorDto { LineNumber = e.LineNumber, Message = e.Message })
                    .ToList()
            };

            // Aylık toplamlar — kullanıcı kendi tablosuyla karşılaştırabilsin diye
            preview.Months = parsed.Rows
                .GroupBy(r => $"{r.Date.Year:D4}-{r.Date.Month:D2}")
                .OrderBy(g => g.Key)
                .Select(g =>
                {
                    var income = g.Where(r => r.Type == TransactionType.Income).Sum(r => r.AmountTRY);
                    var expense = g.Where(r => r.Type == TransactionType.Expense).Sum(r => r.AmountTRY);

                    var buys = g.Where(r => r.Type == TransactionType.Investment && r.Direction != TradeDirection.Sell)
                                .Sum(r => r.AmountTRY);
                    var sells = g.Where(r => r.Type == TransactionType.Investment && r.Direction == TradeDirection.Sell)
                                 .Sum(r => r.AmountTRY);
                    var investment = buys - sells;

                    var debt = g.Where(r => r.Type == TransactionType.CardExpense).Sum(r => r.AmountTRY);

                    return new MonthPreviewDto
                    {
                        Month = g.Key,
                        TotalIncome = income,
                        TotalExpense = expense,
                        TotalInvestment = investment,
                        TotalIncurredDebt = debt,
                        NetBalance = income - expense - investment,
                        RowCount = g.Count()
                    };
                })
                .ToList();

            // Bilinmeyen ticker'lar
            var tickers = parsed.Rows
                .Where(r => r.Ticker != null)
                .Select(r => r.Ticker!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (tickers.Count > 0)
            {
                var known = await _context.Assets
                    .Select(a => a.Ticker)
                    .ToListAsync();

                preview.UnknownTickers = tickers
                    .Where(t => !known.Contains(t, StringComparer.OrdinalIgnoreCase))
                    .ToList();
            }

            // Bilinmeyen bankalar
            var bankNames = parsed.Rows
                .Where(r => r.BankName != null)
                .Select(r => r.BankName!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (bankNames.Count > 0)
            {
                var knownBanks = await _context.BankAccounts
                    .Select(b => b.Name)
                    .ToListAsync();

                preview.UnknownBanks = bankNames
                    .Where(b => !knownBanks.Contains(b, StringComparer.OrdinalIgnoreCase))
                    .ToList();
            }

            return preview;
        }
    }
}
