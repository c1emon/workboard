# Web Notes

The web app is a Vue 3 + Vite client. It provides the board view for daily execution and the admin view for managing schedules, templates, generated instances, leave, and holidays.

## Run

```bash
pnpm dev:web
```

API requests default to same-origin `/api` URLs. During development, Vite proxies them to `http://127.0.0.1:4000`; in the default Compose deployment, Nginx proxies them to `http://server:4000`. Other computers can open the frontend using the host's LAN address without changing API configuration.

For a separately hosted API, set `VITE_API_BASE` to its browser-accessible origin before starting Vite or building the frontend. The value does not include `/api` and is embedded at build time.

## Patrol Excel Import

The first worksheet must start with these headers: `周期第几天`, `时间`, `目标`, `人员`, `车辆`, `其他`. Columns may be reordered, surrounding header whitespace is ignored, and extra columns are ignored. Missing or duplicate required headers are rejected. Empty optional values are preserved as empty strings, blank rows are skipped, and validation errors use the worksheet's original row numbers.

## Main Areas

- `src/views/BoardView.vue`: execution board page.
- `src/views/AdminView.vue`: admin shell and module switching.
- `src/components/admin/`: admin forms, tables, dialogs, and module panels.
- `src/composables/admin/`: admin state and workflow logic.
- `src/api/client.ts`: typed API calls shared by the views and composables.

Keep UI state in composables when it is shared across controls or modals. Keep presentational details inside components and shared admin CSS files.

## Verification

```bash
pnpm --filter ./web test
pnpm --filter ./web build
```
