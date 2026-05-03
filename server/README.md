# Server Notes

The server is a Fastify API backed by SQLite. It owns persistence, admin mutations, task instance generation, and the board snapshot consumed by the web app.

## Run

```bash
npm run dev --workspace server
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
npm run test --workspace server
npm run build --workspace server
```
