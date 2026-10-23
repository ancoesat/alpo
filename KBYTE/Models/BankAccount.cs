namespace KBYTE.Models
{
    public class BankAccount
    {
        // Asgari ödeme oranı. Tek yerde durur ki değiştirmek istediğinde
        // kodun içinde 0.20 aramak zorunda kalma.
        public const decimal MinimumPaymentRate = 0.20m;

        public int Id {get; set;}

        public required string Name {get; set;}

        // Kartın toplam limiti. Borç ile birlikte GİRDİ olan iki alandan biri.
        public decimal CardLimit {get; set;}

        public decimal Debt {get; set;}

        // Aşağıdaki iki alan TÜRETİLMİŞTİR — elle girilmez, Recalculate() yazar.
        // Veritabanında tutuluyorlar ki sorgular ve raporlar hesap yapmak
        // zorunda kalmasın; her yazma işleminde yeniden hesaplandıkları için
        // borç ile aralarında sapma oluşamaz.
        public decimal MinimumPayment {get; set;}

        public decimal RemainingLimit {get; set;}

        // Ayın kaçında hesap kesiliyor (1-31). Metin değil sayı:
        // son ödeme tarihini hesaplayabilmek için gerekiyor.
        public int? StatementDayOfMonth {get; set;}

        public required string BrandColor {get; set;}

        public int DisplayOrder {get; set;}
        
        public decimal? InterestRate {get; set;}

        // Borç veya limit her değiştiğinde çağrılır.
        public void Recalculate()
        {
            if (Debt < 0) Debt = 0;

            MinimumPayment = Math.Round(Debt * MinimumPaymentRate, 2);
            RemainingLimit = Math.Max(0m, CardLimit - Debt);
        }
    }
}
