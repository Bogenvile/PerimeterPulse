# ─── Builder Stage ───
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./

# Retry npm install up to 5 times for network resilience
RUN for i in 1 2 3 4 5; do \
      npm install --legacy-peer-deps && break || \
      echo "Retry $i/5..."; sleep 5; \
    done

COPY . .

# Build the Vite + Nitro app
RUN npm run build

# ─── Runner Stage ───
FROM node:20-alpine AS runner

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

# Copy package.json and install only production deps with retry
COPY --chown=nodeapp:nodejs package.json ./

RUN for i in 1 2 3 4 5; do \
      npm install --omit=dev --legacy-peer-deps && npm cache clean --force && break || \
      echo "Retry $i/5..."; sleep 5; \
    done

# Copy nitro build output from builder
COPY --from=builder --chown=nodeapp:nodejs /app/.output ./.output

# Copy public assets if needed
COPY --from=builder --chown=nodeapp:nodejs /app/public ./public

# Copy server directory for runtime
COPY --chown=nodeapp:nodejs server ./server
COPY --chown=nodeapp:nodejs nitro.config.ts ./

# Copy agent updates directory
RUN mkdir -p /app/updates && chown nodeapp:nodejs /app/updates

USER nodeapp

EXPOSE 3000

ENV NITRO_PORT=3000

CMD ["node", ".output/server/index.mjs"]