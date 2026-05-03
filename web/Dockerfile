# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json

RUN npm ci

COPY web ./web

RUN npm run build --workspace web

FROM nginx:1.27-alpine AS runtime

COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
