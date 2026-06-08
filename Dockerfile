# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files & install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy semua source code proyek
COPY . .

# Build React frontend + Nitro server
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Buat grup dan user non-root terlebih dahulu demi keamanan
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

# Install production-only dependencies langsung dengan ownership nodeapp
COPY --chown=nodeapp:nodejs package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Salin hasil build dari stage builder dengan ownership nodeapp
COPY --chown=nodeapp:nodejs --from=builder /app/dist ./dist
COPY --chown=nodeapp:nodejs --from=builder /app/.output ./output
COPY --chown=nodeapp:nodejs --from=builder /app/server ./server
COPY --chown=nodeapp:nodejs --from=builder /app/nitro.config.ts ./

# Pindah ke user non-root sebelum aplikasi dijalankan
USER nodeapp

# Ekspos port aplikasi
EXPOSE 3000

# Health check untuk memastikan container berjalan normal
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Jalankan Nitro server
CMD ["node", "output/server/index.mjs"]