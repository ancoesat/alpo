using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KBYTE.Migrations
{
    /// <inheritdoc />
    public partial class AddBankInterestRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "InterestRate",
                table: "BankAccounts",
                type: "decimal(65,30)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterestRate",
                table: "BankAccounts");
        }
    }
}
