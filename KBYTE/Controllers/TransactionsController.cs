using KBYTE.Data;
using KBYTE.DTOs;
using KBYTE.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TransactionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TransactionsController(ApplicationDbContext context)
        {
            _context = context;
        }

        // POST: api/transactions
        [HttpPost]
        public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionDto dto)
        {
            // 1. Girdi doğrulama
            if (dto == null || string.IsNullOrWhiteSpace(dto.Description))
                return BadRequest(new { message = "Açıklama zorunludur." });

            if (dto.AmountTRY <= 0)
                return BadRequest(new { message = "Tutar sıfırdan büyük olmalıdır." });

            if (dto.TransactionDate == default)
                dto.TransactionDate = DateTime.UtcNow;

            // 2. Yatırım işlemleri: varlık + miktar + yön zorunlu
            if (dto.Type == TransactionType.Investment)
            {
                if (dto.AssetId == null)
                    return BadRequest(new { message = "Yatırım işlemlerinde varlık seçimi zorunludur." });

                var assetExists = await _context.Assets.AnyAsync(a => a.Id == dto.AssetId.Value);
                if (!assetExists)
                    return BadRequest(new { message = "Seçilen varlık veritabanında bulunamadı." });

                if (dto.Quantity == null || dto.Quantity <= 0)
                    return BadRequest(new { message = "Yatırım işlemlerinde miktar sıfırdan büyük olmalıdır." });

                dto.Direction ??= TradeDirection.Buy;
                dto.BankAccountId = null;
            }
            // 3. Kart harcaması: banka zorunlu, varlık yok
            else if (dto.Type == TransactionType.CardExpense)
            {
                if (dto.BankAccountId == null)
                    return BadRequest(new { message = "Kart harcamalarında banka seçimi zorunludur." });

                dto.AssetId = null;
                dto.Quantity = null;
                dto.Direction = null;
                dto.UnitPrice = null;
            }
            // 4. Gelir / Gider: varlık ve miktar yok. Gider'de banka opsiyonel (kart ödemesi).
            else
            {
                dto.AssetId = null;
                dto.Quantity = null;
                dto.Direction = null;
                dto.UnitPrice = null;

                if (dto.Type == TransactionType.Income)
                    dto.BankAccountId = null;
            }

            // 5. Banka seçildiyse gerçekten var mı?
            BankAccount? bank = null;
            if (dto.BankAccountId != null)
            {
                bank = await _context.BankAccounts.FindAsync(dto.BankAccountId.Value);
                if (bank == null)
                    return BadRequest(new { message = "Seçilen banka bulunamadı." });
            }

            // 6. DTO'dan güvenli entity oluşturma (Id istemciden gelmez, otomatik atanır)
            var transaction = new Transaction
            {
                TransactionDate = dto.TransactionDate,
                Type            = dto.Type,
                AmountTRY       = dto.AmountTRY,
                Description     = dto.Description.Trim(),
                AssetId         = dto.AssetId,
                Quantity        = dto.Quantity,
                Direction       = dto.Direction,
                UnitPrice       = dto.UnitPrice,
                BankAccountId   = dto.BankAccountId
            };

            // 7. Banka bakiyesini güncelle.
            //    Kart harcaması borcu artırır, kart ödemesi (nakit gider) borcu azaltır.
            if (bank != null)
            {
                if (dto.Type == TransactionType.CardExpense)
                {
                    bank.Debt += dto.AmountTRY;
                }
                else if (dto.Type == TransactionType.Expense)
                {
                    bank.Debt -= dto.AmountTRY;
                }

                // Kalan limit ve asgari ödeme borçtan türetilir
                bank.Recalculate();
            }

            _context.Transactions.Add(transaction);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "İşlem sisteme başarıyla işlendi.", TransactionId = transaction.Id });
        }

        // GET: api/transactions
        [HttpGet]
        public async Task<IActionResult> GetTransactions()
        {
            var transactions = await _context.Transactions
                                    .Include(t => t.Asset)
                                    .OrderByDescending(t => t.TransactionDate)
                                    .ToListAsync();

            return Ok(transactions);
        }
    }
}