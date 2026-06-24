# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

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

# Install dependencies for production runtime.
# Prisma CLI is required at container startup for migrate deploy.
COPY package*.json ./
RUN npm ci

# Copy built application from builder
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docker ./docker
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/prisma.config.ts ./
RUN chmod +x /app/docker/start.sh

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Expose port
EXPOSE 3000

# Start the application (run migrations first, then start)
CMD ["/app/docker/start.sh"]
