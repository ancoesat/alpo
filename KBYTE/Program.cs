using KBYTE.Data;
using KBYTE.Services;
using KBYTE.Models;
using KBYTE.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// --- Fiyat servisi ---
// Tek bir bellek kopyası + arka planda 15 dakikada bir tazeleyen servis.
// Kullanıcı sayısı ne olursa olsun dış kaynağa giden istek sayısı aynı kalır.
builder.Services.AddHttpClient("prices", client =>
{
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.Add("User-Agent", "KBYTE/1.0 (+https://kasa.ancoesat.dev)");
});
builder.Services.AddSingleton<PriceCache>();
builder.Services.AddHostedService<PriceFetchService>();
builder.Services.AddSwaggerGen();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddAuthentication(ApiKeyAuthenticationHandler.SchemeName)
  .AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(
  ApiKeyAuthenticationHandler.SchemeName, options => {});
builder.Services.AddAuthorization();  
  
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["https://kasa.ancoesat.dev"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionCors", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("DefaultConnection yapılandırması boş. Container environment değişkenlerini kontrol edin.");
}

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

var app = builder.Build();

app.UseCors("ProductionCors");

app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

var seedAssets = new[]
{
    new Asset { Ticker = "EUR", Name = "Euro (€)", AssetCategory = "Döviz", CurrentPrice = 0m, LastUpdated = DateTime.UtcNow },
    new Asset { Ticker = "USD", Name = "Dolar ($)", AssetCategory = "Döviz", CurrentPrice = 0m, LastUpdated = DateTime.UtcNow }
};


using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();

    var context = services.GetRequiredService<ApplicationDbContext>();
    var initialized = false;

    for (var attempt = 1; attempt <= 24; attempt++)
    {
        try
        {
            await context.Database.MigrateAsync();

            var existingAssets = await context.Assets.ToDictionaryAsync(a => a.Ticker);

            foreach (var seed in seedAssets)
            {
                if (!existingAssets.TryGetValue(seed.Ticker, out var existing))
                {
                    context.Assets.Add(seed);
                    continue;
                }

                existing.Name = seed.Name;
                existing.AssetCategory = seed.AssetCategory;
                if (existing.LastUpdated == default)
                {
                    existing.LastUpdated = DateTime.UtcNow;
                }
            }

            await context.SaveChangesAsync();
            initialized = true;
            logger.LogInformation("Veritabanı migration ve seed işlemi tamamlandı.");
            break;
        }
        catch (Exception ex) when (attempt < 24)
        {
            logger.LogWarning(ex, "Veritabanı hazır değil. {Attempt}. deneme / 24 - 5 saniye sonra tekrar deneniyor.", attempt);
            await Task.Delay(TimeSpan.FromSeconds(5));
        }
    }

    if (!initialized)
    {
        throw new InvalidOperationException("Veritabanı migration/seed işlemi tamamlanamadı. API başlatma iptal edildi.");
    }
}
app.Run();

