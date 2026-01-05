# Wallet Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/wallet/package*.json ./services/wallet/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/kafka-core/package*.json ./packages/kafka-core/
COPY packages/kafka-publisher/package*.json ./packages/kafka-publisher/

# Install dependencies (including shared packages)
RUN npm install --workspace=wallet --workspace=@escrowly/shared-config --workspace=@escrowly/kafka-core --workspace=@escrowly/kafka-publisher

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/
COPY packages/kafka-core ./packages/kafka-core/
COPY packages/kafka-publisher ./packages/kafka-publisher/

# Build shared packages first
RUN npm run build -w @escrowly/shared-config || true
RUN npm run build -w @escrowly/kafka-core || true
RUN npm run build -w @escrowly/kafka-publisher || true

# Copy source code
COPY services/wallet ./services/wallet

# Generate Prisma client
RUN npx prisma generate --schema=services/wallet/prisma/schema.prisma

# Build the application
RUN npm run build -w wallet

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/wallet/package*.json ./services/wallet/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/kafka-core/package*.json ./packages/kafka-core/
COPY packages/kafka-publisher/package*.json ./packages/kafka-publisher/

# Install production dependencies only
RUN npm install --workspace=wallet --workspace=@escrowly/shared-config --workspace=@escrowly/kafka-core --workspace=@escrowly/kafka-publisher --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/wallet/dist ./services/wallet/dist
COPY --from=builder /app/services/wallet/prisma ./services/wallet/prisma
COPY --from=builder /app/services/wallet/generated ./services/wallet/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/packages/kafka-core/dist ./packages/kafka-core/dist
COPY --from=builder /app/packages/kafka-publisher/dist ./packages/kafka-publisher/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3004

# Start the application
CMD ["node", "services/wallet/dist/main.js"]

