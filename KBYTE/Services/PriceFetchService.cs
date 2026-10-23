using System.Globalization;
using System.Xml.Linq;
using KBYTE.Data;
using KBYTE.Models;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Services
{
    // Dış kaynaklardan fiyat çeker, belleğe yazar ve Assets tablosunu günceller.
    // Web arayüzü Assets'ten okuduğu için otomatik faydalanıyor;
    // iOS uygulaması ise /api/Prices ucundan bellekteki kopyayı alıyor.
    public class PriceFetchService : BackgroundService
    {
        private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

        // SADECE bu ticker'lar otomatik güncellenir.
        // Bu sürümde sadece EUR ve USD var; diğer varlıklar elle girilir.
        private static readonly string[] AutoUpdatedTickers = ["EUR", "USD"];

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly PriceCache _cache;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PriceFetchService> _logger;

        public PriceFetchService(IServiceScopeFactory scopeFactory,
                                 PriceCache cache,
                                 IHttpClientFactory httpClientFactory,
                                 ILogger<PriceFetchService> logger)
        {
            _scopeFactory = scopeFactory;
            _cache = cache;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Uygulama ayağa kalkarken veritabanı hazır olsun diye kısa bir es
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await FetchOnceAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    // Servis ASLA çökmez: loglar, önbellekteki son iyi değerler kalır.
                    _cache.MarkFailure(ex.Message);
                    _logger.LogWarning(ex, "Fiyat çekme turu başarısız oldu.");
                }

                await Task.Delay(Interval, stoppingToken);
            }
        }

        private async Task FetchOnceAsync(CancellationToken token)
        {
            var client = _httpClientFactory.CreateClient("prices");
            var failures = new List<string>();
            var anySucceeded = false;

            // HER KAYNAK KENDİ İÇİNDE YALITILMIŞ.
            // Önceden tek bir kaynak patladığında tur komple iptal oluyordu:
            // altın 403 verince TCMB kurları da veritabanına yazılmıyordu.
            try
            {
                await FetchCentralBankRatesAsync(client, token);
                anySucceeded = true;
            }
            catch (Exception ex)
            {
                failures.Add($"TCMB: {ex.Message}");
                _logger.LogWarning(ex, "TCMB kurları çekilemedi.");
            }


            // Bir kaynak bile başarılıysa elimizdekini veritabanına yaz.
            if (anySucceeded)
            {
                _cache.MarkSuccess();

                try
                {
                    await WriteToAssetsAsync(token);
                }
                catch (Exception ex)
                {
                    // Veritabanı yazımı patlarsa iOS tarafı yine de çalışsın:
                    // fiyatlar önbellekte geçerli, sadece web arayüzü eski kalır.
                    failures.Add($"Veritabanı: {ex.Message}");
                    _logger.LogWarning(ex, "Fiyatlar Assets tablosuna yazılamadı.");
                }
            }

            if (failures.Count > 0)
            {
                _cache.MarkFailure(string.Join(" | ", failures));
            }
        }

        // TCMB günlük kur dosyası — EUR ve USD tek istekte geliyor.
        private async Task FetchCentralBankRatesAsync(HttpClient client, CancellationToken token)
        {
            var xml = await client.GetStringAsync("https://www.tcmb.gov.tr/kurlar/today.xml", token);
            var document = XDocument.Parse(xml);

            foreach (var code in new[] { "EUR", "USD" })
            {
                var node = document.Descendants("Currency")
                    .FirstOrDefault(x => x.Attribute("CurrencyCode")?.Value == code);

                var text = node?.Element("ForexSelling")?.Value;

                if (decimal.TryParse(text, NumberStyles.Any, CultureInfo.InvariantCulture, out var price)
                    && price > 0)
                {
                    _cache.Set(code, price, "TCMB");
                }
            }
        }


        // Web arayüzü fiyatları Assets tablosundan okuyor; oraya da yazıyoruz.
        // Sadece AutoUpdatedTickers listesindekiler güncelleniyor —
        // elle girilen fon fiyatları korunuyor.
        private async Task WriteToAssetsAsync(CancellationToken token)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // EF Core, static readonly bir diziyi sorgu parametresine çeviremiyor
            // ("LINQ query parameter expression" hatası buradan geliyordu).
            // Yerel bir değişkene kopyalayınca normal bir parametre gibi işliyor.
            var tickers = AutoUpdatedTickers.ToList();

            var assets = await context.Assets
                .Where(a => tickers.Contains(a.Ticker))
                .ToListAsync(token);

            var changed = false;

            foreach (var quote in _cache.All())
            {
                if (!AutoUpdatedTickers.Contains(quote.Ticker)) continue;

                var asset = assets.FirstOrDefault(a => a.Ticker == quote.Ticker);
                if (asset == null || asset.CurrentPrice == quote.Price) continue;

                asset.CurrentPrice = quote.Price;
                asset.LastUpdated = DateTime.UtcNow;
                changed = true;
            }

            if (changed) await context.SaveChangesAsync(token);
        }
    }
}
