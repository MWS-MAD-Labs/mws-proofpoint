# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY src/lib/database-url.ts ./src/lib/database-url.ts

# Build-time placeholders. Real runtime values must be injected by deployment.
ENV DATABASE_URL="postgresql://proofpoint:proofpoint@localhost:5432/proofpoint?schema=public"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="build-time-placeholder-change-at-runtime"

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache curl

# Copy the standalone application and its traced runtime dependencies.
COPY --from=builder /app/.next/standalone ./

# Install only the migration tooling needed at container startup. The standalone
# output already includes application dependencies such as pg.
RUN npm install --prefix /opt/prisma-runtime --no-save --no-audit --no-fund \
    prisma@7.4.0 dotenv@17.2.3 \
    && ln -s /opt/prisma-runtime/node_modules/prisma /app/node_modules/prisma \
    && ln -s /opt/prisma-runtime/node_modules/dotenv /app/node_modules/dotenv
ENV PATH="/opt/prisma-runtime/node_modules/.bin:${PATH}"
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker ./docker
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/src/lib/database-url.ts ./src/lib/database-url.ts
RUN chmod +x /app/docker/start.sh

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose port
EXPOSE 3000

# Start the application (run migrations first, then start)
CMD ["/app/docker/start.sh"]
