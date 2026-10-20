# Stage: Lightweight Node.js 20 runtime
FROM node:20-alpine

WORKDIR /app

# Copy package definitions first to utilize Docker layer caching
COPY package*.json ./

# Install all dependencies (including tsx to execute server.ts)
RUN npm ci

# Copy the remaining server source code
COPY . .

# Expose backend API port
EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

# Health check to verify API responsiveness
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start server using tsx
CMD ["npm", "start"]