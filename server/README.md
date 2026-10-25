# Server Notes

The server is a Fastify API backed by SQLite. It owns persistence, admin mutations, task instance generation, and the board snapshot consumed by the web app.

## Run

```bash
pnpm --filter ./server dev
```

Useful environment variables:

- `PORT`: API port, default `4000`
- `HOST`: bind host, default `0.0.0.0`
- `WORKBOARD_DB_FILE`: SQLite file path, default `server/db/workboard.sqlite`

## Main Areas

- `src/app.ts`: app wiring, CORS, and route registration.
- `src/db/schema.ts`: SQLite tables and indexes.
- `src/routes/`: REST endpoints for board data, admin data, patrol plans, and task instances.
- `src/domain/`: shared generation and board snapshot rules.

Operation plans and patrol templates both expand template data into concrete task instances. Operation cycles are derived from the latest child task end time (`offsetMinutes + durationMinutes`). Patrol cycle length is derived from the largest patrol cycle day.

## Verification

```bash
pnpm --filter ./server test
pnpm --filter ./server build
```

## Operation Workflow API

- GET /api/admin/operation-board-selection returns the persisted plan ID, name, existence and enabled state. On first initialization only, it picks the first plan ordered by start time descending and name. An initialized null or missing plan never triggers fallback selection.
- PUT /api/admin/operation-board-selection with { planId } saves the global choice independently of enablement and publishes the existing board SSE event.
- POST /api/admin/operation-plans/:id/generate accepts { startAt, cutoffAt, startItemId? }. Datetimes carry +08:00. Recurring plans require a child ID; once plans reject it. The requested cutoff bounds task starts and also determines the generation horizon for finite plans. The plan definition is unchanged. The transaction returns { removed, inserted, skipped }; only generated pending records whose start is at or after the transaction's current time are removed. Protected generation identities are skipped. Definite transaction failures return rolledBack: true; no client write retry is automatic.
- POST /api/admin/operation-plans/:id/items/import accepts { mode: "replace", items: [{ content, offsetMinutes, durationMinutes, sortOrder, extData }] }. All rows are validated before transactional replacement. Scalar extension fields are supported. Existing instance snapshots and generation keys remain unchanged; foreign keys to deleted child rows become null.

The existing single-plan detail endpoints provide all saved details for client-side XLSX serialization; patrol details now include their complete extData. File processing uses the existing lazily loaded browser XLSX dependency. The new board_settings table is added idempotently during normal startup migration.
