# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

RUN npm ci

FROM deps AS build

COPY server ./server

RUN npm run build --workspace server

FROM deps AS prod-deps

RUN npm prune --omit=dev \
  && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
ENV WORKBOARD_DB_FILE=/data/workboard.sqlite

WORKDIR /app

RUN mkdir -p /data \
  && chown -R node:node /data /app

COPY --from=prod-deps --chown=node:node /app/package.json ./package.json
COPY --from=prod-deps --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/server/package.json ./server/package.json
COPY --from=build --chown=node:node /app/server/dist ./server/dist

USER node

EXPOSE 4000
VOLUME ["/data"]

CMD ["node", "server/dist/src/index.js"]
