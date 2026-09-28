# Production Dockerfile for Spotify Continuous Player
FROM node:18-alpine

WORKDIR /app

# Install dependencies first for Docker caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY src/ ./src/
COPY public/ ./public/

# Create persistent data directory
RUN mkdir -p /app/data

# Default environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start server
CMD ["node", "src/server.js"]
