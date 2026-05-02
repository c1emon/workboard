import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase, type AppDatabase } from "../src/db/database.js";
import { getBoardSnapshot } from "../src/domain/boardSnapshot.js";
import { createBoardEventBroadcaster } from "../src/routes/boardEvents.js";

describe("board snapshot", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sorts permits by time tag", () => {
    const db = createTestDatabase();
    insertArrangementContainer(db, {
      id: "p1",
      type: "permit",
      date: "2026-05-01",
      timeTag: "下午",
      content: "封闭许可",
      personnel: "孙八",
      other: "待确认",
      metadata: { area: "西侧" }
    });
    insertArrangementContainer(db, {
      id: "p2",
      type: "permit",
      date: "2026-05-01",
      timeTag: "全天",
      content: "动火许可",
      personnel: "张三",
      other: "已审批",
      metadata: { area: "A区" }
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.permits.map((permit) => permit.timeTag)).toEqual(["全天", "下午"]);
  });

  it("sorts other arrangements by time tag", () => {
    const db = createTestDatabase();
    insertArrangementContainer(db, {
      id: "o1",
      type: "other",
      date: "2026-05-01",
      timeTag: "下午",
      content: "清点物资",
      personnel: "李四",
      vehicle: "电瓶车"
    });
    insertArrangementContainer(db, {
      id: "o2",
      type: "other",
      date: "2026-05-01",
      timeTag: "上午",
      content: "设备巡检",
      personnel: "王五",
      vehicle: "皮卡"
    });
    insertArrangementContainer(db, {
      id: "o3",
      type: "other",
      date: "2026-05-01",
      timeTag: "全天",
      content: "值守",
      personnel: "赵六"
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.others.map((other) => other.timeTag)).toEqual(["全天", "上午", "下午"]);
  });

  it("returns board snapshot JSON from the board route", async () => {
    const db = createTestDatabase();
    const date = toChinaDate(new Date());
    insertArrangementContainer(db, {
      id: "p1",
      type: "permit",
      date,
      timeTag: "上午",
      content: "动火许可",
      personnel: "张三",
      other: "已审批",
      metadata: { area: "A区" }
    });
    insertArrangementContainer(db, {
      id: "o1",
      type: "other",
      date,
      timeTag: "全天",
      content: "值守",
      personnel: "赵六"
    });
    db.prepare("insert into leave_people values (?, ?, ?, ?, ?)")
      .run("l1", date, "钱七", 1, 0);
    const app = createApp(db);

    const response = await app.inject({ method: "GET", url: "/api/board" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toMatchObject({
      operation: { items: [] },
      permits: [{ timeTag: "上午", permit: "动火许可", personnel: "张三", area: "A区", other: "已审批" }],
      patrols: [],
      others: [{ timeTag: "全天", task: "值守", personnel: "赵六", vehicle: "", other: "" }],
      leavePeople: ["钱七"]
    });
  });

  it("writes current board event version and broadcasts later updates", () => {
    const calls: string[] = [];
    const raw = {
      writeHead: (statusCode: number, headers: Record<string, string>) => {
        calls.push(
          `writeHead:${statusCode}:${headers["Content-Type"]}:${headers["Access-Control-Allow-Origin"]}:${headers.Vary}`
        );
      },
      write: (chunk: string) => {
        calls.push(`write:${chunk}`);
      },
      end: () => {
        calls.push("end");
      }
    };
    const boardEvents = createBoardEventBroadcaster();
    const cleanup = boardEvents.register(raw, {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      Vary: "Origin"
    });
    boardEvents.publish();
    cleanup();
    boardEvents.publish();

    expect(calls).toEqual([
      "writeHead:200:text/event-stream:http://localhost:5173:Origin",
      'write:event: board:update\ndata: {"version":1}\n\n',
      'write:event: board:update\ndata: {"version":2}\n\n'
    ]);
  });

  it("sends heartbeat comments and unregisters streams on close or error", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const handlers = new Map<string, () => void>();
    const raw = {
      writeHead: (statusCode: number, headers: Record<string, string>) => {
        calls.push(`writeHead:${statusCode}:${headers["Content-Type"]}`);
      },
      write: (chunk: string) => {
        calls.push(`write:${chunk}`);
      },
      on: (event: string, handler: () => void) => {
        handlers.set(event, handler);
      },
      off: (event: string) => {
        handlers.delete(event);
      }
    };
    const boardEvents = createBoardEventBroadcaster(1, { heartbeatIntervalMs: 1000 });

    boardEvents.register(raw);
    vi.advanceTimersByTime(1000);
    handlers.get("error")?.();
    boardEvents.publish();

    expect(calls).toEqual([
      "writeHead:200:text/event-stream",
      'write:event: board:update\ndata: {"version":1}\n\n',
      "write:: heartbeat\n\n"
    ]);
    expect(handlers.has("close")).toBe(false);
    expect(handlers.has("error")).toBe(false);
  });

  it("warns and falls back when task metadata JSON is invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = createTestDatabase();
    db.prepare(
      `insert into task_containers
       (id, type, name, start_at, end_at, recurrence_type, recurrence_interval_minutes, recurrence_count,
        skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "operation-1",
      "operation",
      "运行",
      "2026-05-01T08:00:00+08:00",
      "2026-05-01T09:00:00+08:00",
      "once",
      null,
      null,
      0,
      0,
      1,
      "2026-05-01T08:00:00+08:00",
      "2026-05-01T08:00:00+08:00"
    );
    db.prepare(
      `insert into task_items
       (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
       values (?, ?, ?, ?, ?, ?, ?)`
    ).run("item-1", "operation-1", 0, 60, "检查设备", "{not-json", 0);

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T08:30:00+08:00"));

    expect(snapshot.operation.items[0].metadata).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith("Failed to parse task metadata JSON", { raw: "{not-json" });
  });
});

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function insertArrangementContainer(
  db: AppDatabase,
  input: {
    id: string;
    type: "permit" | "other";
    date: string;
    timeTag: "全天" | "上午" | "下午";
    content: string;
    personnel?: string;
    vehicle?: string;
    other?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const rangeByTag = {
    全天: ["00:00:00+08:00", "23:59:59+08:00", 1439],
    上午: ["08:00:00+08:00", "12:00:00+08:00", 240],
    下午: ["12:00:00+08:00", "17:00:00+08:00", 300]
  } as const;
  const [start, end, durationMinutes] = rangeByTag[input.timeTag];
  const now = "2026-05-01T00:00:00.000Z";

  db.prepare(
    `insert into task_containers
     (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
      recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, 'once', null, null, 0, 0, 1, ?, ?)`
  ).run(
    input.id,
    input.type,
    input.type === "permit" ? "许可" : "其他",
    input.type === "permit" ? "许可安排" : "其他安排",
    `${input.date}T${start}`,
    `${input.date}T${end}`,
    now,
    now
  );
  db.prepare(
    `insert into task_items
     (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, 0, ?, ?, ?, 0)`
  ).run(
    `${input.id}:item`,
    input.id,
    durationMinutes,
    input.content,
    JSON.stringify({
      ...(input.metadata ?? {}),
      timeTag: input.timeTag,
      target: input.content,
      personnel: input.personnel ?? "",
      vehicle: input.vehicle ?? "",
      other: input.other ?? ""
    })
  );
}
