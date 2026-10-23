# 1. Aşama: Derleme (Heavyweight SDK) - Sürüm 10.0'a yükseltildi
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Sadece proje dosyasını kopyalayıp bağımlılıkları indiriyoruz (Cache avantajı)
COPY ["KBYTE.csproj", "./"]
RUN dotnet restore "./KBYTE.csproj"

# Kalan tüm kodları kopyalayıp yayına (Release) hazırlıyoruz
COPY . .
RUN dotnet publish "KBYTE.csproj" -c Release -o /app/publish

# 2. Aşama: Çalıştırma (Lightweight Runtime) - Sürüm 10.0'a yükseltildi
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

# İlk aşamada derlenen dosyaları temiz imaja kopyalıyoruz
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "KBYTE.dll"]