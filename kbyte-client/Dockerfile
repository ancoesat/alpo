# 1. Aşama: Temel Node.js İmajı
FROM node:20-alpine AS base

# 2. Aşama: Bağımlılıkların Kurulumu
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 3. Aşama: Uygulamanın Derlenmesi
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Gereksiz telemetri verilerini kapatıyoruz
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 4. Aşama: Sadece Çalıştırma (Hafif ve Güvenli)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

# Standalone modunun ürettiği optimize dosyaları kopyalıyoruz
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENTRYPOINT ["node", "server.js"]