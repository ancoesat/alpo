namespace KBYTE.Models
{
    public class Asset
    {
        public int Id { get; set; }

        //Euro, Altın, PPZ etc.
        public required string Name { get; set; }

        //EUR, GLD, PPZ formatı
        public required string Ticker { get; set; }

        //Döviz, Yatırım Fonu, Emtia vb. (kategorisel)
        public required string AssetCategory { get; set; }

        public decimal CurrentPrice { get; set; }

        public DateTime LastUpdated { get; set; }

    }
}