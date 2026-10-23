using KBYTE.Data;
using KBYTE.DTOs;
using KBYTE.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public DashboardController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet("monthly-summary")]
        public async Task<IActionResult> GetMonthlySummary(int year, int month)
        {
            // Varsayılan değer koruması: Parametre gönderilmezse model-binding 0 atar
            if (year < 2000 || year > 2100 || month < 1 || month > 12)
                return BadRequest(new { message = "Geçersiz yıl veya ay." });

            var transactions = await _context.Transactions
                .Include(t => t.Asset)
                .Include(t => t.BankAccount)
                .Where(t => t.TransactionDate.Year == year && t.TransactionDate.Month == month)
                .ToListAsync();

            var summary = new MonthlySummaryDto
            {
                Year = year,
                Month = month,
                TotalIncome     = transactions.Where(t => t.Type == TransactionType.Income).Sum(t => t.AmountTRY),
                TotalExpense    = transactions.Where(t => t.Type == TransactionType.Expense).Sum(t => t.AmountTRY),
                TotalInvestment = transactions
                        .Where(t => t.Type == TransactionType.Investment && t.Direction != TradeDirection.Sell)
                        .Sum(t => t.AmountTRY)
                    - transactions
                        .Where(t => t.Type == TransactionType.Investment && t.Direction == TradeDirection.Sell)
                        .Sum(t => t.AmountTRY),

                TotalIncurredDebt = transactions
                        .Where(t => t.Type == TransactionType.CardExpense)
                        .Sum(t => t.AmountTRY),

                Transactions = transactions
                    .OrderByDescending(t => t.TransactionDate)
                    .ThenByDescending(t => t.Id)
                    .Select(t => new TransactionItemDto
                    {
                        Id              = t.Id,
                        TransactionDate = t.TransactionDate,
                        Type            = (int)t.Type,
                        AmountTRY       = t.AmountTRY,
                        Description     = t.Description,
                        Quantity        = t.Quantity,
                        AssetTicker     = t.Asset?.Ticker,
                        Direction       = t.Direction.HasValue ? (int)t.Direction.Value : null,
                        UnitPrice       = t.UnitPrice,
                        BankName        = t.BankAccount?.Name
                    }).ToList()
            };

            return Ok(summary);
        }

        [HttpGet("investment-portfolio")]
        public async Task<IActionResult> GetInvestmentPortfolio()
        {
            // Tarih sırası ŞART: ortalama maliyet kronolojik yürüyerek hesaplanır.
            var investments = await _context.Transactions
                .Include(t => t.Asset)
                .Where(t => t.Type == TransactionType.Investment)
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.Id)
                .ToListAsync();

            var assetsMap = await _context.Assets
                .ToDictionaryAsync(a => a.Ticker, a => a.CurrentPrice);

            var portfolio = investments
                 .GroupBy(t => t.Asset?.Ticker ?? "KATEGORISIZ")
                 .Select(g =>
                 {
                     decimal quantity   = 0m;
                     decimal costBasis  = 0m;
                     decimal realized   = 0m;
                     
                     foreach (var t in g)
                     {
                         var q = t.Quantity ?? 0m;
                         
                         if (t.Direction == TradeDirection.Sell)
                         {
                             //Satista mal ortalama maliyetten cikar, satis fiyatindan degil. Aradaki fark = realize edilmis kar/zarar.
                             var avg = quantity > 0 ? costBasis / quantity : 0m;
                             
                             realized  += t.AmountTRY - (q * avg);
                             costBasis -= q * avg;
                             quantity -= q;
                            
                         }
                         else
                         {
                             quantity  += q;
                             costBasis += t.AmountTRY;
                         }
                     }
                     
                     assetsMap.TryGetValue(g.Key, out var currentPrice);
                     
                     var marketValue = quantity * currentPrice;
                     
                     return new
                     {
                         Id            = g.Max(t => t.Id),
                        Asset         = g.Key,
                        TotalQuantity = quantity,
                        TotalCostTRY  = costBasis,
                        AverageCost   = quantity > 0 ? Math.Round(costBasis / quantity, 4) : 0m,
                        CurrentPrice  = currentPrice,
                        MarketValue   = marketValue,
                        Unrealized    = quantity > 0 ? marketValue - costBasis : 0m,
                        Realized      = Math.Round(realized, 2),
                        IsClosed      = quantity == 0m
                     };
                     
                     
                 })     
                 .OrderByDescending(p => p.TotalCostTRY)
                 .ToList();
                 
            return Ok(portfolio);   
            
        }

        [HttpGet("live-rates")]
        public async Task<IActionResult> GetLiveRates()
        {
            var targetTickers = new[] { "EUR", "USD", "PPF", "TP2", "TUPRS", "ALTIN (gr.)", "PPZ" };

            var allAssets = await _context.Assets.ToListAsync();

            var rates = allAssets
                .Where(a => targetTickers.Contains(a.Ticker))
                .Select(a => new
                {
                    Asset        = a.Ticker,
                    CurrentPrice = a.CurrentPrice
                })
                .ToList();

            return Ok(rates);
        }

        [HttpGet("assets")]
        public async Task<IActionResult> GetAvailableAssets()
        {
            var assets = await _context.Assets
                .Select(a => new
                {
                    Id = a.Id,
                    Ticker = a.Ticker,
                    Name = a.Name,
                    AssetCategory = a.AssetCategory,
                    CurrentPrice = a.CurrentPrice,
                    LastUpdated = a.LastUpdated
                })
                .OrderBy(a => a.AssetCategory)
                .ThenBy(a => a.Name)
                .ToListAsync();

            return Ok(assets);
        }

        [HttpPost("update-manual-prices")]
        public async Task<IActionResult> UpdateManualPrices([FromBody] Dictionary<string, decimal> prices)
        {
            foreach (var item in prices)
            {
                var asset = await _context.Assets.FirstOrDefaultAsync(a => a.Ticker == item.Key);
                if (asset != null)
                {
                    asset.CurrentPrice = item.Value;
                    asset.LastUpdated = DateTime.UtcNow;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Kurlar başarıyla güncellendi." });
        }

        [HttpDelete("delete-asset/{id}")]
        public async Task<IActionResult> DeleteAsset(int id)
        {
            var asset = await _context.Assets.FindAsync(id);
            if (asset == null)
                return NotFound(new { message = "Asset not found." });

            var hasTransactions = await _context.Transactions.AnyAsync(t => t.AssetId == id);
            if (hasTransactions)
            {
                return BadRequest(new
                {
                    message = "Cannot delete: This asset is linked to existing transactions. Delete the transactions first."
                });
            }

            _context.Assets.Remove(asset);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Asset deleted successfully." });
        }


        [HttpDelete("transaction/{id}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            var transaction = await _context.Transactions
                .Include(t => t.BankAccount)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (transaction == null)
                return NotFound(new { message = "Silinecek işlem kasada bulunamadı." });

            // Banka bakiyesine yapılan etkiyi geri al — yoksa borç rakamı kalıcı olarak bozulur.
            if (transaction.BankAccount != null)
            {
                if (transaction.Type == TransactionType.CardExpense)
                {
                    transaction.BankAccount.Debt -= transaction.AmountTRY;
                }
                else if (transaction.Type == TransactionType.Expense)
                {
                    transaction.BankAccount.Debt += transaction.AmountTRY;
                }

                transaction.BankAccount.Recalculate();
            }

            _context.Transactions.Remove(transaction);
            await _context.SaveChangesAsync();

            return Ok(new { message = "İşlem kasadan başarıyla silindi." });
        }
    }
}
