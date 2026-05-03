# Web Notes

The web app is a Vue 3 + Vite client. It provides the board view for daily execution and the admin view for managing schedules, templates, generated instances, leave, and holidays.

## Run

```bash
npm run dev --workspace web
```

The API base URL defaults to `http://localhost:4000`. Override it with `VITE_API_BASE` when the server runs elsewhere.

## Main Areas

- `src/views/BoardView.vue`: execution board page.
- `src/views/AdminView.vue`: admin shell and module switching.
- `src/components/admin/`: admin forms, tables, dialogs, and module panels.
- `src/composables/admin/`: admin state and workflow logic.
- `src/api/client.ts`: typed API calls shared by the views and composables.

Keep UI state in composables when it is shared across controls or modals. Keep presentational details inside components and shared admin CSS files.

## Verification

```bash
npm run test --workspace web
npm run build --workspace web
```
