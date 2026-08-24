## Production Dockerfile for SvelteKit (Bun runtime)
## - Multi-stage build
## - Builds with: bun run build
## - Runs the adapter-node output with Bun

FROM oven/bun:alpine AS builder
WORKDIR /app

# Copy the full project first so builds work even when bun.lockb isn't present yet.
# (You still get good caching once your app repo is here.)
COPY . .

# Install deps (dev deps included for the build). If a Bun lockfile exists, enforce it.
# Bun v1.3+ uses `bun.lock` (text) by default; older projects may have `bun.lockb`.
RUN if [ -f bun.lock ] || [ -f bun.lockb ]; then bun install --frozen-lockfile; else bun install; fi

# Build the application
RUN bun run build

# ---- runtime image ----
FROM oven/bun:alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Copy only production deps
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production && bun add drizzle-kit dotenv

# Install netcat and su-exec for security and health checks
RUN apk add --no-cache busybox-extras su-exec

# Copy built output
COPY --from=builder /app/build ./build
# Copy drizzle config and scripts for DB management
COPY --from=builder /app/drizzle.config.ts ./
# Copy scripts for DB management
COPY --from=builder /app/scripts ./scripts
# Copy lib for DB schema and scoring logic
COPY --from=builder /app/src/lib ./src/lib

EXPOSE 3000

# Use a shell script as entrypoint to allow DB push and seeding
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Security: Prepare non-root user
RUN addgroup -S paaa && adduser -S paaa -G paaa && \
    chown -R paaa:paaa /app

CMD ["./entrypoint.sh"]
