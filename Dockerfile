FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci
RUN npm ci --prefix frontend
RUN npm ci --prefix backend

# Copy source code
COPY . .

# Build frontend
RUN npm run build --prefix frontend

FROM node:22-alpine

WORKDIR /app

# Copy only production dependencies and built code
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --omit=dev --prefix backend

COPY backend ./backend/
COPY --from=builder /app/frontend/dist ./frontend/dist/
COPY scripts ./scripts/

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/app/data/promptshield.db

EXPOSE 8080

USER node
CMD ["npm", "start"]
