# Notification Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/notification/package*.json ./services/notification/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install dependencies (including shared packages)
RUN npm install --workspace=notification --workspace=@escrowly/shared-config

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/

# Build shared-config first
RUN npm run build -w @escrowly/shared-config

# Copy source code
COPY services/notification ./services/notification

# Generate Prisma client
RUN npx prisma generate --schema=services/notification/prisma/schema.prisma

# Build the application
RUN npm run build -w notification

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/notification/package*.json ./services/notification/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install production dependencies only
RUN npm install --workspace=notification --workspace=@escrowly/shared-config --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/notification/dist ./services/notification/dist
COPY --from=builder /app/services/notification/prisma ./services/notification/prisma
COPY --from=builder /app/services/notification/generated ./services/notification/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3004

# Start the application
CMD ["node", "services/notification/dist/main.js"]

