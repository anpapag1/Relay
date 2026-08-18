# Relay — single-container build.
#
# The app is two pieces that share one origin in production:
#   1. a static Vite/React SPA (built to /app/dist)
#   2. a zero-dependency Node proxy (compiled to /app/server/dist) that
#      serves both the /api/* routes and the SPA files themselves.
#
# Build:   docker build -t relay .
# Run:     docker run -p 8080:8080 relay

# Stage 1 — build the frontend SPA
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — compile the media/import proxy (plain Node, no runtime deps)
FROM node:20-alpine AS proxy-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
RUN npm ci
COPY server ./server
RUN npm run build --workspace server

# Stage 3 — runtime: one process serves the SPA and the /api proxy
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=frontend-build /app/dist ./dist
COPY --from=proxy-build /app/server/dist ./server-dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" || exit 1
CMD ["node", "server-dist/index.js"]