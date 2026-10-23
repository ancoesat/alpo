using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace KBYTE.Migrations
{
    /// <inheritdoc />
    public partial class AddCardLimitAndStatementDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StatementDay",
                table: "BankAccounts");

            migrationBuilder.AddColumn<decimal>(
                name: "CardLimit",
                table: "BankAccounts",
                type: "decimal(65,30)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "StatementDayOfMonth",
                table: "BankAccounts",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CardLimit",
                table: "BankAccounts");

            migrationBuilder.DropColumn(
                name: "StatementDayOfMonth",
                table: "BankAccounts");

            migrationBuilder.AddColumn<string>(
                name: "StatementDay",
                table: "BankAccounts",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }
    }
}
