namespace KBYTE.Models
{
    // Bir içe aktarma işleminin kaydı. Tek amacı: yanlış bir import'u
    // tek tıkla geri alabilmek. Transaction.ImportBatchId bu tabloya bakar.
    public class ImportBatch
    {
        public int Id { get; set; }

        public DateTime ImportedAt { get; set; }

        public string? FileName { get; set; }

        public int RowCount { get; set; }

        public int CreatedAssetCount { get; set; }
    }
}
