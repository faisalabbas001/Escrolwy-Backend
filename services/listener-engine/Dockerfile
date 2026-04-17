# Listener Engine Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/listener-engine/package*.json ./services/listener-engine/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install dependencies (including shared packages)
RUN npm install --workspace=listener-engine --workspace=@escrowly/shared-config

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/

# Build shared-config first
RUN npm run build -w @escrowly/shared-config

# Copy source code
COPY services/listener-engine ./services/listener-engine

# Generate Prisma client
RUN npx prisma generate --schema=services/listener-engine/prisma/schema.prisma

# Build the application
RUN npm run build -w listener-engine

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/listener-engine/package*.json ./services/listener-engine/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install production dependencies only
RUN npm install --workspace=listener-engine --workspace=@escrowly/shared-config --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/listener-engine/dist ./services/listener-engine/dist
COPY --from=builder /app/services/listener-engine/prisma ./services/listener-engine/prisma
COPY --from=builder /app/services/listener-engine/generated ./services/listener-engine/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3003

# Start the application
CMD ["node", "services/listener-engine/dist/main.js"]

