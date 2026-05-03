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
    insertTaskInstance(db, {
      id: "p1",
      type: "permit",
      date: "2026-05-01",
      timeTag: "下午",
      content: "封闭许可",
      target: "西侧",
      personnel: "孙八",
      other: "待确认"
    });
    insertTaskInstance(db, {
      id: "p2",
      type: "permit",
      date: "2026-05-01",
      timeTag: "全天",
      content: "动火许可",
      target: "A区",
      personnel: "张三",
      other: "已审批"
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.permits.map((permit) => permit.timeTag)).toEqual(["全天", "下午"]);
  });

  it("sorts other arrangements by time tag", () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "o1",
      type: "other",
      date: "2026-05-01",
      timeTag: "下午",
      content: "清点物资",
      personnel: "李四",
      vehicle: "电瓶车"
    });
    insertTaskInstance(db, {
      id: "o2",
      type: "other",
      date: "2026-05-01",
      timeTag: "上午",
      content: "设备巡检",
      personnel: "王五",
      vehicle: "皮卡"
    });
    insertTaskInstance(db, {
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
    insertTaskInstance(db, {
      id: "p1",
      type: "permit",
      date,
      timeTag: "上午",
      content: "动火许可",
      target: "A区",
      personnel: "张三",
      vehicle: "工程车",
      other: "已审批"
    });
    insertTaskInstance(db, {
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
      permits: [{ timeTag: "上午", target: "A区", task: "动火许可", personnel: "张三", vehicle: "工程车", other: "已审批" }],
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

  it("shows manual instances with no template linkage inside the date window", () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "manual-1",
      type: "permit",
      date: "2026-05-01",
      sourceType: "manual",
      templateId: null,
      sourceTemplateItemId: null,
      timeTag: "上午",
      content: "临时作业许可",
      target: "B区",
      personnel: "周九"
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.permits).toEqual([
      { timeTag: "上午", target: "B区", task: "临时作业许可", personnel: "周九", vehicle: "", other: "", status: "pending" }
    ]);
  });

  it("uses generated instance snapshots instead of live template item content", () => {
    const db = createTestDatabase();
    insertTemplate(db, { id: "template-1", type: "patrol" });
    insertTemplateItem(db, {
      id: "item-1",
      templateId: "template-1",
      content: "模板旧内容",
      metadata: { timeTag: "上午", target: "模板旧目标", personnel: "模板旧人员", vehicle: "模板旧车辆", other: "模板旧备注" }
    });
    insertTaskInstance(db, {
      id: "generated-1",
      type: "patrol",
      date: "2026-05-01",
      templateId: "template-1",
      sourceTemplateItemId: "item-1",
      sourceType: "generated",
      generationKey: "template-1:item-1:2026-05-01T00:00:00+08:00",
      timeTag: "下午",
      content: "生成时内容",
      target: "生成时目标",
      personnel: "生成时人员",
      vehicle: "生成时车辆",
      other: "生成时备注",
      metadata: { cycleDay: 7 }
    });
    db.prepare("update task_template_items set content = ?, ext_data_json = ? where id = ?").run(
      "模板新内容",
      JSON.stringify({ timeTag: "上午", target: "模板新目标", personnel: "模板新人员" }),
      "item-1"
    );

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.patrols).toEqual([
      {
        timeTag: "下午",
        target: "生成时目标",
        personnel: "生成时人员",
        vehicle: "生成时车辆",
        other: "生成时备注",
        status: "pending",
        metadata: {
          cycleDay: 7,
          timeTag: "下午",
          target: "生成时目标",
          personnel: "生成时人员",
          vehicle: "生成时车辆",
          other: "生成时备注"
        }
      }
    ]);
  });

  it("includes multi-day instances that overlap the requested board date", () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "overnight-operation",
      type: "operation",
      date: "2026-04-30",
      startAt: "2026-04-30T23:00:00+08:00",
      endAt: "2026-05-01T02:00:00+08:00",
      content: "跨日运行"
    });
    insertTaskInstance(db, {
      id: "overnight-patrol",
      type: "patrol",
      date: "2026-04-30",
      startAt: "2026-04-30T20:00:00+08:00",
      endAt: "2026-05-01T04:00:00+08:00",
      timeTag: "全天",
      content: "跨日巡查",
      target: "围界"
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.operation.items).toEqual([
      { content: "跨日运行", startAt: "2026-04-30T23:00:00+08:00", endAt: "2026-05-01T02:00:00+08:00", status: "pending", metadata: {} }
    ]);
    expect(snapshot.patrols).toMatchObject([{ target: "围界" }]);
  });

  it("filters task instances by SQL time-window overlap across legacy timestamp formats", () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "legacy-boundary-permit",
      type: "permit",
      date: "2026-04-30",
      startAt: "2026-04-30T22:00:00+08:00",
      endAt: "2026-05-01T00:00:00+08:00",
      content: "边界许可",
      target: "边界区域"
    });
    insertTaskInstance(db, {
      id: "utc-permit",
      type: "permit",
      date: "2026-05-01",
      startAt: "2026-04-30T16:30:00.000Z",
      endAt: "2026-04-30T17:30:00.000Z",
      content: "UTC许可",
      target: "UTC区域"
    });
    insertTaskInstance(db, {
      id: "outside-permit",
      type: "permit",
      date: "2026-05-03",
      startAt: "2026-05-03T08:00:00.000+08:00",
      endAt: "2026-05-03T09:00:00.000+08:00",
      content: "远期许可",
      target: "远期区域"
    });
    const prepareSpy = vi.spyOn(db, "prepare");

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    const taskInstanceSql = prepareSpy.mock.calls
      .map(([sql]) => sql)
      .filter((sql) => typeof sql === "string" && sql.includes("from task_instances"));
    expect(taskInstanceSql.some((sql) => sql.includes("julianday(start_at) <= julianday(?)") && sql.includes("julianday(end_at) >= julianday(?)"))).toBe(true);
    expect(snapshot.permits.map((permit) => permit.task)).toEqual(expect.arrayContaining(["边界许可", "UTC许可"]));
    expect(snapshot.permits).toHaveLength(2);
  });

  it("omits cancelled instances from the board", () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "active-operation",
      type: "operation",
      date: "2026-05-01",
      content: "保留任务",
      status: "in_progress"
    });
    insertTaskInstance(db, {
      id: "cancelled-operation",
      type: "operation",
      date: "2026-05-01",
      content: "取消任务",
      status: "cancelled"
    });

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T08:30:00+08:00"));

    expect(snapshot.operation.items).toEqual([
      expect.objectContaining({ content: "保留任务", status: "in_progress" })
    ]);
  });

  it("warns and falls back when task metadata JSON is invalid", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const db = createTestDatabase();
    db.prepare(
      `insert into task_instances
       (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
        start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values (?, 'operation', null, null, 'manual', null, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      "operation-1",
      "2026-05-01",
      "2026-05-01T08:00:00+08:00",
      "2026-05-01T09:00:00+08:00",
      "检查设备",
      "{not-json",
      "2026-05-01T08:00:00+08:00",
      "2026-05-01T08:00:00+08:00"
    );

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T08:30:00+08:00"));

    expect(snapshot.operation.items[0].metadata).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith("Failed to parse task metadata JSON", { raw: "{not-json" });
  });
});

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function insertTaskInstance(
  db: AppDatabase,
  input: {
    id: string;
    type: "operation" | "permit" | "patrol" | "other";
    date: string;
    sourceType?: "generated" | "manual" | "override";
    templateId?: string | null;
    sourceTemplateItemId?: string | null;
    generationKey?: string | null;
    startAt?: string;
    endAt?: string;
    status?: "pending" | "in_progress" | "done" | "cancelled";
    timeTag?: "全天" | "上午" | "下午";
    content: string;
    target?: string;
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
  const timeTag = input.timeTag ?? "全天";
  const [start, end] = rangeByTag[timeTag];
  const now = "2026-05-01T00:00:00.000Z";

  const metadata =
    input.type === "operation" && !input.metadata
      ? {}
      : {
          ...(input.metadata ?? {}),
          timeTag,
          target: input.target ?? input.content,
          personnel: input.personnel ?? "",
          vehicle: input.vehicle ?? "",
          other: input.other ?? ""
        };

  db.prepare(
    `insert into task_instances
     (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
      start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.type,
    input.templateId ?? null,
    input.sourceTemplateItemId ?? null,
    input.sourceType ?? "generated",
    input.generationKey ?? null,
    input.date,
    input.startAt ?? `${input.date}T${start}`,
    input.endAt ?? `${input.date}T${end}`,
    input.content,
    JSON.stringify(metadata),
    input.status ?? "pending",
    now,
    now
  );
}

function insertTemplate(
  db: AppDatabase,
  input: {
    id: string;
    type: "operation" | "permit" | "patrol" | "other";
  }
): void {
  const now = "2026-05-01T00:00:00.000Z";
  db.prepare(
    `insert into task_templates
     (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
      recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json, created_at, updated_at)
     values (?, ?, ?, '', '2026-05-01T00:00:00+08:00', '2026-05-01T23:59:59+08:00',
             'once', null, null, 0, 0, 1, '{}', ?, ?)`
  ).run(input.id, input.type, input.id, now, now);
}

function insertTemplateItem(
  db: AppDatabase,
  input: {
    id: string;
    templateId: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
): void {
  db.prepare(
    `insert into task_template_items
     (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, 0, 60, ?, ?, 0)`
  ).run(input.id, input.templateId, input.content, JSON.stringify(input.metadata ?? {}));
}
