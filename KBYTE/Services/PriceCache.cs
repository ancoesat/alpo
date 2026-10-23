using System.Collections.Concurrent;

namespace KBYTE.Services
{
    public record PriceQuote(string Ticker, decimal Price, DateTime UpdatedAtUtc, string Source);

    // Bellekte duran tek kopya fiyat tablosu.
    // Kaç kullanıcı olursa olsun dış servise dakikada bir kez gidiliyor;
    // herkes bu kopyadan okuyor.
    public class PriceCache
    {
        private readonly ConcurrentDictionary<string, PriceQuote> _quotes = new();

        public DateTime? LastSuccessfulFetchUtc { get; private set; }
        public string? LastError { get; private set; }

        public void Set(string ticker, decimal price, string source)
        {
            _quotes[ticker] = new PriceQuote(ticker, price, DateTime.UtcNow, source);
        }

        public void MarkSuccess()
        {
            LastSuccessfulFetchUtc = DateTime.UtcNow;
            LastError = null;
        }

        public void MarkFailure(string message) => LastError = message;

        public IReadOnlyCollection<PriceQuote> All() => _quotes.Values.ToList();
    }
}
