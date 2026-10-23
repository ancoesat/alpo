using KBYTE.Services;
using Microsoft.AspNetCore.Mvc;

namespace KBYTE.Controllers
{
    // BİLEREK KİMLİK DOĞRULAMASIZ.
    // Burada kullanıcıya ait hiçbir veri yok — sadece herkese açık döviz
    // ve altın kurları. Bu sayede iOS uygulamasının içine API anahtarı
    // gömmek gerekmiyor; gömülen anahtar zaten er geç çıkarılır.
    [Route("api/[controller]")]
    [ApiController]
    public class PricesController : ControllerBase
    {
        private readonly PriceCache _cache;

        public PricesController(PriceCache cache)
        {
            _cache = cache;
        }

        [HttpGet]
        public IActionResult GetPrices()
        {
            var quotes = _cache.All()
                .OrderBy(q => q.Ticker)
                .Select(q => new
                {
                    ticker = q.Ticker,
                    price = q.Price,
                    updatedAtUtc = q.UpdatedAtUtc,
                    source = q.Source
                })
                .ToList();

            // Önbellek henüz dolmadıysa 503 — istemci eski değerlerini korusun
            if (quotes.Count == 0)
            {
                return StatusCode(503, new
                {
                    message = "Fiyatlar henüz hazır değil.",
                    lastError = _cache.LastError
                });
            }

            return Ok(new
            {
                fetchedAtUtc = _cache.LastSuccessfulFetchUtc,
                lastError = _cache.LastError,
                prices = quotes
            });
        }
    }
}
