# ── Stage 1: Build frontend ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files & install all dependencies (dev included for build)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Copy seluruh source code
COPY . .

# Build frontend ke dist/
RUN npm run build

# ── Stage 2: Production runtime ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

# Copy package.json & install hanya production dependencies
COPY --chown=nodeapp:nodejs package.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Copy hasil build dan server code dari builder
COPY --from=builder --chown=nodeapp:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/server ./server
COPY --from=builder --chown=nodeapp:nodejs /app/nitro.config.ts ./nitro.config.ts
COPY --from=builder --chown=nodeapp:nodejs /app/vite.config.ts ./vite.config.ts
COPY --from=builder --chown=nodeapp:nodejs /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder --chown=nodeapp:nodejs /app/postcss.config.js ./postcss.config.js
COPY --from=builder --chown=nodeapp:nodejs /app/components.json ./components.json
COPY --from=builder --chown=nodeapp:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nodeapp:nodejs /app/tsconfig.app.json ./tsconfig.app.json
COPY --from=builder --chown=nodeapp:nodejs /app/tsconfig.node.json ./tsconfig.node.json
COPY --from=builder --chown=nodeapp:nodejs /app/index.html ./index.html

# Copy public assets
COPY --from=builder --chown=nodeapp:nodejs /app/public ./public

# Set environment
ENV NODE_ENV=production
ENV NITRO_PORT=3000

EXPOSE 3000

USER nodeapp

# Jalankan Nitro server (production mode)
CMD ["node", "dist/index.mjs"]