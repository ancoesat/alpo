using System.Globalization;
using System.Text;
using KBYTE.Models;

namespace KBYTE.Services
{
    // CSV'den okunan tek bir satır. Henüz veritabanına bakılmadı:
    // ticker'ın gerçekten var olup olmadığı controller'da kontrol edilir.
    public class ParsedRow
    {
        public int LineNumber { get; set; }
        public DateTime Date { get; set; }
        public TransactionType Type { get; set; }
        public TradeDirection? Direction { get; set; }
        public decimal AmountTRY { get; set; }
        public decimal? Quantity { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? Ticker { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? BankName { get; set; }
    }

    public class RowError
    {
        public int LineNumber { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public class ParseResult
    {
        public List<ParsedRow> Rows { get; set; } = new List<ParsedRow>();
        public List<RowError> Errors { get; set; } = new List<RowError>();
        public List<string> Warnings { get; set; } = new List<string>();
    }

    // Veritabanına hiç dokunmaz — sadece metni satırlara çevirir ve doğrular.
    // Bu sayede tek başına test edilebilir.
    public static class CsvParser
    {
        // Bir CSV satırını alanlara böler. Tırnak içindeki virgülleri ve
        // "" ile kaçırılmış tırnakları doğru işler.
        public static List<string> SplitCsvLine(string line)
        {
            var fields = new List<string>();
            var current = new StringBuilder();
            var inQuotes = false;

            for (var i = 0; i < line.Length; i++)
            {
                var c = line[i];

                if (inQuotes)
                {
                    if (c == '"')
                    {
                        // İki tırnak arka arkaya => tek tırnak karakteri
                        if (i + 1 < line.Length && line[i + 1] == '"')
                        {
                            current.Append('"');
                            i++;
                        }
                        else
                        {
                            inQuotes = false;
                        }
                    }
                    else
                    {
                        current.Append(c);
                    }
                }
                else
                {
                    if (c == '"')
                    {
                        inQuotes = true;
                    }
                    else if (c == ',')
                    {
                        fields.Add(current.ToString());
                        current.Clear();
                    }
                    else
                    {
                        current.Append(c);
                    }
                }
            }

            fields.Add(current.ToString());
            return fields;
        }

        public static ParseResult Parse(string csv)
        {
            var result = new ParseResult();

            if (string.IsNullOrWhiteSpace(csv))
            {
                result.Errors.Add(new RowError { LineNumber = 0, Message = "Dosya boş." });
                return result;
            }

            // Excel'in eklediği BOM karakterini temizle
            csv = csv.TrimStart('﻿');

            var lines = csv.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');

            var headerIndex = Array.FindIndex(lines, l => !string.IsNullOrWhiteSpace(l));
            if (headerIndex < 0)
            {
                result.Errors.Add(new RowError { LineNumber = 0, Message = "Başlık satırı bulunamadı." });
                return result;
            }

            // Başlık isimlerini sütun numarasına eşle
            var headers = SplitCsvLine(lines[headerIndex])
                .Select(h => h.Trim().ToLowerInvariant())
                .ToList();

            var columns = new Dictionary<string, int>();
            for (var i = 0; i < headers.Count; i++)
            {
                if (!string.IsNullOrWhiteSpace(headers[i]) && !columns.ContainsKey(headers[i]))
                    columns[headers[i]] = i;
            }

            foreach (var required in new[] { "date", "type", "amount_try" })
            {
                if (!columns.ContainsKey(required))
                {
                    result.Errors.Add(new RowError
                    {
                        LineNumber = headerIndex + 1,
                        Message = $"Zorunlu sütun eksik: {required}"
                    });
                }
            }

            if (result.Errors.Count > 0) return result;

            string Field(List<string> fields, string name)
            {
                if (!columns.TryGetValue(name, out var index)) return string.Empty;
                if (index >= fields.Count) return string.Empty;
                return fields[index].Trim();
            }

            for (var i = headerIndex + 1; i < lines.Length; i++)
            {
                var raw = lines[i];
                if (string.IsNullOrWhiteSpace(raw)) continue;

                var lineNumber = i + 1;
                var fields = SplitCsvLine(raw);
                var row = new ParsedRow { LineNumber = lineNumber };

                // --- TARİH ---
                // DateTimeStyles.None: metindeki saat neyse o kalır, UTC'ye çevrilmez.
                // 03:46 girildiyse veritabanına 03:46 yazılır.
                var dateText = Field(fields, "date");
                if (!DateTime.TryParse(dateText, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                {
                    result.Errors.Add(new RowError { LineNumber = lineNumber, Message = $"Tarih okunamadı: '{dateText}'" });
                    continue;
                }
                row.Date = DateTime.SpecifyKind(date, DateTimeKind.Unspecified);

                // --- TİP ---
                var typeText = Field(fields, "type").ToLowerInvariant();
                switch (typeText)
                {
                    case "income": case "gelir": row.Type = TransactionType.Income; break;
                    case "expense": case "gider": row.Type = TransactionType.Expense; break;
                    case "investment": case "yatirim": case "yatırım": row.Type = TransactionType.Investment; break;
                    case "cardexpense": case "card_expense": case "kart": row.Type = TransactionType.CardExpense; break;
                    default:
                        result.Errors.Add(new RowError { LineNumber = lineNumber, Message = $"Bilinmeyen tip: '{typeText}'" });
                        continue;
                }

                // --- TUTAR ---
                var amountText = Field(fields, "amount_try");
                if (!decimal.TryParse(amountText, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount))
                {
                    result.Errors.Add(new RowError { LineNumber = lineNumber, Message = $"Tutar okunamadı: '{amountText}'" });
                    continue;
                }
                if (amount <= 0)
                {
                    result.Errors.Add(new RowError { LineNumber = lineNumber, Message = "Tutar sıfırdan büyük olmalıdır. Satışlar için direction=Sell kullanın." });
                    continue;
                }
                row.AmountTRY = amount;

                // --- AÇIKLAMA (+ note sütunu açıklamaya eklenir) ---
                var description = Field(fields, "description");
                var note = Field(fields, "note");
                if (!string.IsNullOrWhiteSpace(note))
                {
                    description = string.IsNullOrWhiteSpace(description) ? note : $"{description} ({note})";
                }
                if (string.IsNullOrWhiteSpace(description))
                {
                    result.Errors.Add(new RowError { LineNumber = lineNumber, Message = "Açıklama boş olamaz." });
                    continue;
                }
                row.Description = description;

                // --- BANKA (opsiyonel) ---
                var bankName = Field(fields, "bank");
                row.BankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName;

                if (row.Type == TransactionType.CardExpense && row.BankName == null)
                {
                    result.Errors.Add(new RowError { LineNumber = lineNumber, Message = "Kart harcamalarında 'bank' sütunu zorunludur." });
                    continue;
                }

                // --- YATIRIM ALANLARI ---
                if (row.Type == TransactionType.Investment)
                {
                    var ticker = Field(fields, "ticker");
                    if (string.IsNullOrWhiteSpace(ticker))
                    {
                        result.Errors.Add(new RowError { LineNumber = lineNumber, Message = "Yatırım satırlarında 'ticker' zorunludur." });
                        continue;
                    }
                    row.Ticker = ticker;

                    var quantityText = Field(fields, "quantity");
                    if (!decimal.TryParse(quantityText, NumberStyles.Any, CultureInfo.InvariantCulture, out var quantity) || quantity <= 0)
                    {
                        result.Errors.Add(new RowError { LineNumber = lineNumber, Message = $"Miktar okunamadı veya sıfırdan küçük: '{quantityText}'" });
                        continue;
                    }
                    row.Quantity = quantity;

                    var directionText = Field(fields, "direction").ToLowerInvariant();
                    row.Direction = directionText switch
                    {
                        "sell" or "satis" or "satış" => TradeDirection.Sell,
                        _ => TradeDirection.Buy
                    };

                    // unit_cost_try doğrulama amaçlıdır; gerçek kaynak tutar ve miktardır.
                    var unitText = Field(fields, "unit_cost_try");
                    if (!string.IsNullOrWhiteSpace(unitText) &&
                        decimal.TryParse(unitText, NumberStyles.Any, CultureInfo.InvariantCulture, out var unit))
                    {
                        row.UnitPrice = unit;

                        var derived = amount / quantity;
                        if (unit > 0 && Math.Abs(derived - unit) / unit > 0.01m)
                        {
                            result.Warnings.Add(
                                $"Satır {lineNumber}: birim fiyat ({unit}) tutar/miktar ({Math.Round(derived, 4)}) ile uyuşmuyor.");
                        }
                    }
                }

                result.Rows.Add(row);
            }

            if (result.Rows.Count == 0 && result.Errors.Count == 0)
            {
                result.Errors.Add(new RowError { LineNumber = 0, Message = "Dosyada işlenebilir satır bulunamadı." });
            }

            return result;
        }
    }
}
