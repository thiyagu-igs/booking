# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd frontend && npm ci --only=production && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm ci
RUN cd frontend && npm ci

# Copy source code
COPY . .

# Build backend
RUN npm run build

# Build frontend with optimized Tailwind CSS
RUN cd frontend && npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 waitlist

# Copy built application
COPY --from=builder --chown=waitlist:nodejs /app/dist ./dist
COPY --from=builder --chown=waitlist:nodejs /app/frontend/dist ./frontend/dist
COPY --from=deps --chown=waitlist:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=waitlist:nodejs /app/package.json ./package.json

# Copy database migrations
COPY --from=builder --chown=waitlist:nodejs /app/src/database/migrations ./src/database/migrations
COPY --from=builder --chown=waitlist:nodejs /app/knexfile.js ./knexfile.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER waitlist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]