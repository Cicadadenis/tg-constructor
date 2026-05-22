FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 py3-pip

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    APP_ENV=production \
    DSL_SANDBOX_MODE=enforced \
    DSL_SANDBOX_NETWORK=none \
    PREVIEW_SANDBOX_NETWORK=none
COPY requirements-bot.txt ./
RUN apk add --no-cache python3 py3-pip bubblewrap util-linux \
  && pip install --break-system-packages --no-cache-dir -r requirements-bot.txt \
  && python3 -m venv /opt/esphome-venv \
  && /opt/esphome-venv/bin/pip install --no-cache-dir esphome
ENV ESPHOME_BIN=/opt/esphome-venv/bin/esphome

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs config.js email.mjs ./
COPY --chown=node:node public ./public
COPY --chown=node:node services ./services
COPY --chown=node:node core ./core
RUN mkdir -p bots uploads/avatars && chown -R node:node /app

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 3001) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
