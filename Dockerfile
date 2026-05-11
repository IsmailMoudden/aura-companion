FROM oven/bun:1.2-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y curl ca-certificates nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_WEB_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_WEB_URL=$VITE_WEB_URL

RUN bun run build

# Runtime — only ship the built output + wrangler
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node_modules/.bin/wrangler", "dev", "--local", "--port", "3000", "--config", "dist/server/wrangler.json"]
