# Multi-stage build para otimizar tamanho da imagem
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy other necessary files (se houver)
COPY --from=builder /app/package.json ./package.json

# Create runtime directories
RUN mkdir -p uploads logs

# Add curl for healthcheck
RUN apk add --no-cache curl

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/observability/health || exit 1

# Start the application
CMD ["npm", "run", "start:prod"]

