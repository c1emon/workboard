# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

RUN pnpm install --frozen-lockfile --filter ./server...

FROM deps AS build

COPY server ./server

RUN pnpm --filter ./server build

FROM build AS prod-deps

RUN pnpm --filter ./server deploy --prod --legacy /prod/server \
  && pnpm store prune

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
ENV WORKBOARD_DB_FILE=/data/workboard.sqlite

WORKDIR /app

RUN mkdir -p /data \
  && chown -R node:node /data /app

COPY --from=prod-deps --chown=node:node /prod/server ./
COPY --from=build --chown=node:node /app/server/dist ./dist

USER node

EXPOSE 4000
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
