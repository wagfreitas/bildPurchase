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
FROM public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 AS lambda-adapter

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

# Add curl and CA certs (úteis para healthcheck e outras operações)
RUN apk add --no-cache curl ca-certificates && update-ca-certificates

# AWS Lambda Web Adapter (permite expor HTTP em Lambda usando container)
# Copiamos o binário direto do stage lambda-adapter (ECR público da AWS)
COPY --from=lambda-adapter /lambda-adapter /opt/extensions/aws-lambda-adapter
RUN chmod +x /opt/extensions/aws-lambda-adapter
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_LOG_LEVEL=debug
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/observability/health || exit 1

# Start the application diretamente com Node (mais rápido/estável no Lambda)
CMD ["node", "dist/main"]

