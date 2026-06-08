# ── Stage 1: Build frontend & Nitro server ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# ── Stage 2: Production runtime ──────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

COPY --chown=nodeapp:nodejs package.json ./

RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy hasil build Nitro (.output) dari builder
COPY --from=builder --chown=nodeapp:nodejs /app/.output ./.output
COPY --from=builder --chown=nodeapp:nodejs /app/server ./server
COPY --from=builder --chown=nodeapp:nodejs /app/nitro.config.ts ./nitro.config.ts

USER nodeapp

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]