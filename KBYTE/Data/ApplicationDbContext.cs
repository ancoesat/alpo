using KBYTE.Models;
using Microsoft.EntityFrameworkCore;

namespace KBYTE.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
        {
        }
        
        //Veritabanında oluşacak tablo isimleri
        public DbSet<Asset> Assets { get; set; }
        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<BankAccount> BankAccounts {get; set;}
        public DbSet<ImportBatch> ImportBatches { get; set; }
    }
}
