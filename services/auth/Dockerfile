# Auth Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/auth/package*.json ./services/auth/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install dependencies (including shared packages)
RUN npm install --workspace=auth --workspace=@escrowly/shared-config

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/

# Build shared-config first
RUN npm run build -w @escrowly/shared-config

# Copy source code
COPY services/auth ./services/auth

# Generate Prisma client
RUN npx prisma generate --schema=services/auth/prisma/schema.prisma

# Build the application
RUN npm run build -w auth

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/auth/package*.json ./services/auth/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install production dependencies only
RUN npm install --workspace=auth --workspace=@escrowly/shared-config --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/auth/dist ./services/auth/dist
COPY --from=builder /app/services/auth/prisma ./services/auth/prisma
COPY --from=builder /app/services/auth/generated ./services/auth/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "services/auth/dist/main.js"]
