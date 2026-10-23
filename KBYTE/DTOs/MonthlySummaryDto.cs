using KBYTE.Models;

namespace KBYTE.DTOs
{
    public class MonthlySummaryDto
    {
        public int Month { get; set; }
        public int Year { get; set; }
        public decimal TotalIncome { get; set; }
        public decimal TotalExpense { get; set; }
        public decimal TotalInvestment { get; set; }
        public decimal TotalIncurredDebt { get; set; }
        public decimal NetBalance => TotalIncome - TotalExpense - TotalInvestment;

        public List<TransactionItemDto> Transactions { get; set; } = new List<TransactionItemDto>();

    }

    public class TransactionItemDto
    {
        public int Id { get; set; }
        public DateTime TransactionDate { get; set; }
        public int Type { get; set; }
        public decimal AmountTRY { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal? Quantity { get; set; }
        public string? AssetTicker { get; set; }  // FK üzerinden güvenli okuma
        public int? Direction { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? BankName {get; set;}
    }

    /// <summary>
    /// Strict DTO for creating transactions — prevents mass assignment.
    /// Only the fields the client is allowed to set are exposed.
    /// </summary>
    public class CreateTransactionDto
    {
        public DateTime TransactionDate { get; set; }
        public TransactionType Type { get; set; }
        public decimal AmountTRY { get; set; }
        public string Description { get; set; } = string.Empty;
        public int? AssetId { get; set; }
        public decimal? Quantity { get; set; }
        public TradeDirection? Direction {get; set;}
        public decimal? UnitPrice {get; set;}
        public int? BankAccountId {get; set;}
    }
}

