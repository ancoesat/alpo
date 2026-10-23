using System.ComponentModel.DataAnnotations.Schema;
namespace KBYTE.Models
{

    public enum TransactionType
    {
        Income,
        Expense,
        Investment,
        CardExpense
    }
    
    public enum TradeDirection
    {
        Buy,
        Sell
        
    }

    public class Transaction
    {
        public int Id { get; set; }

        public DateTime TransactionDate { get; set; }

        public TransactionType Type { get; set; }

        //Çıkan-Giren net TL tutar
        public decimal AmountTRY { get; set; }
        //Açıklama
        public required string Description { get; set; }


        // -- YATIRIM İLİŞKİLERİ (RELATIONAL)

        //Sadece yatırım işlemlerinde doldurulacak Nullable
        public int? AssetId { get; set; }

        //Entity Framework Core iletişimini sağlayacak bağlantı
        public Asset? Asset { get; set; }

        //Alınan veya satılan miktar
        [Column("Quantity")] // Doğru yazım: sütun adı "Quantity"
        public decimal? Quantity { get; set; }
        
        public TradeDirection? Direction {get; set;}
        
        public decimal? UnitPrice {get; set;}
        
        public int? BankAccountId {get; set;}
        public BankAccount? BankAccount {get; set;}

        // CSV ile içe aktarıldıysa hangi partiden geldiği. Elle girilen işlemlerde null.
        public int? ImportBatchId { get; set; }
    }

}