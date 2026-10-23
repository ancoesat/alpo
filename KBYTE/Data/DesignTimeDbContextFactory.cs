using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace KBYTE.Data
{
    // SADECE 'dotnet ef' komutları için kullanılır. Uygulama çalışırken devreye girmez.
    // Program.cs'deki fail-fast kontrolünü by-pass eder ve AutoDetect yerine sabit
    // sürüm kullandığı için canlı bir veritabanı bağlantısı gerektirmez.
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var connectionString =
                Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                ?? "Server=localhost;Port=3306;Database=kbyte_db;User=root;Password=design-time;";

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseMySql(connectionString, ServerVersion.Parse("8.0.0-mysql"))
                .Options;

            return new ApplicationDbContext(options);
        }
    }
}