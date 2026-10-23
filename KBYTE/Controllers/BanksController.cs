using KBYTE.Data;
using KBYTE.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class BanksController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        
        public BanksController(ApplicationDbContext context)
        {
            _context = context;
        }
        
        [HttpGet]
        public async Task<IActionResult> GetBanks()
        {
            var banks = await _context.BankAccounts
                .OrderBy(b => b.DisplayOrder)
                .Select(b => new
                {
                    b.Id,
                    b.Name,
                    b.CardLimit,
                    b.Debt,
                    b.MinimumPayment,
                    b.RemainingLimit,
                    b.StatementDayOfMonth,
                    b.BrandColor,
                    b.InterestRate
                })
                .ToListAsync();

            return Ok(banks);
        }

        [HttpPost]
        public async Task<IActionResult> CreateBank([FromBody] CreateBankDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Banka adı zorunludur." });

            if (dto.CardLimit < 0 || dto.Debt < 0)
                return BadRequest(new { message = "Negatif değer girilemez." });

            if (dto.StatementDayOfMonth != null && (dto.StatementDayOfMonth < 1 || dto.StatementDayOfMonth > 31))
                return BadRequest(new { message = "Hesap kesim günü 1 ile 31 arasında olmalıdır." });

            // Yeni banka her zaman listenin sonuna eklenir — DisplayOrder elle
            // verilmiyor, çünkü sıralama zaten mevcut bankaların üzerinden
            // türetiliyor. Hiç banka yoksa (ilk kayıt) 0'dan başlar.
            var maxOrder = await _context.BankAccounts.AnyAsync()
                ? await _context.BankAccounts.MaxAsync(b => b.DisplayOrder)
                : 0;

            var bank = new BankAccount
            {
                Name = dto.Name.Trim(),
                CardLimit = dto.CardLimit,
                Debt = dto.Debt,
                StatementDayOfMonth = dto.StatementDayOfMonth,
                BrandColor = string.IsNullOrWhiteSpace(dto.BrandColor) ? "#6B7280" : dto.BrandColor,
                DisplayOrder = maxOrder + 1,
                InterestRate = dto.InterestRate
            };
            bank.Recalculate();

            _context.BankAccounts.Add(bank);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Banka eklendi.", id = bank.Id });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBank(int id, [FromBody] UpdateBankDto dto)
        {
            var bank = await _context.BankAccounts.FindAsync(id);
            if (bank == null)
              return NotFound(new { message = "Banka Bulunamadi"});

            if (dto.CardLimit < 0 || dto.Debt < 0)
                return BadRequest(new { message = "Negatif değer girilemez."});

            if (dto.StatementDayOfMonth != null && (dto.StatementDayOfMonth < 1 || dto.StatementDayOfMonth > 31))
                return BadRequest(new { message = "Hesap kesim günü 1 ile 31 arasında olmalıdır."});

            if (dto.Name != null && string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Banka adı boş olamaz." });

            // Name/BrandColor artık isteğe bağlı gönderiliyor — dolu geldiyse
            // güncelle, boş/null geldiyse mevcut değeri koru. CardLimit/Debt/
            // StatementDayOfMonth hep zorunlu kaldı, önceki davranış bozulmadı.
            if (!string.IsNullOrWhiteSpace(dto.Name)) bank.Name = dto.Name.Trim();
            if (!string.IsNullOrWhiteSpace(dto.BrandColor)) bank.BrandColor = dto.BrandColor;
            bank.CardLimit = dto.CardLimit;
            bank.Debt = dto.Debt;
            bank.StatementDayOfMonth = dto.StatementDayOfMonth;
            bank.InterestRate = dto.InterestRate;
            bank.Recalculate();

            await _context.SaveChangesAsync();

            return Ok(new {message = "Banka bilgileri güncellendi."});
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBank(int id)
        {
            var bank = await _context.BankAccounts.FindAsync(id);
            if (bank == null)
                return NotFound(new { message = "Banka bulunamadı." });

            // Silme, bağlı işlemleri SİLMEZ — sadece o işlemlerin BankAccountId'sini
            // boşaltır. Geçmiş tutarlar (aylık gelir/gider toplamları) bankadan değil
            // amountTRY'den hesaplanıyor, yani hiçbir rapor bozulmaz. Kaybolan tek
            // şey "bu hangi bankaydı" etiketi — ki tam da istenen bu: kartı kapattın,
            // geçmiş harcamaların hâlâ dursun, sadece artık bir bankaya bağlı görünmesin.
            var linked = await _context.Transactions
                .Where(t => t.BankAccountId == id)
                .ToListAsync();

            foreach (var t in linked)
                t.BankAccountId = null;

            _context.BankAccounts.Remove(bank);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Banka silindi." });
        }
    }

    public class CreateBankDto
    {
        public required string Name {get; set;}
        public decimal CardLimit {get; set;}
        public decimal Debt {get; set;}
        public int? StatementDayOfMonth {get; set;}
        public string? BrandColor {get; set;}
        public decimal? InterestRate {get; set;}
    }

    public class UpdateBankDto
    {
        public string? Name {get; set;}
        public string? BrandColor {get; set;}
        public decimal CardLimit {get; set;}
        public decimal Debt {get; set;}
        public int? StatementDayOfMonth {get; set;}
        public decimal? InterestRate {get; set;}
    }
}