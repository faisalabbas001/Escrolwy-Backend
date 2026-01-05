# BFF Service Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY services/bff/package*.json ./services/bff/

# Install dependencies
RUN npm install --workspace=bff

# Copy source code
COPY services/bff ./services/bff

# Build the application
RUN npm run build -w bff

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY services/bff/package*.json ./services/bff/

# Install production dependencies only
RUN npm install --workspace=bff --omit=dev

# Copy built application
COPY --from=builder /app/services/bff/dist ./services/bff/dist

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "services/bff/dist/main.js"]

