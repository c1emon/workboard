# Patrol Instance Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace board-time template expansion with generated task instances, while preserving board visual styling.

**Architecture:** Replace `task_containers` and `task_items` with clearer `task_templates` and `task_template_items` tables because the records become generation templates, not displayed tasks. Add `task_instances` as the display source, add an idempotent generation domain, then switch board snapshot queries to instance records. Admin UI gains separate instance management and patrol template management without redesigning the board surface.

**Tech Stack:** Fastify, SQLite via `better-sqlite3`, Zod, Vitest, Vue 3 Composition API, Vue Test Utils, TypeScript.

---

## File Structure

- Modify `server/src/db/schema.ts`: replace `task_containers`/`task_items` with `task_templates`/`task_template_items`, then add `task_instances` and indexes.
- Move/replace `server/src/domain/taskExpansion.ts` as `server/src/domain/templateExpansion.ts`: template recurrence expansion helpers with `TaskTemplate` and `TaskTemplateItemInput` naming.
- Create `server/src/domain/taskInstances.ts`: shared instance row types, metadata parsing, source/status constants, and row mapping.
- Create `server/src/domain/taskInstanceGeneration.ts`: idempotent generation for one-time, simple recurrence, and patrol cycle templates.
- Modify `server/src/domain/boardSnapshot.ts`: read operation, permit, patrol, and other display data from `task_instances`; keep response shapes and board-facing sorting stable.
- Modify `server/src/routes/admin.ts`: update operation plan routes to read/write `task_templates` and `task_template_items`; remove old patrol arrangement route handlers and old generic task container/item endpoints after replacement routes are wired.
- Create `server/src/routes/taskInstances.ts`: instance CRUD and generation endpoint.
- Create `server/src/routes/patrolPlans.ts`: patrol template CRUD and cycle item CRUD.
- Modify `server/src/app.ts`: register new route modules.
- Modify `server/tests/schema.test.ts`: assert new table and indexes exist.
- Move/replace `server/tests/taskExpansion.test.ts` as `server/tests/templateExpansion.test.ts`: recurrence expansion tests using template naming.
- Create `server/tests/taskInstanceGeneration.test.ts`: generation domain tests.
- Modify `server/tests/boardSnapshot.test.ts`: assert board snapshot uses instances.
- Modify `server/tests/adminRoutes.test.ts`: admin API tests for instances and patrol plans.
- Modify `web/src/api/client.ts`: add instance, patrol plan, and operation child item API client types/functions; remove old generic task container/item client functions.
- Modify `web/src/composables/admin/types.ts`: add instance/template view state types as needed.
- Modify `web/src/composables/admin/useAdminViewModel.ts`: load new patrol instance/template sections.
- Modify `web/src/composables/admin/useArrangementAdmin.ts`: remove patrol-specific state and actions while keeping permit, other, and leave behavior.
- Modify `web/src/composables/admin/useOperationAdmin.ts`: replace generic task item client calls with operation plan item client calls.
- Create `web/src/composables/admin/useTaskInstanceAdmin.ts`: instance list, manual create, edit, cancel, regenerate orchestration.
- Create `web/src/composables/admin/usePatrolPlanAdmin.ts`: patrol plan and 90-day cycle item orchestration.
- Create `web/src/components/admin/TaskInstanceManager.vue`: date-based instance management table.
- Create `web/src/components/admin/PatrolPlanManager.vue`: patrol template list and cycle item editor.
- Modify `web/src/views/AdminView.vue`: show patrol instance/template tabs or sections.
- Modify `web/tests/AdminView.test.ts`: update admin behavior tests.
- Create `web/tests/TaskInstanceManager.test.ts`: instance UI tests.
- Create `web/tests/PatrolPlanManager.test.ts`: patrol template UI tests.
- Do not modify board CSS files unless a test proves a data-only mapping needs a class hook. Avoid changing `web/src/styles.css`, `web/src/views/BoardView.vue` styles, and existing board component scoped styles.
- Do not implement data migration, backfill preservation, or compatibility wrappers. Existing local development data may be recreated.

---

## Task 1: Rename Template Tables And Add Instance Schema

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/tests/schema.test.ts`

- [x] **Step 1: Write schema test**

Add assertions that:

- `task_templates` exists and has `ext_data_json`.
- `task_template_items` exists and references `task_templates(id)` through `template_id`.
- `task_instances` exists.
- `task_instances.template_id` references `task_templates(id)`.
- `task_instances.source_template_item_id` references `task_template_items(id)`.
- `task_instances_generation_key_unique` exists.

Run:

```bash
npm run test --workspace server -- schema.test.ts
```

Expected: FAIL because the new template and instance tables do not exist.

- [x] **Step 2: Replace old template tables and add `task_instances` schema**

Because this is a non-production reset, replace the old `task_containers` and `task_items` schema definitions with `task_templates` and `task_template_items`.

```sql
drop table if exists task_items;
drop table if exists task_containers;

create table if not exists task_templates (
  id text primary key,
  type text not null check (type in ('operation', 'permit', 'patrol', 'other')),
  name text not null,
  description text not null default '',
  start_at text not null,
  end_at text not null,
  recurrence_type text not null check (recurrence_type in ('once', 'finite', 'infinite')),
  recurrence_interval_minutes integer,
  recurrence_count integer,
  skip_weekends integer not null default 0,
  skip_holidays integer not null default 0,
  enabled integer not null default 1,
  ext_data_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create table if not exists task_template_items (
  id text primary key,
  template_id text not null references task_templates(id) on delete cascade,
  offset_minutes integer not null,
  duration_minutes integer not null,
  content text not null default '',
  ext_data_json text not null default '{}',
  sort_order integer not null default 0
);
```

The drop statements are intentional for existing local development databases. There is no production data migration or backfill requirement for this refactor.

Add the `task_instances` table from the spec to `schemaSql`, plus indexes:

```sql
create index if not exists task_instances_date_type_idx on task_instances (occurrence_date, type);
create index if not exists task_instances_time_idx on task_instances (start_at, end_at);
create unique index if not exists task_instances_generation_key_unique on task_instances (generation_key) where generation_key is not null;
```

- [x] **Step 3: Verify schema**

Run:

```bash
npm run test --workspace server -- schema.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add server/src/db/schema.ts server/tests/schema.test.ts
git commit -m "feat: add template and instance schema"
```

## Task 2: Build Instance Generation Domain

**Files:**
- Move/replace: `server/src/domain/taskExpansion.ts` -> `server/src/domain/templateExpansion.ts`
- Create: `server/src/domain/taskInstances.ts`
- Create: `server/src/domain/taskInstanceGeneration.ts`
- Move/replace: `server/tests/taskExpansion.test.ts` -> `server/tests/templateExpansion.test.ts`
- Create: `server/tests/taskInstanceGeneration.test.ts`

- [x] **Step 1: Rename expansion tests and imports**

Rename the existing recurrence expansion test file to `server/tests/templateExpansion.test.ts`.

Update imports and type names in that test file:

- `taskExpansion` module path becomes `templateExpansion`.
- `TaskContainer` becomes `TaskTemplate`.
- `TaskItemInput` becomes `TaskTemplateItemInput`.

Run:

```bash
npm run test --workspace server -- templateExpansion.test.ts
```

Expected: FAIL because `server/src/domain/templateExpansion.ts` does not exist yet.

- [x] **Step 2: Rename expansion domain**

Replace `server/src/domain/taskExpansion.ts` with `server/src/domain/templateExpansion.ts`.

Use template naming in the exported types:

```ts
export interface TaskTemplate {
  id: string;
  type: "operation" | "permit" | "patrol" | "other";
  name: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number | null;
  recurrenceCount: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface TaskTemplateItemInput {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content?: string;
  metadata: Record<string, unknown>;
  sortOrder?: number;
}
```

Keep the existing recurrence behavior, holiday behavior, weekend behavior, and `validateTaskItem` validation semantics.

- [x] **Step 3: Verify renamed expansion tests**

Run:

```bash
npm run test --workspace server -- templateExpansion.test.ts
```

Expected: PASS.

- [x] **Step 4: Write generation tests**

Cover these cases in `server/tests/taskInstanceGeneration.test.ts`:

- Generates one-time task instances once.
- Generates simple daily recurrence instances.
- Generates patrol cycle day 1, day 2, and wraps day 90 to day 1.
- Maps patrol `timeTag` through `timeRangeForDateTag`.
- Skips holidays without consuming patrol cycle day.
- Skips weekends when `skip_weekends = true`.
- Does not skip adjusted workdays when they fall on weekends.
- Keeps cross-day items intact if occurrence start date is not a holiday.
- Does not overwrite manual instances.
- Re-running generation does not duplicate generated instances.
- Disabled templates produce no instances.
- A patrol date with no matching `cycleDay` item produces no instances.
- A template whose `start_at` is after `windowEndDate` produces no instances.
- Generation works across month and year boundaries.
- Operation generation creates instances for adjacent dates when the requested window covers the board's `now - 24h` through `now + 24h` operation context.

Run:

```bash
npm run test --workspace server -- taskInstanceGeneration.test.ts
```

Expected: FAIL because the generation module does not exist.

- [x] **Step 5: Implement instance helpers**

Create shared constants and helpers:

```ts
export const taskInstanceSources = ["generated", "manual", "override"] as const;
export const taskInstanceStatuses = ["pending", "in_progress", "done", "cancelled"] as const;
export type TaskInstanceSource = (typeof taskInstanceSources)[number];
export type TaskInstanceStatus = (typeof taskInstanceStatuses)[number];
```

Include JSON metadata parsing that returns `{}` for invalid or non-object JSON.

- [x] **Step 6: Implement idempotent generation**

Implement a function shaped like:

```ts
export function generateTaskInstances(
  db: AppDatabase,
  input: { windowStartDate: string; windowEndDate: string; types?: Array<"operation" | "permit" | "patrol" | "other">; refreshPending?: boolean }
): { inserted: number; updated: number; skipped: number };
```

Use `generation_key = templateId + ":" + templateItemId + ":" + occurrenceStartAt`.

Treat `generation_key` as an opaque string and do not parse it; ISO timestamps contain `:`.

Load `holidays` inside the generation module. Use `type = 'holiday'` for holiday skipping and `type = 'adjusted_workday'` to override weekend skipping.

For patrol cycle generation:

- Read `cycleLength` from `task_templates.ext_data_json`, defaulting to `90`.
- Read `cycleDay` and `timeTag` from `task_template_items.ext_data_json`.
- Choose only items matching the effective non-holiday, non-skipped-weekend patrol day.
- Resolve patrol instance `startAt` and `endAt` with `timeRangeForDateTag(occurrenceDate, timeTag)`.
- Copy `timeTag`, `target`, `personnel`, `vehicle`, `other`, and `cycleDay` into instance `ext_data_json`.

- [x] **Step 7: Verify generation**

Run:

```bash
npm run test --workspace server -- templateExpansion.test.ts taskInstanceGeneration.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add -A server/src/domain/taskExpansion.ts server/src/domain/templateExpansion.ts server/src/domain/taskInstances.ts server/src/domain/taskInstanceGeneration.ts server/tests/taskExpansion.test.ts server/tests/templateExpansion.test.ts server/tests/taskInstanceGeneration.test.ts
git commit -m "feat: generate task instances from templates"
```

## Task 3: Switch Board Snapshot To Instances

**Files:**
- Modify: `server/src/domain/boardSnapshot.ts`
- Modify: `server/tests/boardSnapshot.test.ts`

- [x] **Step 1: Write board snapshot tests**

Add tests that insert `task_instances` directly and assert:

- Patrols render from instances.
- Manual patrol instances render with generated instances.
- Template rows without generated instances do not render.
- Board response shape remains unchanged.
- Operation instances use the current `now - 24h` through `now + 24h` window.
- Permit, patrol, and other instances use the selected China date window.

Run:

```bash
npm run test --workspace server -- boardSnapshot.test.ts
```

Expected: FAIL because board snapshot still expands templates.

- [x] **Step 2: Replace board display source**

Load instances whose `start_at/end_at` intersect the correct board window:

- Operations: `new Date(now.getTime() - 24 * 60 * 60_000)` through `new Date(now.getTime() + 24 * 60 * 60_000)`.
- Permits, patrols, and others: `${date}T00:00:00+08:00` through `${date}T23:59:59.999+08:00`.

Map `ext_data_json` into the same API fields used today:

- Patrol and permit: `timeTag`, `target`, `personnel`, `vehicle`, `other`.
- Other: `timeTag`, `target` as display task fallback, `personnel`, `vehicle`, `other`.
- Operation: `content`, `startAt`, `endAt`, `metadata`.

Important constraint: do not change board frontend styles or board response field names.

Remove the old template-expansion read path from `server/src/domain/boardSnapshot.ts` in this same task. After the switch, the file should no longer contain:

- `expandContainer` imports
- `loadTaskContainers`
- `loadTaskItems`
- `expandArrangementContainers`
- `TaskContainerRow`
- `TaskItemRow`
- `SnapshotTaskItem`
- `ExpandedArrangementItem`

- [x] **Step 3: Verify board tests**

Run:

```bash
npm run test --workspace server -- boardSnapshot.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add server/src/domain/boardSnapshot.ts server/tests/boardSnapshot.test.ts
git commit -m "feat: read board data from task instances"
```

## Parallel Work Note

After Task 3, Tasks 4, 5, 6, and 7 can be split across separate workers because the instance API contract, operation remap contract, patrol plan API contract, and frontend API client can be implemented from the written spec. If multiple workers run in parallel, keep most write ownership disjoint and coordinate the small integration files:

- Task 4 owns `server/src/routes/taskInstances.ts` and instance route tests.
- Task 5 owns operation route remapping in `server/src/routes/admin.ts` and related route tests.
- Task 6 owns `server/src/routes/patrolPlans.ts` and patrol plan route tests.
- Task 7 owns `web/src/api/client.ts` and `web/tests/client.test.ts`.
- The parent session or final landing worker owns `server/src/app.ts` registration if parallel patches would otherwise conflict.

## Task 4: Add Admin Instance APIs

**Files:**
- Create: `server/src/routes/taskInstances.ts`
- Modify: `server/src/app.ts`
- Modify: `server/tests/adminRoutes.test.ts`

- [x] **Step 1: Write admin route tests**

Add tests for:

- `GET /api/admin/task-instances?date=YYYY-MM-DD&type=patrol`
- `POST /api/admin/task-instances` creates manual instance.
- `PUT /api/admin/task-instances/:id` edits pending/manual instance.
- `PATCH /api/admin/task-instances/:id/status` cancels an instance.
- `POST /api/admin/task-instances/generate` runs idempotent future generation.

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: FAIL with 404 for new endpoints.

- [x] **Step 2: Implement route module**

Use Zod validation for:

- date in `YYYY-MM-DD`
- valid `type`
- `startAt < endAt`
- source and status enums
- metadata object
- source type values `generated`, `manual`, and `override`

Publish board events after successful create, update, status change, delete, and generation.

- [x] **Step 3: Register routes**

Register the module in `server/src/app.ts`.

- [x] **Step 4: Verify routes**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/routes/taskInstances.ts server/src/app.ts server/tests/adminRoutes.test.ts
git commit -m "feat: add task instance admin APIs"
```

## Task 4.5: Remap Permit And Other Arrangement APIs To Instances

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/tests/adminRoutes.test.ts`

- [x] **Step 1: Restore permit/other admin tests**

Restore the existing permit, other, leave, and board exposure tests that should remain valid after the instance-backed board switch.

Keep operation and old patrol/generic task tests available for Tasks 5, 6, and 9, but do not hide permit/other behavior behind unconditional skips.

- [x] **Step 2: Store permit/other arrangements as manual instances**

Update permit and other arrangement routes in `server/src/routes/admin.ts` so they use `task_instances` directly:

- `POST /api/admin/permit-arrangements`
- `PUT /api/admin/permit-arrangements/:id`
- `PATCH /api/admin/permit-arrangements/:id/enabled`
- `DELETE /api/admin/permit-arrangements/:id`
- Existing list helpers for permit/other arrangements

Use `source_type = 'manual'`, `generation_key = null`, and map the existing time tag metadata into `task_instances.ext_data_json`. Treat disabled rows as `status = 'cancelled'` so the board can omit them without needing an `enabled` column on instances.

- [x] **Step 3: Verify permit/other routes**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: permit, other, leave, holiday, and task instance tests pass without skip. Operation and old patrol/generic tests may remain pending until their owning tasks.

---

## Task 5: Remap Operation Plan APIs To Template Storage

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/tests/adminRoutes.test.ts`

- [x] **Step 1: Write operation remap tests**

Cover:

- Existing operation plan APIs read/write `task_templates` and `task_template_items`.
- Operation plan detail returns ordered template items.
- Operation child items can be created, updated, and deleted through operation-specific endpoints instead of generic task item endpoints.
- `PUT /api/admin/operation-plans/:id/items/:itemId` verifies the item belongs to the operation plan in the URL.

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: FAIL because operation routes still query old table names or operation child endpoints do not exist.

- [x] **Step 2: Remap operation plan storage**

Update existing operation plan routes in `server/src/routes/admin.ts`:

- `/api/admin/operation-plans` list/detail/create/update/enable/delete should use `task_templates`.
- Operation child item reads and writes should use `task_template_items`.
- Existing row interfaces should use template naming where practical.

Add operation child item endpoints:

```http
POST /api/admin/operation-plans/:id/items
PUT /api/admin/operation-plans/:id/items/:itemId
DELETE /api/admin/operation-plans/:id/items/:itemId
```

These operation child endpoints replace old generic `/api/admin/task-items` usage.

- [x] **Step 3: Verify operation remap**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: PASS for operation route tests.

- [x] **Step 4: Commit**

```bash
git add server/src/routes/admin.ts server/tests/adminRoutes.test.ts
git commit -m "refactor: remap operation plans to templates"
```

## Task 6: Add Patrol Template APIs

**Files:**
- Create: `server/src/routes/patrolPlans.ts`
- Modify: `server/src/app.ts`
- Modify: `server/tests/adminRoutes.test.ts`

- [x] **Step 1: Write patrol plan API tests**

Cover:

- Create patrol plan with cycle length 90.
- Store cycle length in `task_templates.ext_data_json`.
- Add cycle item with `cycleDay`.
- Reject `cycleDay < 1`.
- Reject `cycleDay > cycleLength`.
- Persist `skipWeekends` with default `false` and `skipHolidays` with default `true`.
- Reject duplicate cycle item for the same plan, `cycleDay`, and `sortOrder` combination.
- Fetch plan detail with ordered cycle items.
- Delete plan cascades template items. Generated/manual instances may remain as source snapshots with nullable source references.

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: FAIL with 404 for patrol plan endpoints.

- [x] **Step 2: Implement patrol plan routes**

Implement:

```http
GET /api/admin/patrol-plans
GET /api/admin/patrol-plans/:id
POST /api/admin/patrol-plans
PUT /api/admin/patrol-plans/:id
PATCH /api/admin/patrol-plans/:id/enabled
DELETE /api/admin/patrol-plans/:id
POST /api/admin/patrol-plans/:id/items
PUT /api/admin/patrol-plans/:id/items/:itemId
DELETE /api/admin/patrol-plans/:id/items/:itemId
```

Store patrol item fields in `task_template_items.content` and `ext_data_json`.

Use this patrol item metadata shape:

```json
{
  "cycleDay": 1,
  "timeTag": "上午",
  "target": "罐区",
  "personnel": "张三",
  "vehicle": "1号车",
  "other": "携带测温仪"
}
```

- [x] **Step 3: Verify patrol APIs**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add server/src/routes/patrolPlans.ts server/src/app.ts server/tests/adminRoutes.test.ts
git commit -m "feat: add patrol template admin APIs"
```

## Task 7: Add Frontend API Client

**Files:**
- Modify: `web/src/api/client.ts`
- Modify: `web/tests/client.test.ts`

- [x] **Step 1: Write client tests**

Assert URLs and payloads for task instances, generation, patrol plans, patrol cycle item CRUD, and operation child item CRUD.

Run:

```bash
npm run test --workspace web -- client.test.ts
```

Expected: FAIL because functions do not exist.

- [x] **Step 2: Add client types and functions**

Add types for:

- `TaskInstanceRecord`
- `TaskInstanceInput`
- `PatrolPlanRecord`
- `PatrolPlanDetail`
- `PatrolCycleItemRecord`

`PatrolPlanRecord` and `PatrolPlanDetail` must include `cycleLength`, `skipWeekends`, `skipHolidays`, and `enabled`.

Add fetch/create/update/delete/generate functions matching backend routes.

Replace old generic task client functions:

- Remove `createTaskContainer`.
- Remove `createTaskItem`.
- Remove `deleteTaskItem`.
- Add `createOperationPlanItem`.
- Add `updateOperationPlanItem`.
- Add `deleteOperationPlanItem`.

- [x] **Step 3: Verify client tests**

Run:

```bash
npm run test --workspace web -- client.test.ts
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add web/src/api/client.ts web/tests/client.test.ts
git commit -m "feat: add task instance client APIs"
```

## Task 8: Build Admin Instance And Patrol Template UI

**Files:**
- Create: `web/src/composables/admin/useTaskInstanceAdmin.ts`
- Create: `web/src/composables/admin/usePatrolPlanAdmin.ts`
- Create: `web/src/components/admin/TaskInstanceManager.vue`
- Create: `web/src/components/admin/PatrolPlanManager.vue`
- Modify: `web/src/views/AdminView.vue`
- Modify: `web/src/composables/admin/useAdminViewModel.ts`
- Modify: `web/src/composables/admin/useArrangementAdmin.ts`
- Modify: `web/src/composables/admin/useOperationAdmin.ts`
- Create: `web/tests/TaskInstanceManager.test.ts`
- Create: `web/tests/PatrolPlanManager.test.ts`
- Modify: `web/tests/AdminView.test.ts`
- Delete: `web/src/components/admin/PatrolManager.vue`

- [x] **Step 1: Write UI tests**

Cover:

- Patrol section exposes instance and template management.
- Instance manager lists selected-date instances.
- Manual instance save calls `createTaskInstance`.
- Regenerate action asks for confirmation.
- Patrol plan manager shows cycle day rows and saves item edits.

Run:

```bash
npm run test --workspace web -- TaskInstanceManager.test.ts PatrolPlanManager.test.ts AdminView.test.ts
```

Expected: FAIL because components do not exist or AdminView still uses old patrol arrangement UI.

- [x] **Step 2: Implement composables**

Follow existing admin composable patterns:

- `withStatus` wraps async operations.
- `requestConfirmation` protects destructive or regeneration actions.
- `refresh` reloads active lists.

In `web/src/composables/admin/useArrangementAdmin.ts`, keep permit, other, and leave behavior. Remove only patrol-specific state and actions:

- Remove imports for `createPatrolArrangement`, `deletePatrolArrangement`, `fetchPatrolArrangements`, `PatrolArrangementRecord`, `updatePatrolArrangement`, and `updatePatrolArrangementEnabled`.
- Remove `patrolRows` and `patrolShowAll`.
- Remove `loadPatrolRows`.
- Remove `openPatrolModal`.
- Remove the `modalKind.value === "patrol"` branch from `saveModal`.
- Remove `togglePatrol`.
- Remove `removePatrol`.
- Remove those removed symbols from the returned object.

In `web/src/composables/admin/useOperationAdmin.ts`, keep the current operation management behavior but replace generic task item client calls:

- `createTaskItem` becomes `createOperationPlanItem`.
- `deleteTaskItem` becomes `deleteOperationPlanItem`.
- Any future item edit path should use `updateOperationPlanItem`.
- Payloads should use the selected operation plan id from the route path, not a generic `containerId` field.

- [x] **Step 3: Implement components**

Reuse existing admin visual primitives:

- `ListHeader.vue`
- `DateToolbar.vue`
- `ConfirmationDialog.vue`
- `managerStyles.css`
- `modalStyles.css`

Do not introduce board-specific style changes.

- [x] **Step 4: Wire AdminView**

Replace the patrol arrangement section with patrol instance/template sections while keeping other admin modules stable.

Delete `web/src/components/admin/PatrolManager.vue` in this task after `AdminView.vue` no longer imports or renders it. This keeps the buildable state clean before the later old-path cleanup verification.

- [x] **Step 5: Verify UI tests**

Run:

```bash
npm run test --workspace web -- TaskInstanceManager.test.ts PatrolPlanManager.test.ts AdminView.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add -A web/src/composables/admin/useTaskInstanceAdmin.ts web/src/composables/admin/usePatrolPlanAdmin.ts web/src/components/admin/TaskInstanceManager.vue web/src/components/admin/PatrolPlanManager.vue web/src/components/admin/PatrolManager.vue web/src/views/AdminView.vue web/src/composables/admin/useAdminViewModel.ts web/src/composables/admin/useArrangementAdmin.ts web/src/composables/admin/useOperationAdmin.ts web/tests/TaskInstanceManager.test.ts web/tests/PatrolPlanManager.test.ts web/tests/AdminView.test.ts
git commit -m "feat: split patrol admin into instances and templates"
```

## Task 9: Remove Old Patrol And Generic Task Paths

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/tests/adminRoutes.test.ts`
- Modify: `web/src/api/client.ts`
- Modify: `web/tests/client.test.ts`
- Modify: `web/src/views/AdminView.vue`
- Modify: `web/src/composables/admin/useOperationAdmin.ts`
- Modify: `web/tests/AdminView.test.ts`

- [x] **Step 1: Write cleanup verification**

Update tests so no test calls old patrol arrangement APIs or client functions.

Run:

```bash
rg -n "patrol-arrangements|PatrolArrangement|fetchPatrolArrangements|createPatrolArrangement|updatePatrolArrangement|deletePatrolArrangement|openPatrolModal|togglePatrol|removePatrol|task-containers|task-items|createTaskContainer|createTaskItem|deleteTaskItem" server/src server/tests web/src web/tests
```

Expected before cleanup: matches in server routes, server tests, web client, admin view, operation admin, and admin composables.

- [x] **Step 2: Remove server patrol arrangement routes**

Remove these from `server/src/routes/admin.ts`:

- `PatrolArrangementAdminRow`
- `mapPatrolArrangementTaskRow`
- `GET /api/admin/patrol-arrangements`
- `POST /api/admin/patrol-arrangements`
- `PUT /api/admin/patrol-arrangements/:id`
- `PATCH /api/admin/patrol-arrangements/:id/enabled`
- `DELETE /api/admin/patrol-arrangements/:id`
- `POST /api/admin/task-containers`
- `POST /api/admin/task-items`
- `DELETE /api/admin/task-items/:id`

Remove or rewrite tests in `server/tests/adminRoutes.test.ts` that exercise those old endpoints. Keep permit, other, leave, holiday, operation plan, operation child item, and new instance/patrol plan tests.

- [x] **Step 3: Remove frontend patrol arrangement client code**

Remove these from `web/src/api/client.ts`:

- `PatrolArrangementRecord`
- `fetchPatrolArrangements`
- `createPatrolArrangement`
- `updatePatrolArrangement`
- `updatePatrolArrangementEnabled`
- `deletePatrolArrangement`
- `createTaskContainer`
- `createTaskItem`
- `deleteTaskItem`

Update `web/tests/client.test.ts` to assert the new patrol plan, operation child item, and task instance clients instead of old patrol arrangement and generic task URLs.

- [x] **Step 4: Remove unused patrol arrangement UI code**

Remove old patrol arrangement wiring from `web/src/views/AdminView.vue` and `web/tests/AdminView.test.ts`.

Remove generic task item imports and expectations from `web/src/composables/admin/useOperationAdmin.ts` and `web/tests/AdminView.test.ts`; operation child editing should use operation-specific client functions.

- [x] **Step 5: Verify cleanup**

Run:

```bash
rg -n "patrol-arrangements|PatrolArrangement|fetchPatrolArrangements|createPatrolArrangement|updatePatrolArrangement|deletePatrolArrangement|openPatrolModal|togglePatrol|removePatrol|task-containers|task-items|createTaskContainer|createTaskItem|deleteTaskItem" server/src server/tests web/src web/tests
```

Expected: no matches.

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
npm run test --workspace web -- client.test.ts AdminView.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/src/routes/admin.ts server/tests/adminRoutes.test.ts web/src/api/client.ts web/tests/client.test.ts web/src/views/AdminView.vue web/src/composables/admin/useOperationAdmin.ts web/tests/AdminView.test.ts
git commit -m "refactor: remove old patrol arrangement paths"
```

## Task 10: Regression And No-Style-Change Verification

**Files:**
- Modify only tests if needed.

- [x] **Step 1: Run full test suite**

```bash
npm test
```

Expected: PASS.

- [x] **Step 2: Run build**

```bash
npm run build
```

Expected: PASS.

- [x] **Step 3: Inspect board style diff**

Run:

```bash
git diff -- web/src/views/BoardView.vue web/src/components/OperationTimeline.vue web/src/components/OperationTaskTimeline.vue web/src/components/DenseRows.vue web/src/styles.css
```

Expected: No style-only changes. Any diff must be limited to data mapping required by instance-backed board data.

- [x] **Step 4: Commit final verification fixes**

If verification required test-only fixes:

```bash
git add server/tests web/tests
git commit -m "test: cover instance generation regressions"
```

If no fixes were needed, do not create an empty commit.

## Execution Notes

- Remove old patrol arrangement admin usage instead of keeping compatibility wrappers.
- This is a non-production refactor; do not spend implementation time on data migration or compatibility backfills.
- Treat generated instances as display snapshots; do not make board display depend on live template joins.
- Manual instances must survive regeneration.
- Template edits affect future generated instances only after an explicit regenerate action.
- Board style is out of scope. Do not tune board spacing, colors, card styles, typography, or timeline visuals as part of this refactor.
