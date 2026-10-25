# Work Task Board

## Development

```bash
pnpm install --frozen-lockfile
```

Start the backend in one terminal:

```bash
pnpm dev
```

Start the frontend in a second terminal:

```bash
pnpm dev:web
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173/board
- Admin: http://localhost:5173/admin

For access from another computer, replace `localhost` in the frontend URL with the host's LAN address. The frontend uses same-origin `/api` requests; Vite proxies them to the local backend on port `4000`.

## Docker

```bash
docker compose up --build -d
```

Open `http://<host-lan-address>:8080/board` or `/admin`. Nginx forwards `/api` requests, including SSE updates, to the `server` service. No API address override is needed for the default Compose deployment.

For a separately hosted API, set `VITE_API_BASE` to its browser-accessible origin before building the frontend. This is a build-time setting, for example `VITE_API_BASE=http://192.168.1.10:4000 docker compose up --build -d`.

## Verification

```bash
pnpm test
pnpm build
```

## Project Notes

- Server notes: [server/README.md](server/README.md)
- Web notes: [web/README.md](web/README.md)
