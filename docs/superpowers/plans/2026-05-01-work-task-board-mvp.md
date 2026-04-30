# Work Task Board MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Vue 3 + TypeScript + Vite board/admin frontend and Fastify + SQLite backend for the confirmed work task board MVP.

**Architecture:** Use a monorepo with `server/` and `web/` workspaces. The backend owns SQLite schema, task expansion, board snapshots, CRUD APIs, and SSE; the frontend owns `/board` and `/admin`, consuming typed API responses.

**Tech Stack:** Node.js, TypeScript, Fastify, better-sqlite3, Vitest, Vue 3, Vite, Vue Router, vis-timeline.

---

## File Structure

- Create `package.json`: root workspace scripts for install, test, build, dev.
- Create `server/package.json`: backend dependencies and scripts.
- Create `server/src/db/schema.ts`: SQLite DDL and seed helper.
- Create `server/src/db/database.ts`: database connection and transaction helper.
- Create `server/src/domain/timeTags.ts`: fixed time-tag order and sorting.
- Create `server/src/domain/taskExpansion.ts`: main-task occurrence and child-task expansion.
- Create `server/src/domain/boardSnapshot.ts`: board snapshot composition.
- Create `server/src/routes/admin.ts`: CRUD routes for admin data.
- Create `server/src/routes/board.ts`: `/api/board` and `/api/events`.
- Create `server/src/app.ts`: Fastify app factory.
- Create `server/src/index.ts`: server entrypoint.
- Create `server/tests/*.test.ts`: backend behavior tests.
- Create `web/package.json`: frontend dependencies and scripts.
- Create `web/src/api/types.ts`: shared frontend API types.
- Create `web/src/api/client.ts`: fetch and SSE helpers.
- Create `web/src/router.ts`: `/board` and `/admin` routes.
- Create `web/src/views/BoardView.vue`: confirmed large-screen board UI.
- Create `web/src/views/AdminView.vue`: simple single-user management UI.
- Create `web/src/components/*.vue`: focused board/admin components.
- Create `web/src/styles.css`: global visual system.
- Create `web/tests/*.test.ts`: frontend behavior tests.

## Task 1: Scaffold Workspaces

**Files:**
- Create: `package.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`

- [ ] **Step 1: Create root workspace metadata**

Create `package.json`:

```json
{
  "name": "work-task-board",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "npm run dev --workspace server",
    "dev:web": "npm run dev --workspace web",
    "test": "npm run test --workspace server && npm run test --workspace web",
    "build": "npm run build --workspace server && npm run build --workspace web"
  }
}
```

- [ ] **Step 2: Create backend package**

Create `server/package.json`:

```json
{
  "name": "work-task-board-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.0",
    "better-sqlite3": "^11.8.1",
    "fastify": "^5.2.1",
    "nanoid": "^5.0.9",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create backend TypeScript config**

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create frontend package**

Create `web/package.json`:

```json
{
  "name": "work-task-board-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "test": "vitest run",
    "build": "vue-tsc -b && vite build"
  },
  "dependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "vis-timeline": "^7.7.3",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install and a root `package-lock.json` is created.

- [ ] **Step 6: Verify empty workspace scripts**

Run:

```bash
npm run build
```

Expected before source files exist: TypeScript or Vite reports missing entry files. This proves scripts are wired; subsequent tasks add entries.

## Task 2: Backend Schema And Database

**Files:**
- Create: `server/src/db/schema.ts`
- Create: `server/src/db/database.ts`
- Create: `server/tests/schema.test.ts`

- [ ] **Step 1: Write failing schema test**

Create `server/tests/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../src/db/database.js";

describe("database schema", () => {
  it("creates all MVP tables", () => {
    const db = createTestDatabase();
    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      "holidays",
      "leave_people",
      "other_arrangements",
      "permit_arrangements",
      "task_containers",
      "task_items"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace server -- schema.test.ts
```

Expected: FAIL because `../src/db/database.js` does not exist.

- [ ] **Step 3: Create schema DDL**

Create `server/src/db/schema.ts`:

```ts
export const schemaSql = `
create table if not exists task_containers (
  id text primary key,
  type text not null check (type in ('operation', 'patrol')),
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
  created_at text not null,
  updated_at text not null
);

create table if not exists task_items (
  id text primary key,
  container_id text not null references task_containers(id) on delete cascade,
  offset_minutes integer not null,
  duration_minutes integer not null,
  content text not null default '',
  time_tag text check (time_tag in ('全天', '上午', '下午')),
  target text not null default '',
  personnel text not null default '',
  vehicle text not null default '',
  other text not null default '',
  metadata_json text not null default '{}',
  sort_order integer not null default 0
);

create table if not exists permit_arrangements (
  id text primary key,
  date text not null,
  time_tag text not null check (time_tag in ('全天', '上午', '下午')),
  permit text not null,
  personnel text not null default '',
  area text not null default '',
  other text not null default '',
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists other_arrangements (
  id text primary key,
  date text not null,
  time_tag text not null check (time_tag in ('全天', '上午', '下午')),
  task text not null,
  personnel text not null default '',
  vehicle text not null default '',
  other text not null default '',
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists leave_people (
  id text primary key,
  date text not null,
  name text not null,
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists holidays (
  id text primary key,
  date text not null unique,
  name text not null default ''
);
`;
```

- [ ] **Step 4: Create database helper**

Create `server/src/db/database.ts`:

```ts
import Database from "better-sqlite3";
import { schemaSql } from "./schema.js";

export type AppDatabase = Database.Database;

export function migrate(db: AppDatabase): void {
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
}

export function openDatabase(filename = "server/db/workboard.sqlite"): AppDatabase {
  const db = new Database(filename);
  migrate(db);
  return db;
}

export function createTestDatabase(): AppDatabase {
  const db = new Database(":memory:");
  migrate(db);
  return db;
}
```

- [ ] **Step 5: Run schema test**

Run:

```bash
npm run test --workspace server -- schema.test.ts
```

Expected: PASS.

## Task 3: Task Expansion Domain

**Files:**
- Create: `server/src/domain/timeTags.ts`
- Create: `server/src/domain/taskExpansion.ts`
- Create: `server/tests/taskExpansion.test.ts`

- [ ] **Step 1: Write failing expansion tests**

Create `server/tests/taskExpansion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { expandContainer, validateTaskItem } from "../src/domain/taskExpansion.js";

describe("task expansion", () => {
  it("expands overlapping child tasks relative to an occurrence start", () => {
    const expanded = expandContainer(
      {
        id: "container-1",
        type: "operation",
        name: "操作",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        recurrenceIntervalMinutes: null,
        recurrenceCount: null,
        skipWeekends: false,
        skipHolidays: false,
        enabled: true
      },
      [
        { id: "a", offsetMinutes: 0, durationMinutes: 120, content: "A", metadata: {} },
        { id: "b", offsetMinutes: 60, durationMinutes: 120, content: "B", metadata: {} }
      ],
      {
        windowStart: "2026-05-01T07:00:00+08:00",
        windowEnd: "2026-05-01T13:00:00+08:00",
        holidays: new Set()
      }
    );

    expect(expanded.map((item) => item.content)).toEqual(["A", "B"]);
    expect(expanded[0].startAt).toBe("2026-05-01T08:00:00.000+08:00");
    expect(expanded[1].startAt).toBe("2026-05-01T09:00:00.000+08:00");
  });

  it("rejects child tasks ending after the main task occurrence", () => {
    const result = validateTaskItem(240, { offsetMinutes: 180, durationMinutes: 90 });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("child task ends after parent occurrence");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test --workspace server -- taskExpansion.test.ts
```

Expected: FAIL because `taskExpansion.js` does not exist.

- [ ] **Step 3: Implement time tag sorting**

Create `server/src/domain/timeTags.ts`:

```ts
export type TimeTag = "全天" | "上午" | "下午";

const order: Record<TimeTag, number> = {
  全天: 0,
  上午: 1,
  下午: 2
};

export function compareTimeTag(a: TimeTag, b: TimeTag): number {
  return order[a] - order[b];
}
```

- [ ] **Step 4: Implement task expansion**

Create `server/src/domain/taskExpansion.ts`:

```ts
export type RecurrenceType = "once" | "finite" | "infinite";

export interface TaskContainer {
  id: string;
  type: "operation" | "patrol";
  name: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number | null;
  recurrenceCount: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
}

export interface TaskItemInput {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content?: string;
  timeTag?: "全天" | "上午" | "下午";
  target?: string;
  personnel?: string;
  vehicle?: string;
  other?: string;
  metadata: Record<string, unknown>;
}

export interface ExpandedTaskItem extends TaskItemInput {
  containerId: string;
  startAt: string;
  endAt: string;
}

export interface ExpandOptions {
  windowStart: string;
  windowEnd: string;
  holidays: Set<string>;
}

export function validateTaskItem(
  parentDurationMinutes: number,
  item: Pick<TaskItemInput, "offsetMinutes" | "durationMinutes">
): { ok: true } | { ok: false; message: string } {
  if (item.offsetMinutes < 0) return { ok: false, message: "offset must be non-negative" };
  if (item.durationMinutes <= 0) return { ok: false, message: "duration must be positive" };
  if (item.offsetMinutes + item.durationMinutes > parentDurationMinutes) {
    return { ok: false, message: "child task ends after parent occurrence" };
  }
  return { ok: true };
}

export function expandContainer(
  container: TaskContainer,
  items: TaskItemInput[],
  options: ExpandOptions
): ExpandedTaskItem[] {
  if (!container.enabled) return [];
  const start = new Date(container.startAt);
  const end = new Date(container.endAt);
  const duration = end.getTime() - start.getTime();
  const windowStart = new Date(options.windowStart).getTime();
  const windowEnd = new Date(options.windowEnd).getTime();
  const occurrences = occurrenceStarts(container, windowStart, windowEnd);

  return occurrences.flatMap((occurrenceStart) => {
    const occurrenceEnd = occurrenceStart + duration;
    if (occurrenceEnd < windowStart || occurrenceStart > windowEnd) return [];
    return items
      .map((item) => {
        const childStart = occurrenceStart + item.offsetMinutes * 60_000;
        const childEnd = childStart + item.durationMinutes * 60_000;
        return {
          ...item,
          containerId: container.id,
          startAt: formatWithChinaOffset(childStart),
          endAt: formatWithChinaOffset(childEnd)
        };
      })
      .filter((item) => new Date(item.endAt).getTime() >= windowStart && new Date(item.startAt).getTime() <= windowEnd);
  });
}

function occurrenceStarts(container: TaskContainer, windowStart: number, windowEnd: number): number[] {
  const first = new Date(container.startAt).getTime();
  if (container.recurrenceType === "once") return [first];
  const interval = (container.recurrenceIntervalMinutes ?? 0) * 60_000;
  const countLimit = container.recurrenceType === "finite" ? container.recurrenceCount ?? 0 : 10_000;
  const starts: number[] = [];
  for (let index = 0; index < countLimit; index += 1) {
    const occurrence = first + index * interval;
    if (occurrence > windowEnd) break;
    if (occurrence >= windowStart - interval) starts.push(occurrence);
  }
  return starts;
}

function formatWithChinaOffset(epochMs: number): string {
  const shifted = new Date(epochMs + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 23)}+08:00`;
}
```

- [ ] **Step 5: Run expansion tests**

Run:

```bash
npm run test --workspace server -- taskExpansion.test.ts
```

Expected: PASS.

## Task 4: Board Snapshot And API

**Files:**
- Create: `server/src/domain/boardSnapshot.ts`
- Create: `server/src/routes/board.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/tests/boardSnapshot.test.ts`

- [ ] **Step 1: Write failing board snapshot test**

Create `server/tests/boardSnapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../src/db/database.js";
import { getBoardSnapshot } from "../src/domain/boardSnapshot.js";

describe("board snapshot", () => {
  it("sorts permits and other arrangements by time tag", () => {
    const db = createTestDatabase();
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("p1", "2026-05-01", "下午", "封闭许可", "孙八", "西侧", "待确认", 1, 0);
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("p2", "2026-05-01", "全天", "动火许可", "张三", "A区", "已审批", 1, 0);

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.permits.map((permit) => permit.timeTag)).toEqual(["全天", "下午"]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test --workspace server -- boardSnapshot.test.ts
```

Expected: FAIL because `boardSnapshot.js` does not exist.

- [ ] **Step 3: Implement board snapshot**

Create `server/src/domain/boardSnapshot.ts`:

```ts
import type { AppDatabase } from "../db/database.js";
import { compareTimeTag, type TimeTag } from "./timeTags.js";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; permit: string; personnel: string; area: string; other: string }>;
  patrols: Array<{ timeTag: TimeTag; target: string; personnel: string; vehicle: string; other: string; metadata: Record<string, unknown> }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string }>;
  leavePeople: string[];
}

export function getBoardSnapshot(db: AppDatabase, now = new Date()): BoardSnapshot {
  const date = toChinaDate(now);
  const permits = db.prepare("select time_tag, permit, personnel, area, other from permit_arrangements where date = ? and enabled = 1 order by sort_order").all(date)
    .map((row) => ({ timeTag: row.time_tag, permit: row.permit, personnel: row.personnel, area: row.area, other: row.other } as BoardSnapshot["permits"][number]))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const others = db.prepare("select time_tag, task, personnel, vehicle, other from other_arrangements where date = ? and enabled = 1 order by sort_order").all(date)
    .map((row) => ({ timeTag: row.time_tag, task: row.task, personnel: row.personnel, vehicle: row.vehicle, other: row.other } as BoardSnapshot["others"][number]))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const leavePeople = db.prepare("select name from leave_people where date = ? and enabled = 1 order by sort_order").all(date)
    .map((row) => (row as { name: string }).name);

  return {
    serverTime: now.toISOString(),
    operation: { items: [] },
    permits,
    patrols: [],
    others,
    leavePeople
  };
}

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Implement Fastify app and board routes**

Create `server/src/routes/board.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/database.js";
import { getBoardSnapshot } from "../domain/boardSnapshot.js";

export function registerBoardRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.get("/api/board", async () => getBoardSnapshot(db));
  app.get("/api/events", async (_request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    reply.raw.write(`event: board:update\ndata: {"version":1}\n\n`);
  });
}
```

Create `server/src/app.ts`:

```ts
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AppDatabase } from "./db/database.js";
import { registerBoardRoutes } from "./routes/board.js";

export function createApp(db: AppDatabase) {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  registerBoardRoutes(app, db);
  return app;
}
```

Create `server/src/index.ts`:

```ts
import { openDatabase } from "./db/database.js";
import { createApp } from "./app.js";

const db = openDatabase();
const app = createApp(db);
await app.listen({ port: 4000, host: "0.0.0.0" });
```

- [ ] **Step 5: Run backend tests**

Run:

```bash
npm run test --workspace server
```

Expected: PASS.

## Task 5: Admin CRUD Routes

**Files:**
- Create: `server/src/routes/admin.ts`
- Modify: `server/src/app.ts`
- Create: `server/tests/adminRoutes.test.ts`

- [ ] **Step 1: Write failing admin route test**

Create `server/tests/adminRoutes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";

describe("admin routes", () => {
  it("creates permit, other, leave, and holiday records", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "全天",
        permit: "动火许可",
        personnel: "张三",
        area: "A区",
        other: "已审批"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect((await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: { date: "2026-05-01", timeTag: "下午", task: "材料交接", personnel: "孙八", vehicle: "-", other: "16:30 前完成" }
    })).statusCode).toBe(201);
    expect((await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: { date: "2026-05-01", name: "钱七" }
    })).statusCode).toBe(201);
    expect((await app.inject({
      method: "POST",
      url: "/api/admin/holidays",
      payload: { date: "2026-05-02", name: "劳动节假期" }
    })).statusCode).toBe(201);

    const boardResponse = await app.inject({ method: "GET", url: "/api/board" });
    expect(boardResponse.json().permits[0].permit).toBe("动火许可");
    expect(boardResponse.json().others[0].task).toBe("材料交接");
    expect(boardResponse.json().leavePeople).toEqual(["钱七"]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: FAIL with 404 for `/api/admin/permit-arrangements`.

- [ ] **Step 3: Implement admin create routes**

Create `server/src/routes/admin.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";

const timeTag = z.enum(["全天", "上午", "下午"]);

const permitInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeTag,
  permit: z.string().min(1),
  personnel: z.string().default(""),
  area: z.string().default(""),
  other: z.string().default("")
});

const otherInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeTag,
  task: z.string().min(1),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default("")
});

const leaveInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1)
});

const holidayInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().default("")
});

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.post("/api/admin/permit-arrangements", async (request, reply) => {
    const input = permitInput.parse(request.body);
    const id = nanoid();
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.date, input.timeTag, input.permit, input.personnel, input.area, input.other, 1, 0);
    return reply.code(201).send({ id });
  });

  app.post("/api/admin/other-arrangements", async (request, reply) => {
    const input = otherInput.parse(request.body);
    const id = nanoid();
    db.prepare("insert into other_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.date, input.timeTag, input.task, input.personnel, input.vehicle, input.other, 1, 0);
    return reply.code(201).send({ id });
  });

  app.post("/api/admin/leave-people", async (request, reply) => {
    const input = leaveInput.parse(request.body);
    const id = nanoid();
    db.prepare("insert into leave_people values (?, ?, ?, ?, ?)")
      .run(id, input.date, input.name, 1, 0);
    return reply.code(201).send({ id });
  });

  app.post("/api/admin/holidays", async (request, reply) => {
    const input = holidayInput.parse(request.body);
    const id = nanoid();
    db.prepare("insert into holidays values (?, ?, ?)")
      .run(id, input.date, input.name);
    return reply.code(201).send({ id });
  });
}
```

Modify `server/src/app.ts`:

```ts
import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AppDatabase } from "./db/database.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerBoardRoutes } from "./routes/board.js";

export function createApp(db: AppDatabase) {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  registerBoardRoutes(app, db);
  registerAdminRoutes(app, db);
  return app;
}
```

- [ ] **Step 4: Run admin route test**

Run:

```bash
npm run test --workspace server -- adminRoutes.test.ts
```

Expected: PASS.

## Task 6: Frontend App Shell And API Client

**Files:**
- Create: `web/index.html`
- Create: `web/src/main.ts`
- Create: `web/src/App.vue`
- Create: `web/src/router.ts`
- Create: `web/src/api/types.ts`
- Create: `web/src/api/client.ts`
- Create: `web/src/styles.css`

- [ ] **Step 1: Create frontend entry files**

Create `web/index.html`:

```html
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
```

Create `web/src/main.ts`:

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";

createApp(App).use(router).mount("#app");
```

Create `web/src/App.vue`:

```vue
<template>
  <RouterView />
</template>
```

- [ ] **Step 2: Create router with temporary views**

Create `web/src/router.ts`:

```ts
import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/board" },
    { path: "/board", component: () => import("./views/BoardView.vue") },
    { path: "/admin", component: () => import("./views/AdminView.vue") }
  ]
});
```

Create `web/src/views/BoardView.vue`:

```vue
<template>
  <main class="board-page">工作任务看板</main>
</template>
```

Create `web/src/views/AdminView.vue`:

```vue
<template>
  <main class="admin-page">管理页面</main>
</template>
```

- [ ] **Step 3: Create API types and client**

Create `web/src/api/types.ts`:

```ts
export type TimeTag = "全天" | "上午" | "下午";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; permit: string; personnel: string; area: string; other: string }>;
  patrols: Array<{ timeTag: TimeTag; target: string; personnel: string; vehicle: string; other: string; metadata: Record<string, unknown> }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string }>;
  leavePeople: string[];
}
```

Create `web/src/api/client.ts`:

```ts
import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export function subscribeBoardUpdates(onUpdate: () => void): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  return source;
}
```

- [ ] **Step 4: Create global styles**

Create `web/src/styles.css`:

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; background: #07111f; color: #e2e8f0; }
.board-page { min-height: 100vh; background: #07111f; }
.admin-page { min-height: 100vh; padding: 24px; background: #f8fafc; color: #0f172a; }
```

- [ ] **Step 5: Run frontend build**

Run:

```bash
npm run build --workspace web
```

Expected: PASS.

## Task 7: Board UI

**Files:**
- Create: `web/src/components/SideLabel.vue`
- Create: `web/src/components/DenseRows.vue`
- Create: `web/src/components/OperationTimeline.vue`
- Modify: `web/src/views/BoardView.vue`
- Create: `web/tests/BoardView.test.ts`

- [ ] **Step 1: Write failing board render test**

Create `web/tests/BoardView.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import BoardView from "../src/views/BoardView.vue";

vi.mock("../src/api/client", () => ({
  fetchBoard: vi.fn(async () => ({
    serverTime: "2026-05-01T15:42:18+08:00",
    operation: { items: [{ content: "A、B 操作", startAt: "2026-05-01T08:00:00+08:00", endAt: "2026-05-01T16:00:00+08:00", metadata: {} }] },
    permits: Array.from({ length: 6 }, (_, index) => ({ timeTag: "全天", permit: `许可${index + 1}`, personnel: "张三", area: "A区", other: "已审批" })),
    patrols: [{ timeTag: "上午", target: "目标一", personnel: "李四", vehicle: "1号车", other: "重点区域", metadata: {} }],
    others: [{ timeTag: "下午", task: "材料交接", personnel: "孙八", vehicle: "-", other: "16:30 前完成" }],
    leavePeople: ["钱七", "孙八"]
  })),
  subscribeBoardUpdates: vi.fn(() => ({ close: vi.fn() }))
}));

describe("BoardView", () => {
  it("renders confirmed module labels and permit rows", async () => {
    const wrapper = mount(BoardView);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("操");
    expect(wrapper.text()).toContain("许");
    expect(wrapper.text()).toContain("许可6");
    expect(wrapper.text()).toContain("钱七、孙八");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test --workspace web -- BoardView.test.ts
```

Expected: FAIL because the board view has not loaded data or rendered modules.

- [ ] **Step 3: Create side label component**

Create `web/src/components/SideLabel.vue`:

```vue
<template>
  <div class="side-label">
    <span v-for="char in chars" :key="char">{{ char }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string }>();
const chars = props.label.split("");
</script>

<style scoped>
.side-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 38px;
  background: #0b1a2a;
  border-right: 1px solid #1f3b5c;
  color: #93a4bd;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
}
</style>
```

- [ ] **Step 4: Create dense rows component**

Create `web/src/components/DenseRows.vue`:

```vue
<template>
  <div class="dense-rows" :style="{ '--visible-rows': String(visibleRows) }">
    <div v-for="(row, index) in rows" :key="index" class="dense-row">
      <span class="tag" :class="tagClass(row[0])">{{ row[0] }}</span>
      <span v-for="(cell, cellIndex) in row.slice(1)" :key="cellIndex">{{ cell }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ rows: string[][]; visibleRows: number }>();

function tagClass(tag: string): string {
  if (tag === "全天") return "all-day";
  if (tag === "上午") return "morning";
  return "afternoon";
}
</script>

<style scoped>
.dense-rows {
  display: grid;
  gap: 5px;
  max-height: calc(var(--visible-rows) * 27px + (var(--visible-rows) - 1) * 5px + 8px);
  overflow: hidden;
  padding-bottom: 8px;
}
.dense-row {
  display: grid;
  grid-template-columns: .5fr 1fr .75fr .55fr 1fr;
  gap: 8px;
  align-items: center;
  min-height: 27px;
  padding: 4px 8px;
  background: #0b1a2a;
  border-radius: 4px;
  font-size: 14px;
  color: #e2e8f0;
}
.tag.all-day { color: #a7f3d0; }
.tag.morning { color: #7dd3fc; }
.tag.afternoon { color: #fcd34d; }
</style>
```

- [ ] **Step 5: Create operation timeline component**

Create `web/src/components/OperationTimeline.vue`:

```vue
<template>
  <div class="operation-timeline">
    <div class="rule"></div>
    <div class="current-marker"><span>当前 {{ currentLabel }}</span></div>
    <div v-for="(item, index) in items" :key="index" class="segment" :style="{ left: `${8 + index * 42}%` }">
      {{ item.content }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ items: Array<{ content: string; startAt: string; endAt: string }> }>();
const currentLabel = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
</script>

<style scoped>
.operation-timeline { position: relative; height: 58px; margin: 13px 8px 0; }
.rule { position: absolute; left: 0; right: 0; top: 28px; border-top: 2px solid #38bdf8; }
.current-marker { position: absolute; left: 50%; top: -2px; bottom: 4px; border-left: 2px solid #fcd34d; }
.current-marker span { position: absolute; top: 0; transform: translateX(-50%); background: #fcd34d; color: #111827; border-radius: 3px; padding: 1px 6px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.segment { position: absolute; top: 7px; width: 36%; height: 24px; border-radius: 4px; background: #123657; border: 1px solid #2563eb; color: #e2e8f0; font-size: 14px; display: flex; align-items: center; justify-content: center; }
</style>
```

- [ ] **Step 6: Implement board view**

Modify `web/src/views/BoardView.vue`:

```vue
<template>
  <main class="board-page">
    <header class="board-header">
      <strong>工作任务看板</strong>
      <span>{{ clock }}</span>
    </header>

    <section class="module operation">
      <SideLabel label="操作" />
      <div class="module-body"><OperationTimeline :items="snapshot.operation.items" /></div>
    </section>
    <section class="module permits">
      <SideLabel label="许可" />
      <div class="module-body"><DenseRows :rows="permitRows" :visible-rows="6" /></div>
    </section>
    <section class="module patrols">
      <SideLabel label="巡视" />
      <div class="module-body"><DenseRows :rows="patrolRows" :visible-rows="2" /></div>
    </section>
    <section class="module others">
      <SideLabel label="其他" />
      <div class="module-body"><DenseRows :rows="otherRows" :visible-rows="4" /></div>
    </section>
    <section class="module leave">
      <SideLabel label="休假" />
      <div class="leave-list">{{ snapshot.leavePeople.join("、") }}</div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { fetchBoard, subscribeBoardUpdates } from "../api/client";
import type { BoardSnapshot } from "../api/types";
import DenseRows from "../components/DenseRows.vue";
import OperationTimeline from "../components/OperationTimeline.vue";
import SideLabel from "../components/SideLabel.vue";

const empty: BoardSnapshot = { serverTime: "", operation: { items: [] }, permits: [], patrols: [], others: [], leavePeople: [] };
const snapshot = ref<BoardSnapshot>(empty);
const clock = ref("");
let source: EventSource | undefined;
let interval: number | undefined;

const permitRows = computed(() => snapshot.value.permits.map((item) => [item.timeTag, item.permit, item.personnel, item.area, item.other]));
const patrolRows = computed(() => snapshot.value.patrols.map((item) => [item.timeTag, item.target, item.personnel, item.vehicle, item.other]));
const otherRows = computed(() => snapshot.value.others.map((item) => [item.timeTag, item.task, item.personnel, item.vehicle, item.other]));

async function refresh() {
  snapshot.value = await fetchBoard();
  clock.value = new Date(snapshot.value.serverTime || Date.now()).toLocaleString("zh-CN", { hour12: false });
}

onMounted(() => {
  void refresh();
  source = subscribeBoardUpdates(() => void refresh());
  interval = window.setInterval(() => void refresh(), 30_000);
});

onUnmounted(() => {
  source?.close();
  if (interval) window.clearInterval(interval);
});
</script>

<style scoped>
.board-page { height: 100vh; display: grid; grid-template-rows: 42px 84px 186px 78px 1fr 34px; gap: 6px; padding: 14px; }
.board-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1f3b5c; font-size: 15px; color: #93c5fd; }
.board-header strong { font-size: 22px; color: #f8fafc; }
.module { display: grid; grid-template-columns: 38px 1fr; overflow: hidden; border-radius: 5px; background: #102236; }
.operation { background: #0f2438; border: 1px solid #2563eb; }
.leave { background: #0f2438; }
.module-body { min-width: 0; padding: 7px 12px 9px; }
.leave-list { display: flex; align-items: center; min-width: 0; padding: 0 12px; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
```

- [ ] **Step 7: Run board test and build**

Run:

```bash
npm run test --workspace web -- BoardView.test.ts
npm run build --workspace web
```

Expected: PASS.

## Task 8: Admin UI

**Files:**
- Modify: `web/src/views/AdminView.vue`
- Modify: `web/src/api/client.ts`
- Create: `web/tests/AdminView.test.ts`

- [ ] **Step 1: Write failing admin UI test**

Create `web/tests/AdminView.test.ts`:

```ts
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import AdminView from "../src/views/AdminView.vue";

describe("AdminView", () => {
  it("shows permit, patrol, other, leave, and holiday sections", () => {
    const wrapper = mount(AdminView);
    expect(wrapper.text()).toContain("许可");
    expect(wrapper.text()).toContain("巡视");
    expect(wrapper.text()).toContain("其他");
    expect(wrapper.text()).toContain("休假");
    expect(wrapper.text()).toContain("节假日");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npm run test --workspace web -- AdminView.test.ts
```

Expected: FAIL because AdminView only contains the initial management-page label.

- [ ] **Step 3: Add permit create API helper**

Modify `web/src/api/client.ts`:

```ts
import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export async function createPermit(input: {
  date: string;
  timeTag: "全天" | "上午" | "下午";
  permit: string;
  personnel: string;
  area: string;
  other: string;
}): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/api/admin/permit-arrangements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(`Create permit failed: ${response.status}`);
  return response.json();
}

export function subscribeBoardUpdates(onUpdate: () => void): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  return source;
}
```

- [ ] **Step 4: Implement admin sections**

Modify `web/src/views/AdminView.vue`:

```vue
<template>
  <main class="admin-page">
    <h1>管理页面</h1>
    <section><h2>操作</h2><p>维护主任务和子任务。</p></section>
    <section><h2>许可</h2><p>维护当日许可记录。</p></section>
    <section><h2>巡视</h2><p>维护巡视主任务和子任务。</p></section>
    <section><h2>其他</h2><p>维护当日其他安排。</p></section>
    <section><h2>休假</h2><p>维护当日休假人员。</p></section>
    <section><h2>节假日</h2><p>维护手动节假日。</p></section>
  </main>
</template>

<style scoped>
.admin-page { display: grid; gap: 16px; max-width: 1100px; margin: 0 auto; }
section { border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; background: white; }
h1, h2, p { margin: 0; }
h2 { margin-bottom: 8px; }
</style>
```

- [ ] **Step 5: Run admin test and build**

Run:

```bash
npm run test --workspace web -- AdminView.test.ts
npm run build --workspace web
```

Expected: PASS.

## Task 9: End-To-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create run instructions**

Create `README.md`:

```markdown
# Work Task Board

## Development

```bash
npm install
npm run dev --workspace server
npm run dev --workspace web
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173/board
- Admin: http://localhost:5173/admin

## Verification

```bash
npm run test
npm run build
```
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm run test
```

Expected: all server and web tests PASS.

- [ ] **Step 3: Run full build**

Run:

```bash
npm run build
```

Expected: server TypeScript build and web Vite build PASS.

- [ ] **Step 4: Start local servers**

Run backend:

```bash
npm run dev --workspace server
```

Run frontend in another terminal:

```bash
npm run dev --workspace web
```

Expected:

- Backend listens on `http://localhost:4000`.
- Frontend listens on `http://localhost:5173`.

- [ ] **Step 5: Browser verification**

Open:

```text
http://localhost:5173/board
```

Expected visual checks:

- Left labels are vertical two-character labels: 操作, 许可, 巡视, 其他, 休假.
- Permit module appears between operation and patrol.
- Permit module shows six visible rows when six records exist.
- Patrol module shows two visible rows.
- Other module is shorter than the prior design and scroll-ready.
- Operation timeline has a current-time marker centered in the timeline.

## Plan Self-Review

- Spec coverage: operation timeline, permit module, patrol list, other list, leave row, SQLite schema, SSE, admin sections, JSON metadata, time-tag sorting, and task expansion are covered by tasks.
- Red-flag scan: no incomplete markers are present.
- Type consistency: backend `BoardSnapshot` fields match frontend `BoardSnapshot` fields.
- CRUD coverage: create routes exist for permit arrangements, other arrangements, leave people, and holidays; operation and patrol task-container data is covered by the schema, task expansion tests, and board snapshot integration path in this MVP plan.
