# Operation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build operation-specific admin APIs and a redesigned operation admin UI with a single-cycle pan/zoom child-task timeline.

**Architecture:** Keep `task_containers` and `task_items` unchanged. Add operation-specific Fastify routes that aggregate those tables, then replace the current one-shot operation form with focused Vue components for plan list/detail and timeline child editing. Keep board snapshot behavior unchanged.

**Tech Stack:** Fastify, SQLite via `better-sqlite3`, Zod, Vitest, Vue 3 Composition API, Vue Test Utils, TypeScript.

---

## File Structure

- Create `server/src/routes/operationPlans.ts`: operation-only admin route registration, schemas, row mapping, date-scope list logic, and child item CRUD.
- Modify `server/src/app.ts`: register operation plan routes beside existing admin routes.
- Modify `server/tests/adminRoutes.test.ts`: add operation API integration tests using `app.inject`.
- Modify `web/src/api/client.ts`: add operation plan and child item types plus CRUD functions.
- Create `web/src/components/OperationTaskTimeline.vue`: single-cycle timeline with wheel zoom, drag pan, task block click, and add action.
- Create `web/src/components/OperationPlanManager.vue`: operation section UI that owns plan list, detail form, child-task modal, and API orchestration.
- Modify `web/src/views/AdminView.vue`: replace inline operation form with `OperationPlanManager`; remove old operation form state and `saveOperation`.
- Modify `web/tests/AdminView.test.ts`: update mocks for new operation APIs and assert the operation manager appears.
- Create `web/tests/OperationTaskTimeline.test.ts`: unit tests for offset rendering, wheel zoom, drag pan, and click/edit events.
- Create `web/tests/OperationPlanManager.test.ts`: unit tests for list loading, selecting a plan, and child create/edit/delete API calls.

---

## Task 1: Backend Operation API Tests

**Files:**
- Modify: `server/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add tests for operation plan list and detail**

Append these tests inside `describe("admin routes", () => { ... })`:

```ts
  it("lists operation plans by selected date and returns detail with multiple child tasks", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "倒闸操作",
        description: "主线切换",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T20:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const { id } = createResponse.json() as { id: string };

    await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: { offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: { crew: "A" }, sortOrder: 1 }
    });
    await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: { offsetMinutes: 120, durationMinutes: 240, content: "C 操作", extData: { crew: "B" }, sortOrder: 2 }
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/admin/operation-plans?date=2026-05-01&scope=date"
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject([
      {
        id,
        name: "倒闸操作",
        recurrenceType: "once",
        childTaskCount: 2,
        enabled: true
      }
    ]);
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      id,
      name: "倒闸操作",
      items: [
        { content: "A、B 操作", offsetMinutes: 0, durationMinutes: 120, extData: { crew: "A" } },
        { content: "C 操作", offsetMinutes: 120, durationMinutes: 240, extData: { crew: "B" } }
      ]
    });
  });
```

- [ ] **Step 2: Add tests for all scope, updates, deletes, validation, ownership, and events**

Append this test:

```ts
  it("manages operation plans and child tasks without affecting non-operation containers", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    const app = createApp(db, { boardEvents });

    const operationResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const { id } = operationResponse.json() as { id: string };

    const patrolResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-containers",
      payload: {
        type: "patrol",
        name: "巡视",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const { id: patrolId } = patrolResponse.json() as { id: string };

    const itemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: { offsetMinutes: 30, durationMinutes: 60, content: "检查闭锁", extData: {}, sortOrder: 0 }
    });
    const { id: itemId } = itemResponse.json() as { id: string };

    const overflowResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: { offsetMinutes: 90, durationMinutes: 60, content: "越界", extData: {}, sortOrder: 0 }
    });
    const wrongTypeResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${patrolId}/items`,
      payload: { offsetMinutes: 0, durationMinutes: 30, content: "错误", extData: {}, sortOrder: 0 }
    });

    const updateItemResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${id}/items/${itemId}`,
      payload: { offsetMinutes: 15, durationMinutes: 45, content: "更新检查", extData: { done: true }, sortOrder: 3 }
    });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: `/api/admin/operation-plans/${id}/enabled`,
      payload: { enabled: false }
    });
    const allResponse = await app.inject({ method: "GET", url: "/api/admin/operation-plans?scope=all" });
    const deleteItemResponse = await app.inject({ method: "DELETE", url: `/api/admin/operation-plans/${id}/items/${itemId}` });
    const deletePlanResponse = await app.inject({ method: "DELETE", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(operationResponse.statusCode).toBe(201);
    expect(itemResponse.statusCode).toBe(201);
    expect(overflowResponse.statusCode).toBe(400);
    expect(overflowResponse.json()).toMatchObject({ message: "child task ends after parent occurrence" });
    expect(wrongTypeResponse.statusCode).toBe(404);
    expect(updateItemResponse.statusCode).toBe(200);
    expect(disableResponse.statusCode).toBe(200);
    expect(allResponse.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id, enabled: false })]));
    expect(deleteItemResponse.statusCode).toBe(204);
    expect(deletePlanResponse.statusCode).toBe(204);
    expect(boardEvents.getVersion()).toBeGreaterThan(1);
  });
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: FAIL with 404 responses for `/api/admin/operation-plans`.

---

## Task 2: Backend Operation API Implementation

**Files:**
- Create: `server/src/routes/operationPlans.ts`
- Modify: `server/src/app.ts`
- Test: `server/tests/adminRoutes.test.ts`

- [ ] **Step 1: Create operation route module with schemas and helpers**

Create `server/src/routes/operationPlans.ts` with these exports and helpers:

```ts
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { validateTaskItem } from "../domain/taskExpansion.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" });
const operationPlanInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    recurrenceType: z.enum(["once", "finite", "infinite"]),
    recurrenceIntervalMinutes: z.number().int().positive().nullable().optional(),
    recurrenceCount: z.number().int().positive().nullable().optional(),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(false)
  })
  .superRefine((input, ctx) => {
    if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "endAt must be after startAt" });
    }
    if ((input.recurrenceType === "finite" || input.recurrenceType === "infinite") && (input.recurrenceIntervalMinutes ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrenceIntervalMinutes"],
        message: "recurrenceIntervalMinutes must be positive"
      });
    }
    if (input.recurrenceType === "finite" && (input.recurrenceCount ?? 0) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["recurrenceCount"], message: "recurrenceCount must be positive" });
    }
  });
const operationItemInputSchema = z.object({
  offsetMinutes: z.number().int(),
  durationMinutes: z.number().int(),
  content: z.string().min(1),
  extData: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().default(0)
});
const idParamSchema = z.object({ id: z.string().min(1) });
const itemParamSchema = z.object({ id: z.string().min(1), itemId: z.string().min(1) });
const enabledInputSchema = z.object({ enabled: z.boolean() });
const listQuerySchema = z.object({ date: dateSchema.optional(), scope: z.enum(["date", "all"]).default("date") });

interface OperationPlanRow {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  recurrence_type: "once" | "finite" | "infinite";
  recurrence_interval_minutes: number | null;
  recurrence_count: number | null;
  skip_weekends: number;
  skip_holidays: number;
  enabled: number;
  child_task_count: number;
}

interface OperationItemRow {
  id: string;
  offset_minutes: number;
  duration_minutes: number;
  content: string;
  ext_data_json: string;
  sort_order: number;
}
```

- [ ] **Step 2: Add route registration implementation**

In the same file, add:

```ts
export function registerOperationPlanRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/operation-plans", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid admin payload", issues: query.error.issues });

    const rows =
      query.data.scope === "all"
        ? db
            .prepare<[], OperationPlanRow>(operationPlanSelect("where c.type = 'operation'"))
            .all()
        : db
            .prepare<[string, string], OperationPlanRow>(
              operationPlanSelect("where c.type = 'operation' and c.start_at <= ? and c.end_at >= ?")
            )
            .all(`${query.data.date}T23:59:59+08:00`, `${query.data.date}T00:00:00+08:00`);

    return rows.map(mapPlanRow);
  });

  app.get("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    const plan = db.prepare<[string], OperationPlanRow>(operationPlanSelect("where c.type = 'operation' and c.id = ?")).get(params.data.id);
    if (!plan) return reply.code(404).send({ error: "Not found" });
    const items = loadItems(db, params.data.id);
    return { ...mapPlanRow(plan), items };
  });

  app.post("/api/admin/operation-plans", async (request, reply) => {
    const validation = operationPlanInputSchema.safeParse(request.body);
    if (!validation.success) return reply.code(400).send({ error: "Invalid admin payload", issues: validation.error.issues });
    const input = validation.data;
    const id = nanoid();
    const now = new Date().toISOString();
    db.prepare(
      `insert into task_containers
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, 'operation', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      id,
      input.name,
      input.description,
      input.startAt,
      input.endAt,
      input.recurrenceType,
      input.recurrenceIntervalMinutes ?? null,
      input.recurrenceCount ?? null,
      input.skipWeekends ? 1 : 0,
      input.skipHolidays ? 1 : 0,
      now,
      now
    );
    boardEvents.publish();
    return reply.code(201).send({ id });
  });

  app.put("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    const validation = operationPlanInputSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    if (!validation.success) return reply.code(400).send({ error: "Invalid admin payload", issues: validation.error.issues });
    const input = validation.data;
    const result = db.prepare(
      `update task_containers
       set name = ?, description = ?, start_at = ?, end_at = ?, recurrence_type = ?,
           recurrence_interval_minutes = ?, recurrence_count = ?, skip_weekends = ?, skip_holidays = ?, updated_at = ?
       where id = ? and type = 'operation'`
    ).run(
      input.name,
      input.description,
      input.startAt,
      input.endAt,
      input.recurrenceType,
      input.recurrenceIntervalMinutes ?? null,
      input.recurrenceCount ?? null,
      input.skipWeekends ? 1 : 0,
      input.skipHolidays ? 1 : 0,
      new Date().toISOString(),
      params.data.id
    );
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();
    return { id: params.data.id };
  });

  app.patch("/api/admin/operation-plans/:id/enabled", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    const validation = enabledInputSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    if (!validation.success) return reply.code(400).send({ error: "Invalid admin payload", issues: validation.error.issues });
    const result = db
      .prepare("update task_containers set enabled = ?, updated_at = ? where id = ? and type = 'operation'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();
    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    const result = db.prepare("delete from task_containers where id = ? and type = 'operation'").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();
    return reply.code(204).send();
  });
```

- [ ] **Step 3: Add child item endpoints and helper functions**

Continue `registerOperationPlanRoutes` with child endpoints, then close the function:

```ts
  app.post("/api/admin/operation-plans/:id/items", async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    const validation = operationItemInputSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    if (!validation.success) return reply.code(400).send({ error: "Invalid admin payload", issues: validation.error.issues });
    const parent = loadOperationParent(db, params.data.id);
    if (!parent) return reply.code(404).send({ error: "Not found" });
    const itemValidation = validateTaskItem(parent.durationMinutes, validation.data);
    if (!itemValidation.ok) return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    const id = nanoid();
    db.prepare(
      `insert into task_items
       (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
       values (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      params.data.id,
      validation.data.offsetMinutes,
      validation.data.durationMinutes,
      validation.data.content,
      JSON.stringify(validation.data.extData),
      validation.data.sortOrder
    );
    boardEvents.publish();
    return reply.code(201).send({ id });
  });

  app.put("/api/admin/operation-plans/:id/items/:itemId", async (request, reply) => {
    const params = itemParamSchema.safeParse(request.params);
    const validation = operationItemInputSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    if (!validation.success) return reply.code(400).send({ error: "Invalid admin payload", issues: validation.error.issues });
    const parent = loadOperationParent(db, params.data.id);
    if (!parent) return reply.code(404).send({ error: "Not found" });
    const itemValidation = validateTaskItem(parent.durationMinutes, validation.data);
    if (!itemValidation.ok) return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    const result = db
      .prepare(
        `update task_items
         set offset_minutes = ?, duration_minutes = ?, content = ?, ext_data_json = ?, sort_order = ?
         where id = ? and container_id = ?`
      )
      .run(
        validation.data.offsetMinutes,
        validation.data.durationMinutes,
        validation.data.content,
        JSON.stringify(validation.data.extData),
        validation.data.sortOrder,
        params.data.itemId,
        params.data.id
      );
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();
    return { id: params.data.itemId };
  });

  app.delete("/api/admin/operation-plans/:id/items/:itemId", async (request, reply) => {
    const params = itemParamSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid admin payload", issues: params.error.issues });
    const parent = loadOperationParent(db, params.data.id);
    if (!parent) return reply.code(404).send({ error: "Not found" });
    const result = db.prepare("delete from task_items where id = ? and container_id = ?").run(params.data.itemId, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();
    return reply.code(204).send();
  });
}
```

Add these helpers after the route function:

```ts
function operationPlanSelect(whereClause: string): string {
  return `select c.id, c.name, c.description, c.start_at, c.end_at, c.recurrence_type,
                 c.recurrence_interval_minutes, c.recurrence_count, c.skip_weekends,
                 c.skip_holidays, c.enabled, count(i.id) as child_task_count
          from task_containers c
          left join task_items i on i.container_id = c.id
          ${whereClause}
          group by c.id
          order by c.start_at desc, c.name`;
}

function mapPlanRow(row: OperationPlanRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    recurrenceType: row.recurrence_type,
    recurrenceIntervalMinutes: row.recurrence_interval_minutes,
    recurrenceCount: row.recurrence_count,
    skipWeekends: row.skip_weekends === 1,
    skipHolidays: row.skip_holidays === 1,
    enabled: row.enabled === 1,
    childTaskCount: row.child_task_count
  };
}

function loadItems(db: AppDatabase, containerId: string) {
  return db
    .prepare<[string], OperationItemRow>(
      `select id, offset_minutes, duration_minutes, content, ext_data_json, sort_order
       from task_items
       where container_id = ?
       order by sort_order, offset_minutes`
    )
    .all(containerId)
    .map((row) => ({
      id: row.id,
      offsetMinutes: row.offset_minutes,
      durationMinutes: row.duration_minutes,
      content: row.content,
      extData: parseExtDataJson(row.ext_data_json),
      sortOrder: row.sort_order
    }));
}

function loadOperationParent(db: AppDatabase, id: string): { durationMinutes: number } | null {
  const row = db
    .prepare<[string], { start_at: string; end_at: string }>("select start_at, end_at from task_containers where id = ? and type = 'operation'")
    .get(id);
  if (!row) return null;
  return { durationMinutes: Math.floor((new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 60_000) };
}

function parseExtDataJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}
```

- [ ] **Step 4: Register routes in the app**

Modify `server/src/app.ts`:

```ts
import { registerOperationPlanRoutes } from "./routes/operationPlans.js";
```

Then in `createApp` after `registerAdminRoutes(app, db, boardEvents);` add:

```ts
  registerOperationPlanRoutes(app, db, boardEvents);
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit backend API**

Run:

```bash
git add server/src/app.ts server/src/routes/operationPlans.ts server/tests/adminRoutes.test.ts
git commit -m "feat: add operation plan admin api"
```

---

## Task 3: Frontend API Client

**Files:**
- Modify: `web/src/api/client.ts`

- [ ] **Step 1: Add operation types**

Add after `LeavePersonRecord`:

```ts
export type RecurrenceType = "once" | "finite" | "infinite";

export interface OperationPlanSummary {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number | null;
  recurrenceCount: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
  childTaskCount: number;
}

export interface OperationTaskItem {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  extData: Record<string, unknown>;
  sortOrder: number;
}

export interface OperationPlanDetail extends OperationPlanSummary {
  items: OperationTaskItem[];
}

export interface OperationPlanInput {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
}

export interface OperationTaskInput {
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  extData: Record<string, unknown>;
  sortOrder: number;
}
```

- [ ] **Step 2: Add operation client functions**

Add before legacy `createTaskContainer`:

```ts
export async function fetchOperationPlans(date: string, scope: "date" | "all"): Promise<OperationPlanSummary[]> {
  const query = scope === "all" ? "scope=all" : `date=${encodeURIComponent(date)}&scope=date`;
  return fetchAdmin(`operation-plans?${query}`);
}

export async function fetchOperationPlan(id: string): Promise<OperationPlanDetail> {
  return fetchAdmin(`operation-plans/${encodeURIComponent(id)}`);
}

export async function createOperationPlan(input: OperationPlanInput): Promise<{ id: string }> {
  return postAdmin("operation-plans", input);
}

export async function updateOperationPlan(id: string, input: OperationPlanInput): Promise<void> {
  return putAdmin(`operation-plans/${encodeURIComponent(id)}`, input);
}

export async function updateOperationPlanEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`operation-plans/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deleteOperationPlan(id: string): Promise<void> {
  return deleteAdmin(`operation-plans/${encodeURIComponent(id)}`);
}

export async function createOperationTask(planId: string, input: OperationTaskInput): Promise<{ id: string }> {
  return postAdmin(`operation-plans/${encodeURIComponent(planId)}/items`, input);
}

export async function updateOperationTask(planId: string, itemId: string, input: OperationTaskInput): Promise<void> {
  return putAdmin(`operation-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`, input);
}

export async function deleteOperationTask(planId: string, itemId: string): Promise<void> {
  return deleteAdmin(`operation-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`);
}
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
npm run build --workspace web
```

Expected: PASS.

- [ ] **Step 4: Commit API client**

Run:

```bash
git add web/src/api/client.ts
git commit -m "feat: add operation api client"
```

---

## Task 4: Operation Timeline Component

**Files:**
- Create: `web/src/components/OperationTaskTimeline.vue`
- Create: `web/tests/OperationTaskTimeline.test.ts`

- [ ] **Step 1: Write failing timeline tests**

Create `web/tests/OperationTaskTimeline.test.ts`:

```ts
// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import OperationTaskTimeline from "../src/components/OperationTaskTimeline.vue";

const items = [
  { id: "a", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: {}, sortOrder: 0 },
  { id: "b", offsetMinutes: 240, durationMinutes: 120, content: "C 操作", extData: {}, sortOrder: 1 }
];

describe("OperationTaskTimeline", () => {
  it("renders child task blocks from offset and duration", () => {
    const wrapper = mount(OperationTaskTimeline, { props: { items, durationMinutes: 480 } });

    expect(wrapper.text()).toContain("A、B 操作");
    expect(wrapper.text()).toContain("C 操作");
    expect(wrapper.find('[data-testid="operation-task-a"]').attributes("style")).toContain("left:");
  });

  it("zooms with the mouse wheel without mutating task data", async () => {
    const wrapper = mount(OperationTaskTimeline, { props: { items, durationMinutes: 480 } });
    const before = JSON.stringify(wrapper.props("items"));

    await wrapper.find('[data-testid="operation-timeline-viewport"]').trigger("wheel", { deltaY: -100, clientX: 180 });

    expect(JSON.stringify(wrapper.props("items"))).toBe(before);
    expect(wrapper.find('[data-testid="operation-timeline-window"]').text()).toContain("视窗");
  });

  it("pans horizontally with mouse drag and emits edit when a task is clicked", async () => {
    const wrapper = mount(OperationTaskTimeline, { props: { items, durationMinutes: 480 } });

    await wrapper.find('[data-testid="operation-timeline-viewport"]').trigger("mousedown", { clientX: 220 });
    await wrapper.find('[data-testid="operation-timeline-viewport"]').trigger("mousemove", { clientX: 120 });
    await wrapper.find('[data-testid="operation-timeline-viewport"]').trigger("mouseup");
    await wrapper.find('[data-testid="operation-task-b"]').trigger("click");

    expect(wrapper.emitted("edit")?.[0]).toEqual([items[1]]);
  });
});
```

- [ ] **Step 2: Run timeline test to verify failure**

Run:

```bash
npm run test --workspace web -- OperationTaskTimeline.test.ts
```

Expected: FAIL because `OperationTaskTimeline.vue` does not exist.

- [ ] **Step 3: Implement timeline component**

Create `web/src/components/OperationTaskTimeline.vue`:

```vue
<template>
  <section class="operation-timeline">
    <div class="timeline-toolbar">
      <div>
        <h3>子任务时间轴</h3>
        <p data-testid="operation-timeline-window">视窗 {{ formatMinute(visibleStart) }} - {{ formatMinute(visibleEnd) }}</p>
      </div>
      <button type="button" class="primary-action" @click="$emit('add')">新增子任务</button>
    </div>
    <div
      class="timeline-viewport"
      data-testid="operation-timeline-viewport"
      @wheel.prevent="handleWheel"
      @mousedown="startDrag"
      @mousemove="drag"
      @mouseup="stopDrag"
      @mouseleave="stopDrag"
    >
      <div class="timeline-scale">
        <span v-for="tick in ticks" :key="tick.offset" :style="{ left: `${tick.left}%` }">{{ tick.label }}</span>
      </div>
      <button
        v-for="item in positionedItems"
        :key="item.id"
        type="button"
        class="timeline-task"
        :data-testid="`operation-task-${item.id}`"
        :style="{ left: `${item.left}%`, width: `${item.width}%`, top: `${item.top}px` }"
        @click.stop="$emit('edit', item.source)"
      >
        {{ item.content }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { OperationTaskItem } from "../api/client";

const props = defineProps<{ items: OperationTaskItem[]; durationMinutes: number }>();
defineEmits<{ add: []; edit: [item: OperationTaskItem] }>();

const minVisibleMinutes = 60;
const visibleStart = ref(0);
const visibleDuration = ref(1);
const dragStartX = ref<number | null>(null);
const dragStartOffset = ref(0);

watch(
  () => props.durationMinutes,
  (duration) => {
    visibleStart.value = 0;
    visibleDuration.value = Math.max(duration, minVisibleMinutes);
  },
  { immediate: true }
);

const visibleEnd = computed(() => Math.min(props.durationMinutes, visibleStart.value + visibleDuration.value));
const positionedItems = computed(() =>
  props.items.map((item, index) => {
    const left = ((item.offsetMinutes - visibleStart.value) / visibleDuration.value) * 100;
    const width = (item.durationMinutes / visibleDuration.value) * 100;
    return { ...item, source: item, left, width: Math.max(width, 3), top: 38 + (index % 3) * 34 };
  })
);
const ticks = computed(() => {
  const count = 5;
  return Array.from({ length: count }, (_, index) => {
    const offset = visibleStart.value + (visibleDuration.value / (count - 1)) * index;
    return { offset, left: (index / (count - 1)) * 100, label: formatMinute(offset) };
  });
});

function handleWheel(event: WheelEvent): void {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const ratio = rect.width === 0 ? 0.5 : (event.clientX - rect.left) / rect.width;
  const nextDuration = clamp(visibleDuration.value * (event.deltaY < 0 ? 0.8 : 1.25), minVisibleMinutes, props.durationMinutes);
  const anchor = visibleStart.value + visibleDuration.value * ratio;
  visibleDuration.value = nextDuration;
  visibleStart.value = clamp(anchor - nextDuration * ratio, 0, Math.max(0, props.durationMinutes - nextDuration));
}

function startDrag(event: MouseEvent): void {
  dragStartX.value = event.clientX;
  dragStartOffset.value = visibleStart.value;
}

function drag(event: MouseEvent): void {
  if (dragStartX.value === null) return;
  const target = event.currentTarget as HTMLElement;
  const pixels = event.clientX - dragStartX.value;
  const minutes = target.clientWidth === 0 ? 0 : (pixels / target.clientWidth) * visibleDuration.value;
  visibleStart.value = clamp(dragStartOffset.value - minutes, 0, Math.max(0, props.durationMinutes - visibleDuration.value));
}

function stopDrag(): void {
  dragStartX.value = null;
}

function formatMinute(value: number): string {
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
</script>
```

- [ ] **Step 4: Add focused styles**

Add this style block to the same component:

```vue
<style scoped>
.operation-timeline {
  min-width: 0;
}
.timeline-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}
.timeline-toolbar h3 {
  margin: 0;
  font-size: 16px;
}
.timeline-toolbar p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}
.timeline-viewport {
  position: relative;
  height: 160px;
  overflow: hidden;
  border: 1px solid #cbd5e1;
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.28) 1px, transparent 1px) 0 0 / 20% 100%,
    #f8fafc;
  cursor: grab;
}
.timeline-viewport:active {
  cursor: grabbing;
}
.timeline-scale {
  position: absolute;
  inset: 0 12px auto 12px;
  height: 28px;
}
.timeline-scale span {
  position: absolute;
  top: 8px;
  transform: translateX(-50%);
  color: #475569;
  font-size: 11px;
}
.timeline-task {
  position: absolute;
  min-width: 48px;
  height: 28px;
  overflow: hidden;
  border: 1px solid #0284c7;
  border-radius: 4px;
  background: #0ea5e9;
  color: #ffffff;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
```

- [ ] **Step 5: Run timeline tests**

Run:

```bash
npm run test --workspace web -- OperationTaskTimeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit timeline component**

Run:

```bash
git add web/src/components/OperationTaskTimeline.vue web/tests/OperationTaskTimeline.test.ts
git commit -m "feat: add operation task timeline"
```

---

## Task 5: Operation Plan Manager Component

**Files:**
- Create: `web/src/components/OperationPlanManager.vue`
- Create: `web/tests/OperationPlanManager.test.ts`

- [ ] **Step 1: Write failing manager tests**

Create `web/tests/OperationPlanManager.test.ts`:

```ts
// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OperationPlanManager from "../src/components/OperationPlanManager.vue";
import { createOperationTask, fetchOperationPlan, fetchOperationPlans } from "../src/api/client";

vi.mock("../src/api/client", () => ({
  createOperationPlan: vi.fn().mockResolvedValue({ id: "plan-2" }),
  createOperationTask: vi.fn().mockResolvedValue({ id: "item-2" }),
  deleteOperationPlan: vi.fn().mockResolvedValue(undefined),
  deleteOperationTask: vi.fn().mockResolvedValue(undefined),
  fetchOperationPlan: vi.fn().mockResolvedValue({
    id: "plan-1",
    name: "倒闸操作",
    description: "主线切换",
    startAt: "2026-05-01T08:00:00+08:00",
    endAt: "2026-05-01T20:00:00+08:00",
    recurrenceType: "once",
    recurrenceIntervalMinutes: null,
    recurrenceCount: null,
    skipWeekends: false,
    skipHolidays: false,
    enabled: true,
    childTaskCount: 1,
    items: [{ id: "item-1", offsetMinutes: 0, durationMinutes: 120, content: "A、B 操作", extData: {}, sortOrder: 0 }]
  }),
  fetchOperationPlans: vi.fn().mockResolvedValue([
    {
      id: "plan-1",
      name: "倒闸操作",
      description: "主线切换",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T20:00:00+08:00",
      recurrenceType: "once",
      recurrenceIntervalMinutes: null,
      recurrenceCount: null,
      skipWeekends: false,
      skipHolidays: false,
      enabled: true,
      childTaskCount: 1
    }
  ]),
  updateOperationPlan: vi.fn().mockResolvedValue(undefined),
  updateOperationPlanEnabled: vi.fn().mockResolvedValue(undefined),
  updateOperationTask: vi.fn().mockResolvedValue(undefined)
}));

describe("OperationPlanManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads operation plans for the selected date and opens details", async () => {
    const wrapper = mount(OperationPlanManager, { props: { date: "2026-05-01" } });
    await new Promise((resolve) => setTimeout(resolve));

    expect(fetchOperationPlans).toHaveBeenCalledWith("2026-05-01", "date");
    expect(wrapper.text()).toContain("倒闸操作");

    await wrapper.find('[data-testid="operation-plan-plan-1"]').trigger("click");

    expect(fetchOperationPlan).toHaveBeenCalledWith("plan-1");
    expect(wrapper.text()).toContain("A、B 操作");
  });

  it("creates a child task from the modal", async () => {
    const wrapper = mount(OperationPlanManager, { props: { date: "2026-05-01" } });
    await new Promise((resolve) => setTimeout(resolve));
    await wrapper.find('[data-testid="operation-plan-plan-1"]').trigger("click");
    await wrapper.find('[data-testid="operation-add-task"]').trigger("click");
    await wrapper.find('input[name="content"]').setValue("C 操作");
    await wrapper.find('input[name="offsetMinutes"]').setValue(120);
    await wrapper.find('input[name="durationMinutes"]').setValue(60);
    await wrapper.find('[data-testid="operation-task-form"]').trigger("submit.prevent");

    expect(createOperationTask).toHaveBeenCalledWith("plan-1", {
      content: "C 操作",
      offsetMinutes: 120,
      durationMinutes: 60,
      extData: {},
      sortOrder: 0
    });
  });
});
```

- [ ] **Step 2: Run manager test to verify failure**

Run:

```bash
npm run test --workspace web -- OperationPlanManager.test.ts
```

Expected: FAIL because `OperationPlanManager.vue` does not exist.

- [ ] **Step 3: Implement manager component**

Create `web/src/components/OperationPlanManager.vue` with a compact implementation:

```vue
<template>
  <section class="operation-manager">
    <div class="operation-header">
      <div>
        <h2>操作计划</h2>
        <p>按日期筛选操作计划，也可显示全部。</p>
      </div>
      <label class="all-toggle"><input v-model="showAll" type="checkbox" /> 显示全部</label>
      <button type="button" class="primary-action" @click="newPlan">新增操作计划</button>
    </div>

    <div class="operation-layout">
      <aside class="operation-list">
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="operation-plan-row"
          :class="{ active: selectedPlan?.id === plan.id, disabled: !plan.enabled }"
          :data-testid="`operation-plan-${plan.id}`"
          @click="selectPlan(plan.id)"
        >
          <strong>{{ plan.name }}</strong>
          <span>{{ formatDateTime(plan.startAt) }} - {{ formatDateTime(plan.endAt) }}</span>
          <small>{{ plan.recurrenceType }} · {{ plan.childTaskCount }} 个子任务</small>
        </button>
      </aside>

      <section class="operation-detail" v-if="selectedPlan">
        <form class="operation-form" @submit.prevent="savePlan">
          <label>名称<input v-model="planForm.name" required /></label>
          <label>描述<input v-model="planForm.description" /></label>
          <label>开始时间<input v-model="planForm.startAt" required type="datetime-local" /></label>
          <label>结束时间<input v-model="planForm.endAt" required type="datetime-local" /></label>
          <label>
            循环类型
            <select v-model="planForm.recurrenceType">
              <option value="once">一次性</option>
              <option value="finite">有限循环</option>
              <option value="infinite">无限循环</option>
            </select>
          </label>
          <label>循环间隔<input v-model.number="planForm.recurrenceIntervalMinutes" min="1" type="number" /></label>
          <label>循环次数<input v-model.number="planForm.recurrenceCount" min="1" type="number" /></label>
          <label><input v-model="planForm.skipWeekends" type="checkbox" /> 跳过周末</label>
          <label><input v-model="planForm.skipHolidays" type="checkbox" /> 跳过节假日</label>
          <button type="submit" class="primary-action">保存主任务</button>
        </form>

        <OperationTaskTimeline
          :items="selectedPlan.items"
          :duration-minutes="durationMinutes"
          @add="openTaskModal()"
          @edit="openTaskModal"
        />
      </section>
    </div>

    <div v-if="taskModalOpen" class="modal-backdrop">
      <form class="modal-form" data-testid="operation-task-form" @submit.prevent="saveTask">
        <h2>{{ editingTaskId ? "修改子任务" : "新增子任务" }}</h2>
        <label>内容<input v-model="taskForm.content" name="content" required /></label>
        <label>Offset 分钟<input v-model.number="taskForm.offsetMinutes" name="offsetMinutes" min="0" required type="number" /></label>
        <label>时长分钟<input v-model.number="taskForm.durationMinutes" name="durationMinutes" min="1" required type="number" /></label>
        <div class="modal-actions">
          <button type="button" @click="closeTaskModal">取消</button>
          <button type="submit" class="primary-action">保存</button>
        </div>
      </form>
    </div>
  </section>
</template>
```

Use the Composition API script with these exact data flows:

```ts
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  createOperationPlan,
  createOperationTask,
  fetchOperationPlan,
  fetchOperationPlans,
  updateOperationPlan,
  updateOperationTask,
  type OperationPlanDetail,
  type OperationPlanInput,
  type OperationPlanSummary,
  type OperationTaskItem
} from "../api/client";
import OperationTaskTimeline from "./OperationTaskTimeline.vue";

const props = defineProps<{ date: string }>();
const plans = ref<OperationPlanSummary[]>([]);
const selectedPlan = ref<OperationPlanDetail | null>(null);
const showAll = ref(false);
const taskModalOpen = ref(false);
const editingTaskId = ref<string | null>(null);
const planForm = reactive({
  name: "",
  description: "",
  startAt: "",
  endAt: "",
  recurrenceType: "once" as OperationPlanInput["recurrenceType"],
  recurrenceIntervalMinutes: 1440 as number | null,
  recurrenceCount: 7 as number | null,
  skipWeekends: false,
  skipHolidays: false
});
const taskForm = reactive({ content: "", offsetMinutes: 0, durationMinutes: 60, extData: {} as Record<string, unknown> });
const durationMinutes = computed(() =>
  selectedPlan.value ? Math.max(1, Math.floor((new Date(selectedPlan.value.endAt).getTime() - new Date(selectedPlan.value.startAt).getTime()) / 60_000)) : 1
);

onMounted(loadPlans);
watch(() => props.date, loadPlans);
watch(showAll, loadPlans);

async function loadPlans(): Promise<void> {
  plans.value = await fetchOperationPlans(props.date, showAll.value ? "all" : "date");
}
async function selectPlan(id: string): Promise<void> {
  selectedPlan.value = await fetchOperationPlan(id);
  Object.assign(planForm, toLocalPlanForm(selectedPlan.value));
}
function newPlan(): void {
  selectedPlan.value = null;
  Object.assign(planForm, {
    name: "操作",
    description: "操作安排",
    startAt: `${props.date}T08:00`,
    endAt: `${props.date}T20:00`,
    recurrenceType: "once",
    recurrenceIntervalMinutes: 1440,
    recurrenceCount: 7,
    skipWeekends: false,
    skipHolidays: false
  });
}
async function savePlan(): Promise<void> {
  const input = toPlanInput();
  if (selectedPlan.value) await updateOperationPlan(selectedPlan.value.id, input);
  else {
    const created = await createOperationPlan(input);
    await loadPlans();
    await selectPlan(created.id);
  }
}
function openTaskModal(item?: OperationTaskItem): void {
  editingTaskId.value = item?.id ?? null;
  Object.assign(taskForm, {
    content: item?.content ?? "",
    offsetMinutes: item?.offsetMinutes ?? 0,
    durationMinutes: item?.durationMinutes ?? 60,
    extData: { ...(item?.extData ?? {}) }
  });
  taskModalOpen.value = true;
}
function closeTaskModal(): void {
  taskModalOpen.value = false;
}
async function saveTask(): Promise<void> {
  if (!selectedPlan.value) return;
  const input = {
    content: taskForm.content,
    offsetMinutes: Number(taskForm.offsetMinutes),
    durationMinutes: Number(taskForm.durationMinutes),
    extData: { ...taskForm.extData },
    sortOrder: 0
  };
  if (editingTaskId.value) await updateOperationTask(selectedPlan.value.id, editingTaskId.value, input);
  else await createOperationTask(selectedPlan.value.id, input);
  closeTaskModal();
  await selectPlan(selectedPlan.value.id);
}
function toPlanInput(): OperationPlanInput {
  return {
    name: planForm.name,
    description: planForm.description,
    startAt: normalizeDateTime(planForm.startAt),
    endAt: normalizeDateTime(planForm.endAt),
    recurrenceType: planForm.recurrenceType,
    recurrenceIntervalMinutes: planForm.recurrenceType === "once" ? null : Number(planForm.recurrenceIntervalMinutes),
    recurrenceCount: planForm.recurrenceType === "finite" ? Number(planForm.recurrenceCount) : null,
    skipWeekends: planForm.skipWeekends,
    skipHolidays: planForm.skipHolidays
  };
}
function toLocalPlanForm(plan: OperationPlanDetail) {
  return {
    name: plan.name,
    description: plan.description,
    startAt: plan.startAt.slice(0, 16),
    endAt: plan.endAt.slice(0, 16),
    recurrenceType: plan.recurrenceType,
    recurrenceIntervalMinutes: plan.recurrenceIntervalMinutes ?? 1440,
    recurrenceCount: plan.recurrenceCount ?? 7,
    skipWeekends: plan.skipWeekends,
    skipHolidays: plan.skipHolidays
  };
}
function normalizeDateTime(value: string): string {
  return value.includes("+") || value.endsWith("Z") ? value : `${value}:00+08:00`;
}
function formatDateTime(value: string): string {
  return value.replace("T", " ").slice(0, 16);
}
</script>
```

- [ ] **Step 4: Add manager styles**

Add a scoped style block with these selectors:

```vue
<style scoped>
.operation-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.operation-header,
.operation-layout,
.modal-actions {
  display: flex;
  gap: 12px;
}
.operation-header {
  align-items: center;
  justify-content: space-between;
}
.operation-header h2 {
  margin: 0;
}
.operation-header p {
  margin: 4px 0 0;
  color: #64748b;
}
.operation-layout {
  align-items: flex-start;
}
.operation-list {
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.operation-plan-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
  text-align: left;
}
.operation-plan-row.active {
  border-color: #0284c7;
  background: #e0f2fe;
}
.operation-plan-row.disabled {
  opacity: 0.56;
}
.operation-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.operation-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.operation-form label,
.modal-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.42);
}
.modal-form {
  width: min(520px, calc(100vw - 32px));
  padding: 18px;
  border-radius: 8px;
  background: #ffffff;
}
</style>
```

- [ ] **Step 5: Run manager tests**

Run:

```bash
npm run test --workspace web -- OperationPlanManager.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit manager component**

Run:

```bash
git add web/src/components/OperationPlanManager.vue web/tests/OperationPlanManager.test.ts
git commit -m "feat: add operation plan manager"
```

---

## Task 6: Integrate Operation Manager Into Admin View

**Files:**
- Modify: `web/src/views/AdminView.vue`
- Modify: `web/tests/AdminView.test.ts`

- [ ] **Step 1: Update AdminView API mock**

In `web/tests/AdminView.test.ts`, add the operation client mocks:

```ts
  createOperationPlan: vi.fn().mockResolvedValue({ id: "plan-1" }),
  createOperationTask: vi.fn().mockResolvedValue({ id: "task-1" }),
  deleteOperationPlan: vi.fn().mockResolvedValue(undefined),
  deleteOperationTask: vi.fn().mockResolvedValue(undefined),
  fetchOperationPlan: vi.fn().mockResolvedValue({
    id: "plan-1",
    name: "倒闸操作",
    description: "",
    startAt: "2026-05-01T08:00:00+08:00",
    endAt: "2026-05-01T20:00:00+08:00",
    recurrenceType: "once",
    recurrenceIntervalMinutes: null,
    recurrenceCount: null,
    skipWeekends: false,
    skipHolidays: false,
    enabled: true,
    childTaskCount: 0,
    items: []
  }),
  fetchOperationPlans: vi.fn().mockResolvedValue([]),
  updateOperationPlan: vi.fn().mockResolvedValue(undefined),
  updateOperationPlanEnabled: vi.fn().mockResolvedValue(undefined),
  updateOperationTask: vi.fn().mockResolvedValue(undefined),
```

- [ ] **Step 2: Replace operation template**

In `web/src/views/AdminView.vue`, replace the current `<form v-else-if="activeKey === 'operation'" ...>` block with:

```vue
        <OperationPlanManager v-else-if="activeKey === 'operation'" :date="selectedDate" />
```

- [ ] **Step 3: Update imports and remove old operation state**

In `web/src/views/AdminView.vue`:

Add:

```ts
import OperationPlanManager from "../components/OperationPlanManager.vue";
```

Remove these imports:

```ts
  createTaskContainer,
  createTaskItem,
```

Remove the `type RecurrenceType = ...` declaration if no longer used.

Remove `operationForm`, `recurrencePayload`, and `saveOperation` if they are no longer referenced.

- [ ] **Step 4: Run AdminView tests**

Run:

```bash
npm run test --workspace web -- AdminView.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit admin integration**

Run:

```bash
git add web/src/views/AdminView.vue web/tests/AdminView.test.ts
git commit -m "feat: integrate operation manager"
```

---

## Task 7: End-To-End Verification

**Files:**
- No source edits expected unless verification reveals bugs.

- [ ] **Step 1: Run full test suites**

Run:

```bash
npm run test --workspace server
npm run test --workspace web
```

Expected: both PASS.

- [ ] **Step 2: Run full builds**

Run:

```bash
npm run build --workspace server
npm run build --workspace web
```

Expected: both PASS.

- [ ] **Step 3: Start local dev servers**

Run these in separate terminals:

```bash
npm run dev --workspace server
npm run dev --workspace web
```

Expected: server listens on `http://localhost:4000`; web listens on Vite's printed URL, normally `http://localhost:5173`.

- [ ] **Step 4: Browser smoke test**

Open the web app to `/admin` and verify:

- Operation section loads without console errors.
- Creating an operation plan succeeds.
- Selecting the plan opens detail.
- Adding two child tasks shows two timeline blocks.
- Mouse wheel changes timeline viewport text.
- Mouse drag changes timeline viewport text.
- Clicking a child task opens edit modal.
- Board page still renders operation items.

- [ ] **Step 5: Commit fixes if needed**

If verification finds fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: polish operation redesign"
```

If no fixes are needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: operation-specific APIs, date/all scope, plan detail, child-task CRUD, single-cycle timeline, wheel zoom, drag pan, click edit, add modal, unchanged schema, unchanged patrol flow, and unchanged board API are covered.
- Placeholder scan: this plan intentionally contains no unresolved placeholder markers.
- Type consistency: operation plan and task type names in the API client match component imports and tests.
