# ==========================================
# Stage 1: Build Frontend and Backend
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace and package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY server/prisma/ ./server/prisma/

# Install all dependencies across workspace
RUN npm ci

# Copy server files and compile
COPY server/ ./server/
WORKDIR /app/server
RUN npx prisma generate
RUN npm run build

# Copy client files and build frontend
WORKDIR /app
COPY client/ ./client/
WORKDIR /app/client
RUN npm run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner

# Install postgresql-client for pg_isready and backup utilities
RUN apk add --no-cache postgresql-client bash

WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=4000
ENV CLIENT_DIST_PATH=/app/client/dist

# Copy built artifacts from builder stage
COPY --from=builder /app/package*.json /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/server/package*.json /app/server/
COPY --from=builder /app/server/node_modules /app/server/node_modules
COPY --from=builder /app/server/dist /app/server/dist
COPY --from=builder /app/server/prisma /app/server/prisma
COPY --from=builder /app/client/dist /app/client/dist

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
