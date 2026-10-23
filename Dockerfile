# syntax=docker/dockerfile:1

# --- Étape 1 : build (dépendances de dev, compilation client + serveur Nitro) ---
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# --- Étape 2 : exécution (sortie Nitro autonome, sans node_modules du projet) ---
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/breach-academy.db

WORKDIR /app

# Volume SQLite appartenant à l'utilisateur non root `node` fourni par l'image.
RUN mkdir -p /data && chown node:node /data

COPY --from=build --chown=node:node /app/dist/analog ./

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.mjs"]
