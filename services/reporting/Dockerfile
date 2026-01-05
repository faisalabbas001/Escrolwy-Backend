# Reporting Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/reporting/package*.json ./services/reporting/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/kafka-core/package*.json ./packages/kafka-core/
COPY packages/kafka-publisher/package*.json ./packages/kafka-publisher/

# Install dependencies (including shared packages)
RUN npm install --workspace=reporting --workspace=@escrowly/shared-config --workspace=@escrowly/kafka-core --workspace=@escrowly/kafka-publisher

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/
COPY packages/kafka-core ./packages/kafka-core/
COPY packages/kafka-publisher ./packages/kafka-publisher/

# Build shared packages
RUN npm run build -w @escrowly/shared-config
RUN npm run build -w @escrowly/kafka-core
RUN npm run build -w @escrowly/kafka-publisher

# Copy source code
COPY services/reporting ./services/reporting

# Generate Prisma client
RUN npx prisma generate --schema=services/reporting/prisma/schema.prisma

# Build the application
RUN npm run build -w reporting

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/reporting/package*.json ./services/reporting/
COPY packages/shared-config/package*.json ./packages/shared-config/
COPY packages/kafka-core/package*.json ./packages/kafka-core/
COPY packages/kafka-publisher/package*.json ./packages/kafka-publisher/

# Install production dependencies only
RUN npm install --workspace=reporting --workspace=@escrowly/shared-config --workspace=@escrowly/kafka-core --workspace=@escrowly/kafka-publisher --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/reporting/dist ./services/reporting/dist
COPY --from=builder /app/services/reporting/prisma ./services/reporting/prisma
COPY --from=builder /app/services/reporting/generated ./services/reporting/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/packages/kafka-core/dist ./packages/kafka-core/dist
COPY --from=builder /app/packages/kafka-publisher/dist ./packages/kafka-publisher/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3007

# Start the application
CMD ["node", "services/reporting/dist/main.js"]
