# ─── Stage 1: Frontend Build ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Cache npm install
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Build args for Vite (passed via --build-arg)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_ELEVENLABS_API_KEY
ARG VITE_BRIDGE_SERVER_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_ELEVENLABS_API_KEY=$VITE_ELEVENLABS_API_KEY
ENV VITE_BRIDGE_SERVER_URL=$VITE_BRIDGE_SERVER_URL

COPY . .
RUN npm run build

# ─── Stage 2: Server Build ────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder

WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --legacy-peer-deps

COPY server/ .
RUN npm run build

# ─── Stage 3: Production Image ───────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Server runtime deps only
COPY server/package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

# Compiled server
COPY --from=server-builder /app/server/dist ./dist

# Frontend static files — served by a separate CDN/static host (Vercel/Netlify)
# Uncomment below if you want to serve frontend from the same container via Express static:
# COPY --from=frontend-builder /app/frontend/dist ./public

# Security: non-root user
RUN addgroup -S callflow && adduser -S callflow -G callflow
USER callflow

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
