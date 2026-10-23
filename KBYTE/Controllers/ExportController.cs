using System.Globalization;
using System.Text;
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
    public class ExportController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ExportController(ApplicationDbContext context)
        {
            _context = context;
        }

        // Çıktı, Import'un beklediği formatın AYNISIDIR:
        // dışa aktar -> tekrar içe aktar yapılabilir.
        [HttpGet("transactions")]
        public async Task<IActionResult> ExportTransactions([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var query = _context.Transactions
                .Include(t => t.Asset)
                .Include(t => t.BankAccount)
                .AsQueryable();

            if (from.HasValue) query = query.Where(t => t.TransactionDate >= from.Value);
            if (to.HasValue) query = query.Where(t => t.TransactionDate <= to.Value);

            var transactions = await query
                .OrderBy(t => t.TransactionDate)
                .ThenBy(t => t.Id)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("date,type,direction,amount_try,quantity,unit_cost_try,ticker,description,bank,note");

            foreach (var t in transactions)
            {
                var typeText = t.Type switch
                {
                    TransactionType.Income => "Income",
                    TransactionType.Expense => "Expense",
                    TransactionType.Investment => "Investment",
                    TransactionType.CardExpense => "CardExpense",
                    _ => "Expense"
                };

                var directionText = t.Type == TransactionType.Investment
                    ? (t.Direction == TradeDirection.Sell ? "Sell" : "Buy")
                    : string.Empty;

                // Saat bilgisi korunur; UTC'ye çevrilmez.
                var dateText = t.TransactionDate.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);

                var quantityText = t.Quantity.HasValue
                    ? t.Quantity.Value.ToString(CultureInfo.InvariantCulture)
                    : string.Empty;

                var unitText = t.UnitPrice.HasValue
                    ? t.UnitPrice.Value.ToString(CultureInfo.InvariantCulture)
                    : (t.Quantity.HasValue && t.Quantity.Value != 0
                        ? Math.Round(t.AmountTRY / t.Quantity.Value, 4).ToString(CultureInfo.InvariantCulture)
                        : string.Empty);

                sb.AppendLine(string.Join(",", new[]
                {
                    Escape(dateText),
                    Escape(typeText),
                    Escape(directionText),
                    Escape(t.AmountTRY.ToString(CultureInfo.InvariantCulture)),
                    Escape(quantityText),
                    Escape(unitText),
                    Escape(t.Asset?.Ticker ?? string.Empty),
                    Escape(t.Description),
                    Escape(t.BankAccount?.Name ?? string.Empty),
                    Escape(string.Empty)
                }));
            }

            // BOM şart: Excel Türkçe karakterleri yoksa bozuyor.
            var bytes = new UTF8Encoding(true).GetBytes(sb.ToString());
            var fileName = $"kbyte-islemler-{DateTime.Now:yyyyMMdd-HHmm}.csv";

            return File(bytes, "text/csv", fileName);
        }

        [HttpGet("assets")]
        public async Task<IActionResult> ExportAssets()
        {
            var assets = await _context.Assets
                .OrderBy(a => a.AssetCategory)
                .ThenBy(a => a.Name)
                .ToListAsync();

            var sb = new StringBuilder();
            sb.AppendLine("ticker,name,category,current_price_try,last_updated");

            foreach (var a in assets)
            {
                sb.AppendLine(string.Join(",", new[]
                {
                    Escape(a.Ticker),
                    Escape(a.Name),
                    Escape(a.AssetCategory),
                    Escape(a.CurrentPrice.ToString(CultureInfo.InvariantCulture)),
                    Escape(a.LastUpdated.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture))
                }));
            }

            var bytes = new UTF8Encoding(true).GetBytes(sb.ToString());
            var fileName = $"kbyte-varliklar-{DateTime.Now:yyyyMMdd-HHmm}.csv";

            return File(bytes, "text/csv", fileName);
        }

        // Virgül, tırnak veya satır sonu içeren alanları tırnakla; içteki tırnağı ikile.
        private static string Escape(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;

            if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
                return "\"" + value.Replace("\"", "\"\"") + "\"";

            return value;
        }
    }
}
