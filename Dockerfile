# Stage 1: Build the frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine
WORKDIR /app

# Copy built output and server
COPY --from=builder /app/.output /app/.output
COPY --from=builder /app/package.json /app/package.json

ENV NITRO_PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
