namespace KBYTE.DTOs
{
    // --- İSTEK ---

    public class ImportAnalyzeDto
    {
        public string Csv { get; set; } = string.Empty;
        public string? FileName { get; set; }
    }

    public class ImportCommitDto
    {
        public string Csv { get; set; } = string.Empty;
        public string? FileName { get; set; }

        // Önizlemede çıkan bilinmeyen ticker'lar için kullanıcının verdiği cevaplar
        public List<NewAssetAnswerDto> NewAssets { get; set; } = new List<NewAssetAnswerDto>();
    }

    public class NewAssetAnswerDto
    {
        public string Ticker { get; set; } = string.Empty;

        // Dolu ise: yeni varlık yaratma, bu mevcut varlığa bağla.
        public int? MapToAssetId { get; set; }

        public string? Name { get; set; }
        public string? Category { get; set; }
        public decimal CurrentPrice { get; set; }
    }

    // --- CEVAP ---

    public class MonthPreviewDto
    {
        public string Month { get; set; } = string.Empty;   // "2026-06"
        public decimal TotalIncome { get; set; }
        public decimal TotalExpense { get; set; }
        public decimal TotalInvestment { get; set; }
        public decimal TotalIncurredDebt { get; set; }
        public decimal NetBalance { get; set; }
        public int RowCount { get; set; }
    }

    public class RowErrorDto
    {
        public int LineNumber { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class ImportPreviewDto
    {
        public int TotalRows { get; set; }
        public int IncomeRows { get; set; }
        public int ExpenseRows { get; set; }
        public int InvestmentRows { get; set; }
        public int CardExpenseRows { get; set; }

        public List<MonthPreviewDto> Months { get; set; } = new List<MonthPreviewDto>();

        // Veritabanında karşılığı olmayan ticker'lar — kullanıcıya soru sorulacak olanlar
        public List<string> UnknownTickers { get; set; } = new List<string>();

        // CSV'de geçen ama veritabanında olmayan banka isimleri
        public List<string> UnknownBanks { get; set; } = new List<string>();

        public List<RowErrorDto> Errors { get; set; } = new List<RowErrorDto>();
        public List<string> Warnings { get; set; } = new List<string>();

        public bool CanCommit => Errors.Count == 0 && TotalRows > 0;
    }

    public class ImportResultDto
    {
        public int BatchId { get; set; }
        public int ImportedRows { get; set; }
        public int CreatedAssets { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
