# Admin Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/admin/package*.json ./services/admin/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install dependencies (including shared packages)
RUN npm install --workspace=admin --workspace=@escrowly/shared-config

# Copy shared packages source
COPY packages/shared-config ./packages/shared-config/

# Build shared-config first
RUN npm run build -w @escrowly/shared-config

# Copy source code
COPY services/admin ./services/admin

# Generate Prisma client
RUN npx prisma generate --schema=services/admin/prisma/schema.prisma

# Build the application
RUN npm run build -w admin

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/admin/package*.json ./services/admin/
COPY packages/shared-config/package*.json ./packages/shared-config/

# Install production dependencies only
RUN npm install --workspace=admin --workspace=@escrowly/shared-config --omit=dev

# Copy built application and shared packages
COPY --from=builder /app/services/admin/dist ./services/admin/dist
COPY --from=builder /app/services/admin/prisma ./services/admin/prisma
COPY --from=builder /app/services/admin/generated ./services/admin/generated
COPY --from=builder /app/packages/shared-config/dist ./packages/shared-config/dist
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3002

# Start the application
CMD ["node", "services/admin/dist/main.js"]
