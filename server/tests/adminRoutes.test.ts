import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase, type AppDatabase } from "../src/db/database.js";
import { createBoardEventBroadcaster } from "../src/routes/boardEvents.js";

describe("admin routes", () => {
  it("disables request logging during tests", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    expect(app.log.level).toBeUndefined();

    await app.close();
  });

  it("rejects overlong admin route ids", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const overlongId = "x".repeat(65);

    const response = await app.inject({
      method: "DELETE",
      url: `/api/admin/leave-people/${overlongId}`
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid admin payload",
      issues: [
        {
          path: ["id"]
        }
      ]
    });
  });

  it("lists task instances by overlapping date and optional type", async () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "manual-patrol",
      type: "patrol",
      sourceType: "manual",
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "人工巡视",
      metadata: { target: "A区" }
    });
    insertTaskInstance(db, {
      id: "generated-patrol",
      type: "patrol",
      sourceType: "generated",
      generationKey: "template:item:2026-05-01T00:00:00+08:00",
      occurrenceDate: "2026-05-01",
      startAt: "2026-04-30T23:00:00+08:00",
      endAt: "2026-05-01T01:00:00+08:00",
      content: "跨日生成巡视"
    });
    insertTaskInstance(db, {
      id: "manual-operation",
      type: "operation",
      sourceType: "manual",
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T09:00:00+08:00",
      endAt: "2026-05-01T10:00:00+08:00",
      content: "操作"
    });
    const app = createApp(db);

    const patrolResponse = await app.inject({ method: "GET", url: "/api/admin/task-instances?date=2026-05-01&type=patrol" });
    const allResponse = await app.inject({ method: "GET", url: "/api/admin/task-instances?date=2026-05-01" });
    const allScopeResponse = await app.inject({ method: "GET", url: "/api/admin/task-instances?scope=all&type=patrol" });
    await app.close();

    expect(patrolResponse.statusCode).toBe(200);
    expect(patrolResponse.json()).toEqual([
      expect.objectContaining({
        id: "generated-patrol",
        type: "patrol",
        sourceType: "generated",
        generationKey: "template:item:2026-05-01T00:00:00+08:00",
        content: "跨日生成巡视"
      }),
      expect.objectContaining({
        id: "manual-patrol",
        type: "patrol",
        sourceType: "manual",
        metadata: { target: "A区" },
        content: "人工巡视"
      })
    ]);
    expect(allResponse.json().map((row: { id: string }) => row.id)).toEqual(["generated-patrol", "manual-patrol", "manual-operation"]);
    expect(allScopeResponse.json().map((row: { id: string }) => row.id)).toEqual(["manual-patrol", "generated-patrol"]);
  });

  it("lists task instances with non-China-offset datetimes by actual overlap", async () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "utc-instance",
      type: "operation",
      sourceType: "manual",
      occurrenceDate: "2026-05-01",
      startAt: "2026-04-30T16:30:00.000Z",
      endAt: "2026-04-30T17:30:00.000Z",
      content: "UTC 时间实例"
    });
    const app = createApp(db);

    const response = await app.inject({ method: "GET", url: "/api/admin/task-instances?date=2026-05-01&type=operation" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: "utc-instance",
        occurrenceDate: "2026-05-01",
        startAt: "2026-04-30T16:30:00.000Z",
        endAt: "2026-04-30T17:30:00.000Z"
      })
    ]);
  });

  it("creates a manual task instance and publishes a board event", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    const app = createApp(db, { boardEvents });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/task-instances",
      payload: {
        type: "patrol",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        content: "人工巡视",
        metadata: { target: "A区" }
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(expect.objectContaining({
      id: expect.any(String),
      type: "patrol",
      templateId: null,
      sourceTemplateItemId: null,
      sourceType: "manual",
      generationKey: null,
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "人工巡视",
      metadata: { target: "A区" },
      status: "pending"
    }));
    expect(boardEvents.getVersion()).toBe(2);
  });

  it("edits pending manual instances and rejects generated or done instances", async () => {
    const db = createTestDatabase();
    insertTaskInstance(db, { id: "manual-pending", type: "patrol", sourceType: "manual", status: "pending" });
    insertTaskInstance(db, { id: "generated-pending", type: "patrol", sourceType: "generated", status: "pending", generationKey: "g:1" });
    insertTaskInstance(db, { id: "manual-done", type: "patrol", sourceType: "manual", status: "done" });
    const app = createApp(db);

    const updateResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/task-instances/manual-pending",
      payload: {
        type: "other",
        startAt: "2026-05-02T09:00:00+08:00",
        endAt: "2026-05-02T10:00:00+08:00",
        content: "更新内容",
        metadata: { note: "ok" }
      }
    });
    const generatedResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/task-instances/generated-pending",
      payload: {
        type: "patrol",
        startAt: "2026-05-01T09:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        content: "拒绝更新",
        metadata: {}
      }
    });
    const doneResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/task-instances/manual-done",
      payload: {
        type: "patrol",
        startAt: "2026-05-01T09:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        content: "拒绝更新",
        metadata: {}
      }
    });
    await app.close();

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toEqual(expect.objectContaining({
      id: "manual-pending",
      type: "other",
      occurrenceDate: "2026-05-02",
      content: "更新内容",
      metadata: { note: "ok" }
    }));
    expect(generatedResponse.statusCode).toBe(409);
    expect(doneResponse.statusCode).toBe(409);
  });

  it("changes task instance status and publishes a board event", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    insertTaskInstance(db, { id: "manual-pending", type: "patrol", sourceType: "manual", status: "pending" });
    const app = createApp(db, { boardEvents });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/admin/task-instances/manual-pending/status",
      payload: { status: "cancelled" }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({ id: "manual-pending", status: "cancelled" }));
    expect(boardEvents.getVersion()).toBe(2);
  });

  it("deletes task instances regardless of source type", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    insertTaskInstance(db, { id: "manual-pending", type: "patrol", sourceType: "manual", status: "pending" });
    insertTaskInstance(db, { id: "generated-pending", type: "patrol", sourceType: "generated", status: "pending", generationKey: "g:1" });
    const app = createApp(db, { boardEvents });

    const deleteResponse = await app.inject({ method: "DELETE", url: "/api/admin/task-instances/manual-pending" });
    const generatedResponse = await app.inject({ method: "DELETE", url: "/api/admin/task-instances/generated-pending" });
    await app.close();

    expect(deleteResponse.statusCode).toBe(204);
    expect(generatedResponse.statusCode).toBe(204);
    expect(db.prepare("select id from task_instances where id = ?").get("manual-pending")).toBeUndefined();
    expect(db.prepare("select id from task_instances where id = ?").get("generated-pending")).toBeUndefined();
    expect(boardEvents.getVersion()).toBe(3);
  });

  it("generates task instances idempotently through the admin endpoint", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    insertTaskTemplate(db, {
      id: "operation-template",
      type: "operation",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T09:00:00+08:00"
    });
    insertTaskTemplateItem(db, {
      id: "operation-item",
      templateId: "operation-template",
      content: "检查设备"
    });

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-instances/generate",
      payload: { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["operation"] }
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-instances/generate",
      payload: { windowStartDate: "2026-05-01", windowEndDate: "2026-05-01", types: ["operation"] }
    });
    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(secondResponse.json()).toEqual({ inserted: 0, updated: 0, skipped: 1 });
    expect(db.prepare("select count(*) as count from task_instances").get()).toEqual({ count: 1 });
  });

  it("generates task instances for selected templates through the admin endpoint", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    insertTaskTemplate(db, {
      id: "operation-template-1",
      type: "operation",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T09:00:00+08:00"
    });
    insertTaskTemplate(db, {
      id: "operation-template-2",
      type: "operation",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T09:00:00+08:00"
    });
    insertTaskTemplateItem(db, { id: "operation-item-1", templateId: "operation-template-1", content: "一号模板任务" });
    insertTaskTemplateItem(db, { id: "operation-item-2", templateId: "operation-template-2", content: "二号模板任务" });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/task-instances/generate",
      payload: {
        windowStartDate: "2026-05-01",
        windowEndDate: "2026-05-01",
        types: ["operation"],
        templateIds: ["operation-template-2"]
      }
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ inserted: 1, updated: 0, skipped: 0 });
    expect(db.prepare("select content from task_instances").all()).toEqual([{ content: "二号模板任务" }]);
  });

  it("creates arrangements and exposes today's board records", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = toChinaDate(new Date());

    const permitResponse = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date,
        timeTag: "上午",
        target: "A区",
        task: "动火许可",
        personnel: "张三",
        vehicle: "工程车",
        other: "已审批"
      }
    });
    const otherResponse = await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: {
        date,
        timeTag: "下午",
        task: "设备巡检",
        personnel: "李四",
        vehicle: "皮卡",
        other: "带工具"
      }
    });
    const leaveResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: {
        date,
        name: "王五"
      }
    });
    const holidayResponse = await app.inject({
      method: "POST",
      url: "/api/admin/holidays",
      payload: {
        date,
        name: "劳动节"
      }
    });

    const boardResponse = await app.inject({ method: "GET", url: "/api/board" });
    await app.close();

    expect(permitResponse.statusCode).toBe(201);
    expect(otherResponse.statusCode).toBe(201);
    expect(leaveResponse.statusCode).toBe(201);
    expect(holidayResponse.statusCode).toBe(201);
    expect(permitResponse.json()).toEqual({ id: expect.any(String) });
    expect(otherResponse.json()).toEqual({ id: expect.any(String) });
    expect(leaveResponse.json()).toEqual({ id: expect.any(String) });
    expect(holidayResponse.json()).toEqual({ id: expect.any(String) });
    expect(boardResponse.json()).toMatchObject({
      permits: [{ timeTag: "上午", target: "A区", task: "动火许可", personnel: "张三", vehicle: "工程车", other: "已审批" }],
      others: [{ timeTag: "下午", task: "设备巡检", personnel: "李四", vehicle: "皮卡", other: "带工具" }],
      leavePeople: ["王五"]
    });
  });

  it("imports chinese-days holidays with full replacement and lists them by year", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    await app.inject({
      method: "POST",
      url: "/api/admin/holidays",
      payload: {
        date: "2025-01-01",
        name: "旧节假日"
      }
    });

    const importResponse = await app.inject({
      method: "POST",
      url: "/api/admin/holidays/import",
      payload: {
        holidays: {
          "2026-05-01": "Labour Day,劳动节,2",
          "2026-05-02": "Labour Day,劳动节,2",
          "2027-01-01": "New Year's Day,元旦,1"
        },
        workdays: {
          "2026-04-26": "Labour Day,劳动节,2"
        },
        inLieuDays: {
          "2026-05-02": "Labour Day,劳动节,2"
        }
      }
    });
    const listResponse = await app.inject({
      method: "GET",
      url: "/api/admin/holidays?year=2026"
    });
    const oldYearResponse = await app.inject({
      method: "GET",
      url: "/api/admin/holidays?year=2025"
    });
    await app.close();

    expect(importResponse.statusCode).toBe(200);
    expect(importResponse.json()).toEqual({ imported: 4, holidays: 3, adjustedWorkdays: 1 });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      { id: expect.any(String), date: "2026-04-26", name: "劳动节", type: "adjusted_workday" },
      { id: expect.any(String), date: "2026-05-01", name: "劳动节", type: "holiday" },
      { id: expect.any(String), date: "2026-05-02", name: "劳动节", type: "holiday" }
    ]);
    expect(oldYearResponse.json()).toEqual([]);
  });

  it("creates operation task plans and stores child items in template tables", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const now = new Date();
    const startAt = formatChinaDateTime(now.getTime() - 30 * 60_000);
    const endAt = formatChinaDateTime(now.getTime() + 90 * 60_000);

    const planResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "倒闸操作",
        description: "主线切换",
        startAt,
        endAt,
        recurrenceType: "once"
      }
    });
    const { id: planId } = planResponse.json() as { id: string };

    const itemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${planId}/items`,
      payload: {
        offsetMinutes: 15,
        durationMinutes: 30,
        content: "检查闭锁状态",
        metadata: { priority: "P1" },
        sortOrder: 1
      }
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${planId}` });
    const template = db.prepare("select type, name, description, start_at, end_at from task_templates where id = ?").get(planId);
    const item = db
      .prepare("select template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order from task_template_items where id = ?")
      .get((itemResponse.json() as { id: string }).id) as { ext_data_json: string } | undefined;
    await app.close();

    expect(planResponse.statusCode).toBe(201);
    expect(itemResponse.statusCode).toBe(201);
    expect(template).toEqual({
      type: "operation",
      name: "倒闸操作",
      description: "主线切换",
      start_at: startAt,
      end_at: endAt
    });
    expect(item).toMatchObject({
      template_id: planId,
      offset_minutes: 15,
      duration_minutes: 30,
      content: "检查闭锁状态",
      sort_order: 1
    });
    expect(JSON.parse(item?.ext_data_json ?? "{}")).toEqual({ priority: "P1" });
    expect(detailResponse.json()).toMatchObject({
      id: planId,
      items: [{ content: "检查闭锁状态", metadata: { priority: "P1" } }]
    });
  });

  it("lists operation plans by date or all scope and returns editable details", async () => {
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
        skipHolidays: false,
        item: {
          offsetMinutes: 0,
          durationMinutes: 120,
          content: "A、B 操作",
          metadata: { crew: "A" },
          sortOrder: 0
        }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const dateListResponse = await app.inject({ method: "GET", url: "/api/admin/operation-plans?date=2026-05-01&scope=date" });
    const emptyDateListResponse = await app.inject({
      method: "GET",
      url: "/api/admin/operation-plans?date=2026-05-02&scope=date"
    });
    const allListResponse = await app.inject({ method: "GET", url: "/api/admin/operation-plans?scope=all" });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(dateListResponse.statusCode).toBe(200);
    expect(dateListResponse.json()).toEqual([
      expect.objectContaining({
        id,
        name: "倒闸操作",
        childTaskCount: 1,
        firstItemContent: "A、B 操作",
        enabled: true
      })
    ]);
    expect(emptyDateListResponse.json()).toEqual([]);
    expect(allListResponse.json()).toEqual([expect.objectContaining({ id, name: "倒闸操作" })]);
    expect(detailResponse.json()).toMatchObject({
      id,
      name: "倒闸操作",
      items: [{ content: "A、B 操作", offsetMinutes: 0, durationMinutes: 120, metadata: { crew: "A" } }]
    });
  });

  it("keeps infinite operation plans visible after their compatibility end date", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "无限循环操作",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: null,
        recurrenceType: "infinite",
        recurrenceIntervalMinutes: 60,
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "循环项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const response = await app.inject({ method: "GET", url: "/api/admin/operation-plans?date=2026-05-02&scope=date" });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ id, name: "无限循环操作", recurrenceType: "infinite" })]);
  });

  it("lists once operation plans on dates covered by their derived child cycle", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "跨日一次操作",
        description: "",
        startAt: "2026-05-01T23:00:00+08:00",
        endAt: null,
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 90, durationMinutes: 60, content: "跨日子任务", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const response = await app.inject({ method: "GET", url: "/api/admin/operation-plans?date=2026-05-02&scope=date" });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ id, name: "跨日一次操作", recurrenceType: "once" })]);
  });

  it("validates nullable operation endAt by recurrence type", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const onceResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "一次操作",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "一次项", metadata: {}, sortOrder: 0 }
      }
    });
    const infiniteResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "无限操作",
        description: "",
        startAt: "2026-05-01T09:00:00+08:00",
        endAt: null,
        recurrenceType: "infinite",
        recurrenceIntervalMinutes: 60,
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "无限项", metadata: {}, sortOrder: 0 }
      }
    });
    const finiteMissingResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "有限缺失结束",
        description: "",
        startAt: "2026-05-01T10:00:00+08:00",
        endAt: null,
        recurrenceType: "finite",
        recurrenceIntervalMinutes: 60,
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "有限项", metadata: {}, sortOrder: 0 }
      }
    });
    const finiteEqualResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "有限结束相同",
        description: "",
        startAt: "2026-05-01T11:00:00+08:00",
        endAt: "2026-05-01T11:00:00+08:00",
        recurrenceType: "finite",
        recurrenceIntervalMinutes: 60,
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "有限项", metadata: {}, sortOrder: 0 }
      }
    });
    const onceId = (onceResponse.json() as { id: string }).id;
    const infiniteId = (infiniteResponse.json() as { id: string }).id;
    const rows = db
      .prepare("select id, start_at, end_at from task_templates where id in (?, ?) order by start_at")
      .all(onceId, infiniteId);
    await app.close();

    expect(onceResponse.statusCode).toBe(201);
    expect(infiniteResponse.statusCode).toBe(201);
    expect(rows).toEqual([
      { id: onceId, start_at: "2026-05-01T08:00:00+08:00", end_at: "2026-05-01T08:00:00+08:00" },
      { id: infiniteId, start_at: "2026-05-01T09:00:00+08:00", end_at: "2026-05-01T09:00:00+08:00" }
    ]);
    expect(finiteMissingResponse.statusCode).toBe(400);
    expect(finiteMissingResponse.json()).toMatchObject({
      issues: [expect.objectContaining({ path: ["endAt"], message: "endAt is required for finite recurrence" })]
    });
    expect(finiteEqualResponse.statusCode).toBe(400);
    expect(finiteEqualResponse.json()).toMatchObject({
      issues: [expect.objectContaining({ path: ["endAt"], message: "endAt must be after startAt" })]
    });
  });

  it("lists operation plans with non-China-offset datetimes by actual overlap", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "UTC计划",
        description: "",
        startAt: "2026-04-30T16:30:00.000Z",
        endAt: "2026-04-30T17:30:00.000Z",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const { id } = createResponse.json() as { id: string };

    const response = await app.inject({ method: "GET", url: "/api/admin/operation-plans?date=2026-05-01&scope=date" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([expect.objectContaining({ id, name: "UTC计划" })]);
  });

  it("updates, disables, and deletes operation plans through operation endpoints", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 30, durationMinutes: 60, content: "检查闭锁", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${id}`,
      payload: {
        name: "更新计划",
        description: "已调整",
        startAt: "2026-05-01T09:00:00+08:00",
        endAt: "2026-05-01T11:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: true,
        skipHolidays: false,
        item: { offsetMinutes: 15, durationMinutes: 45, content: "更新检查", metadata: { done: true }, sortOrder: 1 }
      }
    });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: `/api/admin/operation-plans/${id}/enabled`,
      payload: { enabled: false }
    });
    const listResponse = await app.inject({ method: "GET", url: "/api/admin/operation-plans?scope=all" });
    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/operation-plans/${id}` });
    const finalListResponse = await app.inject({ method: "GET", url: "/api/admin/operation-plans?scope=all" });
    await app.close();

    expect(updateResponse.statusCode).toBe(200);
    expect(disableResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      expect.objectContaining({ id, name: "更新计划", firstItemContent: "更新检查", enabled: false, skipWeekends: true })
    ]);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
  });

  it("updates operation child items through plan-scoped endpoints", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "第一项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };
    const secondItemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: {
        offsetMinutes: 120,
        durationMinutes: 60,
        content: "第二项",
        metadata: {},
        sortOrder: 1
      }
    });
    const { id: secondItemId } = secondItemResponse.json() as { id: string };

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${id}/items/${secondItemId}`,
      payload: {
        offsetMinutes: 150,
        durationMinutes: 45,
        content: "第二项更新",
        metadata: {},
        sortOrder: 1
      }
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(updateResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      items: [
        { content: "第一项", offsetMinutes: 0 },
        { id: secondItemId, content: "第二项更新", offsetMinutes: 150, durationMinutes: 45 }
      ]
    });
  });

  it("deletes operation child items through plan-scoped endpoints", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "第一项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };
    const secondItemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${id}/items`,
      payload: {
        offsetMinutes: 120,
        durationMinutes: 60,
        content: "第二项",
        metadata: {},
        sortOrder: 1
      }
    });
    const { id: secondItemId } = secondItemResponse.json() as { id: string };

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/operation-plans/${id}/items/${secondItemId}` });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    const missingDeleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/operation-plans/${id}/items/${secondItemId}` });
    await app.close();

    expect(deleteResponse.statusCode).toBe(204);
    expect(detailResponse.json()).toMatchObject({
      items: [{ content: "第一项" }]
    });
    expect(missingDeleteResponse.statusCode).toBe(404);
  });

  it("rejects operation item updates and deletes when the item belongs to a different plan", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const firstPlanResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "第一计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "第一项", metadata: {}, sortOrder: 0 }
      }
    });
    const secondPlanResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "第二计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "第二项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id: firstPlanId } = firstPlanResponse.json() as { id: string };
    const { id: secondPlanId } = secondPlanResponse.json() as { id: string };
    const secondDetailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${secondPlanId}` });
    const secondItemId = (secondDetailResponse.json() as { items: Array<{ id: string }> }).items[0].id;

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${firstPlanId}/items/${secondItemId}`,
      payload: { offsetMinutes: 30, durationMinutes: 60, content: "不该更新", metadata: {}, sortOrder: 0 }
    });
    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/admin/operation-plans/${firstPlanId}/items/${secondItemId}`
    });
    await app.close();

    expect(updateResponse.statusCode).toBe(404);
    expect(deleteResponse.statusCode).toBe(404);
  });

  it("updates operation plan fields without touching child tasks when item is omitted", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "原说明",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "第一项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${id}`,
      payload: {
        name: "计划本身更新",
        description: "新说明",
        startAt: "2026-05-01T09:00:00+08:00",
        endAt: "2026-05-01T13:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(updateResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      name: "计划本身更新",
      description: "新说明",
      items: [{ content: "第一项", offsetMinutes: 0, durationMinutes: 60 }]
    });
  });

  it("allows operation plan updates when child items extend the derived cycle beyond endAt", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 180, durationMinutes: 45, content: "末尾任务", metadata: {}, sortOrder: 0 }
      }
    });
    const { id } = createResponse.json() as { id: string };

    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/operation-plans/${id}`,
      payload: {
        name: "缩短计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T10:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      name: "缩短计划",
      endAt: "2026-05-01T10:00:00+08:00",
      items: [{ content: "末尾任务", offsetMinutes: 180, durationMinutes: 45 }]
    });
  });

  it("creates and returns patrol plans with ordered cycle items", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-plans",
      payload: {
        name: "日常巡检",
        description: "90天周期",
        startAt: "2026-05-01T00:00:00+08:00",
        endAt: "2026-07-29T23:59:59+08:00"
      }
    });
    const { id } = createResponse.json() as { id: string };
    const laterItemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 2, timeTag: "下午", target: "2号线", personnel: "李四", vehicle: "巡检车", other: "带工具", sortOrder: 1 }
    });
    const firstItemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 1, timeTag: "上午", target: "1号线", personnel: "张三", sortOrder: 0 }
    });
    const listResponse = await app.inject({ method: "GET", url: "/api/admin/patrol-plans" });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/patrol-plans/${id}` });
    const template = db
      .prepare(
        `select type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
                skip_weekends, skip_holidays, enabled, ext_data_json
         from task_templates
         where id = ?`
      )
      .get(id) as { ext_data_json: string } | undefined;
    const firstItem = db.prepare("select template_id, content, ext_data_json, sort_order from task_template_items where id = ?").get((firstItemResponse.json() as { id: string }).id) as { ext_data_json: string } | undefined;
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(laterItemResponse.statusCode).toBe(201);
    expect(firstItemResponse.statusCode).toBe(201);
    expect(template).toMatchObject({
      type: "patrol",
      name: "日常巡检",
      description: "90天周期",
      start_at: "2026-05-01T00:00:00+08:00",
      end_at: "2026-07-29T23:59:59+08:00",
      recurrence_type: "infinite",
      recurrence_interval_minutes: 1440,
      skip_weekends: 0,
      skip_holidays: 1,
      enabled: 1
    });
    expect(JSON.parse(template?.ext_data_json ?? "{}")).toEqual({});
    expect(JSON.parse(firstItem?.ext_data_json ?? "{}")).toEqual({
      cycleDay: 1,
      timeTag: "上午",
      target: "1号线",
      personnel: "张三",
      vehicle: "",
      other: ""
    });
    expect(firstItem).toMatchObject({ template_id: id, content: "1号线", sort_order: 0 });
    expect(listResponse.json()).toEqual([
      expect.objectContaining({ id, name: "日常巡检", cycleLength: 2, skipWeekends: false, skipHolidays: true, enabled: true })
    ]);
    expect(detailResponse.json()).toMatchObject({
      id,
      name: "日常巡检",
      cycleLength: 2,
      items: [
        { cycleDay: 1, timeTag: "上午", target: "1号线", personnel: "张三", vehicle: "", other: "", sortOrder: 0 },
        { cycleDay: 2, timeTag: "下午", target: "2号线", personnel: "李四", vehicle: "巡检车", other: "带工具", sortOrder: 1 }
      ]
    });
  });

  it("derives patrol cycle length from items and rejects duplicate cycle day and sort order", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-plans",
      payload: {
        name: "短周期巡检",
        startAt: "2026-05-01T00:00:00+08:00",
        endAt: "2026-05-10T23:59:59+08:00"
      }
    });
    const { id } = createResponse.json() as { id: string };

    const extendingResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 4, timeTag: "上午", target: "越界" }
    });
    const firstResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 2, timeTag: "上午", target: "A线", sortOrder: 0 }
    });
    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 2, timeTag: "上午", target: "B线", sortOrder: 0 }
    });
    const otherTimeResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 2, timeTag: "下午", target: "C线", sortOrder: 0 }
    });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/patrol-plans/${id}` });
    await app.close();

    expect(extendingResponse.statusCode).toBe(201);
    expect(firstResponse.statusCode).toBe(201);
    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toEqual({ error: "Duplicate patrol cycle item" });
    expect(otherTimeResponse.statusCode).toBe(201);
    expect(detailResponse.json()).toMatchObject({ cycleLength: 4 });
  });

  it("does not delete operation items through patrol plan item routes", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const operationResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { offsetMinutes: 0, durationMinutes: 60, content: "操作项", metadata: {}, sortOrder: 0 }
      }
    });
    const { id: operationPlanId } = operationResponse.json() as { id: string };
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${operationPlanId}` });
    const operationItemId = (detailResponse.json() as { items: Array<{ id: string }> }).items[0].id;

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/patrol-plans/${operationPlanId}/items/${operationItemId}` });
    await app.close();

    expect(deleteResponse.statusCode).toBe(404);
    expect(db.prepare("select id from task_template_items where id = ?").get(operationItemId)).toEqual({ id: operationItemId });
  });

  it("updates, toggles, and deletes patrol plans while preserving generated snapshots", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    const app = createApp(db, { boardEvents });
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-plans",
      payload: {
        name: "日常巡检",
        startAt: "2026-05-01T00:00:00+08:00",
        endAt: "2026-07-29T23:59:59+08:00"
      }
    });
    const { id } = createResponse.json() as { id: string };
    const itemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 1, timeTag: "上午", target: "1号线" }
    });
    const { id: itemId } = itemResponse.json() as { id: string };
    db.prepare(
      `insert into task_instances
       (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
        start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values ('snapshot-1', 'patrol', ?, ?, 'generated', 'patrol-key', '2026-05-01',
               '2026-05-01T08:00:00+08:00', '2026-05-01T12:00:00+08:00', '历史快照', '{}',
               'pending', '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z')`
    ).run(id, itemId);

    const updateItemResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/patrol-plans/${id}/items/${itemId}`,
      payload: { cycleDay: 2, timeTag: "下午", target: "2号线", personnel: "赵六", sortOrder: 3 }
    });
    const updatePlanResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/patrol-plans/${id}`,
      payload: {
        name: "更新巡检",
        description: "调整周期",
        startAt: "2026-05-02T00:00:00+08:00",
        endAt: "2026-06-01T23:59:59+08:00",
        skipWeekends: true,
        skipHolidays: false
      }
    });
    const disableResponse = await app.inject({ method: "PATCH", url: `/api/admin/patrol-plans/${id}/enabled`, payload: { enabled: false } });
    const deleteItemResponse = await app.inject({ method: "DELETE", url: `/api/admin/patrol-plans/${id}/items/${itemId}` });
    const replacementItemResponse = await app.inject({
      method: "POST",
      url: `/api/admin/patrol-plans/${id}/items`,
      payload: { cycleDay: 1, timeTag: "上午", target: "新1号线" }
    });
    const deletePlanResponse = await app.inject({ method: "DELETE", url: `/api/admin/patrol-plans/${id}` });
    const remainingItems = db.prepare("select count(*) as count from task_template_items where template_id = ?").get(id) as { count: number };
    const snapshot = db.prepare("select template_id, source_template_item_id from task_instances where id = 'snapshot-1'").get();
    await app.close();

    expect(updateItemResponse.statusCode).toBe(200);
    expect(updatePlanResponse.statusCode).toBe(200);
    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.json()).toEqual({ id, enabled: false });
    expect(deleteItemResponse.statusCode).toBe(204);
    expect(replacementItemResponse.statusCode).toBe(201);
    expect(deletePlanResponse.statusCode).toBe(204);
    expect(remainingItems.count).toBe(0);
    expect(snapshot).toEqual({ template_id: null, source_template_item_id: null });
    expect(boardEvents.getVersion()).toBe(9);
  });

  it("allows operation items to extend beyond the stored compatibility duration", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const planResponse = await app.inject({
      method: "POST",
      url: "/api/admin/operation-plans",
      payload: {
        name: "短任务",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T09:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false
      }
    });
    const { id: planId } = planResponse.json() as { id: string };

    const response = await app.inject({
      method: "POST",
      url: `/api/admin/operation-plans/${planId}/items`,
      payload: {
        offsetMinutes: 45,
        durationMinutes: 30,
        content: "越界子任务"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
  });

  it("publishes a board event version after successful admin writes", async () => {
    const db = createTestDatabase();
    const boardEvents = createBoardEventBroadcaster();
    const app = createApp(db, { boardEvents });

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date: toChinaDate(new Date()),
        timeTag: "上午",
        task: "动火许可"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(boardEvents.getVersion()).toBe(2);
  });

  it("derives actual start and end datetimes from arrangement time tags", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: { date, timeTag: "上午", task: "动火许可" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: { date, timeTag: "全天", task: "值守" }
    });

    const permitListResponse = await app.inject({ method: "GET", url: `/api/admin/permit-arrangements?date=${date}` });
    const otherListResponse = await app.inject({ method: "GET", url: `/api/admin/other-arrangements?date=${date}` });
    await app.close();

    expect(permitListResponse.json()).toEqual([
      expect.objectContaining({
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00"
      })
    ]);
    expect(otherListResponse.json()).toEqual([
      expect.objectContaining({
        startAt: "2026-05-01T00:00:00+08:00",
        endAt: "2026-05-01T23:59:59+08:00"
      })
    ]);
  });

  it("lists arrangement records across dates when scope is all", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: { date: "2026-05-01", timeTag: "上午", task: "动火许可" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: { date: "2026-05-02", timeTag: "下午", task: "登高许可" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: { date: "2026-05-01", timeTag: "上午", task: "清点物资" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: { date: "2026-05-02", timeTag: "下午", task: "现场协调" }
    });
    await app.inject({ method: "POST", url: "/api/admin/leave-people", payload: { date: "2026-05-01", name: "王五" } });
    await app.inject({ method: "POST", url: "/api/admin/leave-people", payload: { date: "2026-05-02", name: "赵六" } });

    const permitResponse = await app.inject({ method: "GET", url: "/api/admin/permit-arrangements?scope=all" });
    const otherResponse = await app.inject({ method: "GET", url: "/api/admin/other-arrangements?scope=all" });
    const leaveResponse = await app.inject({ method: "GET", url: "/api/admin/leave-people?scope=all" });
    await app.close();

    expect(permitResponse.json().map((record: { task: string }) => record.task)).toEqual(["登高许可", "动火许可"]);
    expect(otherResponse.json().map((record: { task: string }) => record.task)).toEqual(["现场协调", "清点物资"]);
    expect(leaveResponse.json().map((record: { name: string }) => record.name)).toEqual(["赵六", "王五"]);
  });

  it("lists, updates, disables, and deletes permit arrangements by date", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date,
        timeTag: "上午",
        target: "A区",
        task: "动火许可",
        personnel: "张三",
        vehicle: "工程车",
        other: "已审批"
      }
    });
    const { id } = createResponse.json() as { id: string };

    const listResponse = await app.inject({ method: "GET", url: `/api/admin/permit-arrangements?date=${date}` });
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/permit-arrangements/${id}`,
      payload: {
        date,
        timeTag: "下午",
        target: "B区",
        task: "受限空间",
        personnel: "李四",
        vehicle: "抢修车",
        other: "待复核"
      }
    });
    const updatedListResponse = await app.inject({ method: "GET", url: `/api/admin/permit-arrangements?date=${date}` });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: `/api/admin/permit-arrangements/${id}/enabled`,
      payload: { enabled: false }
    });
    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/permit-arrangements/${id}` });
    const finalListResponse = await app.inject({ method: "GET", url: `/api/admin/permit-arrangements?date=${date}` });
    await app.close();

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id,
        date,
        timeTag: "上午",
        target: "A区",
        task: "动火许可",
        personnel: "张三",
        vehicle: "工程车",
        other: "已审批",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        enabled: true
      }
    ]);
    expect(updateResponse.statusCode).toBe(200);
    expect(updatedListResponse.json()).toEqual([
      {
        id,
        date,
        timeTag: "下午",
        target: "B区",
        task: "受限空间",
        personnel: "李四",
        vehicle: "抢修车",
        other: "待复核",
        startAt: "2026-05-01T12:00:00+08:00",
        endAt: "2026-05-01T17:00:00+08:00",
        enabled: true
      }
    ]);
    expect(disableResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
  });

  it("does not expose or mutate generated instances through permit arrangement routes", async () => {
    const db = createTestDatabase();
    insertTaskInstance(db, {
      id: "generated-permit",
      type: "permit",
      sourceType: "generated",
      generationKey: "permit-template:item:2026-05-01T00:00:00+08:00",
      occurrenceDate: "2026-05-01",
      startAt: "2026-05-01T08:00:00+08:00",
      endAt: "2026-05-01T12:00:00+08:00",
      content: "生成许可",
      metadata: { timeTag: "上午", target: "A区" }
    });
    const app = createApp(db);

    const listResponse = await app.inject({ method: "GET", url: "/api/admin/permit-arrangements?date=2026-05-01" });
    const updateResponse = await app.inject({
      method: "PUT",
      url: "/api/admin/permit-arrangements/generated-permit",
      payload: { date: "2026-05-01", timeTag: "下午", target: "B区", task: "改写许可" }
    });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: "/api/admin/permit-arrangements/generated-permit/enabled",
      payload: { enabled: false }
    });
    const deleteResponse = await app.inject({ method: "DELETE", url: "/api/admin/permit-arrangements/generated-permit" });
    await app.close();

    expect(listResponse.json()).toEqual([]);
    expect(updateResponse.statusCode).toBe(404);
    expect(disableResponse.statusCode).toBe(404);
    expect(deleteResponse.statusCode).toBe(404);
    expect(db.prepare("select content, status from task_instances where id = ?").get("generated-permit")).toEqual({
      content: "生成许可",
      status: "pending"
    });
  });

  it("stores permit arrangements as manual task instances with permit metadata", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "上午",
        target: "A区",
        task: "动火许可",
        personnel: "张三",
        vehicle: "工程车",
        other: "已审批"
      }
    });
    const { id } = response.json() as { id: string };
    const instance = db
      .prepare(
        `select type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
                start_at, end_at, content, ext_data_json, status
         from task_instances
         where id = ?`
      )
      .get(id) as { ext_data_json: string } | undefined;
    const legacyTable = db.prepare("select name from sqlite_master where type = 'table' and name = 'permit_arrangements'").get();
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(instance).toMatchObject({
      type: "permit",
      template_id: null,
      source_template_item_id: null,
      source_type: "manual",
      generation_key: null,
      occurrence_date: "2026-05-01",
      start_at: "2026-05-01T08:00:00+08:00",
      end_at: "2026-05-01T12:00:00+08:00",
      content: "动火许可",
      status: "pending"
    });
    expect(JSON.parse(instance?.ext_data_json ?? "{}")).toEqual({
      timeTag: "上午",
      target: "A区",
      personnel: "张三",
      vehicle: "工程车",
      other: "已审批"
    });
    expect(legacyTable).toBeUndefined();
  });

  it("stores other arrangements as manual task instances with metadata reserved for common display fields", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "下午",
        task: "设备巡检",
        personnel: "李四",
        vehicle: "皮卡",
        other: "带工具"
      }
    });
    const { id } = response.json() as { id: string };
    const instance = db
      .prepare(
        `select type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
                start_at, end_at, content, ext_data_json, status
         from task_instances
         where id = ?`
      )
      .get(id) as { ext_data_json: string } | undefined;
    const legacyTable = db.prepare("select name from sqlite_master where type = 'table' and name = 'other_arrangements'").get();
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(instance).toMatchObject({
      type: "other",
      template_id: null,
      source_template_item_id: null,
      source_type: "manual",
      generation_key: null,
      occurrence_date: "2026-05-01",
      start_at: "2026-05-01T12:00:00+08:00",
      end_at: "2026-05-01T17:00:00+08:00",
      content: "设备巡检",
      status: "pending"
    });
    expect(JSON.parse(instance?.ext_data_json ?? "{}")).toEqual({
      timeTag: "下午",
      target: "设备巡检",
      personnel: "李四",
      vehicle: "皮卡",
      other: "带工具"
    });
    expect(legacyTable).toBeUndefined();
  });

  it("lists and manages leave people by date", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: {
        date,
        name: "王五"
      }
    });
    const { id } = createResponse.json() as { id: string };

    const listResponse = await app.inject({ method: "GET", url: `/api/admin/leave-people?date=${date}` });
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/leave-people/${id}`,
      payload: {
        date,
        name: "赵六"
      }
    });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: `/api/admin/leave-people/${id}/enabled`,
      payload: { enabled: false }
    });
    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/leave-people/${id}` });
    const finalListResponse = await app.inject({ method: "GET", url: `/api/admin/leave-people?date=${date}` });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id,
        date,
        name: "王五",
        enabled: true
      }
    ]);
    expect(updateResponse.statusCode).toBe(200);
    expect(disableResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
  });

  it("rejects duplicate leave people on the same date", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: { date, name: "王五" }
    });
    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: { date, name: "王五" }
    });
    const listResponse = await app.inject({ method: "GET", url: `/api/admin/leave-people?date=${date}` });
    await app.close();

    expect(firstResponse.statusCode).toBe(201);
    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toEqual({ error: "Duplicate leave person" });
    expect(listResponse.json()).toEqual([
      {
        id: expect.any(String),
        date,
        name: "王五",
        enabled: true
      }
    ]);
  });

  it("rejects updating leave people to duplicate date and name", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: { date, name: "王五" }
    });
    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/admin/leave-people",
      payload: { date, name: "赵六" }
    });
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/admin/leave-people/${secondResponse.json().id}`,
      payload: { date, name: "王五" }
    });
    const listResponse = await app.inject({ method: "GET", url: `/api/admin/leave-people?date=${date}` });
    await app.close();

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(201);
    expect(updateResponse.statusCode).toBe(409);
    expect(updateResponse.json()).toEqual({ error: "Duplicate leave person" });
    expect(listResponse.json()).toEqual([
      {
        id: firstResponse.json().id,
        date,
        name: "王五",
        enabled: true
      },
      {
        id: secondResponse.json().id,
        date,
        name: "赵六",
        enabled: true
      }
    ]);
  });

  it("returns 400 for invalid timeTag payloads", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "晚上",
        task: "动火许可"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid admin payload",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: ["timeTag"]
        })
      ])
    });
  });

  it.each([
    ["/api/admin/permit-arrangements", { date: "2026/05/01", timeTag: "上午", task: "动火许可" }],
    ["/api/admin/other-arrangements", { date: "2026/05/01", timeTag: "下午", task: "设备巡检" }],
    ["/api/admin/leave-people", { date: "2026/05/01", name: "王五" }],
    ["/api/admin/holidays", { date: "2026/05/01", name: "劳动节" }]
  ])("returns 400 for malformed dates on %s", async (url, payload) => {
    const db = createTestDatabase();
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url,
      payload
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid admin payload",
      issues: expect.arrayContaining([
        expect.objectContaining({
          path: ["date"]
        })
      ])
    });
  });
});

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function formatChinaDateTime(epochMs: number): string {
  const shifted = new Date(epochMs + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

function insertTaskInstance(
  db: AppDatabase,
  input: {
    id: string;
    type: "operation" | "permit" | "patrol" | "other";
    sourceType: "generated" | "manual" | "override";
    status?: "pending" | "in_progress" | "done" | "cancelled";
    generationKey?: string | null;
    occurrenceDate?: string;
    startAt?: string;
    endAt?: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  const now = "2026-05-01T00:00:00.000Z";
  db.prepare(
    `insert into task_instances
     (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
      start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
     values (?, ?, null, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.type,
    input.sourceType,
    input.generationKey ?? null,
    input.occurrenceDate ?? "2026-05-01",
    input.startAt ?? "2026-05-01T08:00:00+08:00",
    input.endAt ?? "2026-05-01T09:00:00+08:00",
    input.content ?? input.id,
    JSON.stringify(input.metadata ?? {}),
    input.status ?? "pending",
    now,
    now
  );
}

function insertTaskTemplate(
  db: AppDatabase,
  input: {
    id: string;
    type: "operation" | "permit" | "patrol" | "other";
    startAt: string;
    endAt: string;
  }
): void {
  const now = "2026-05-01T00:00:00.000Z";
  db.prepare(
    `insert into task_templates
     (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
      recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json, created_at, updated_at)
     values (?, ?, ?, '', ?, ?, 'once', null, null, 0, 0, 1, '{}', ?, ?)`
  ).run(input.id, input.type, input.id, input.startAt, input.endAt, now, now);
}

function insertTaskTemplateItem(
  db: AppDatabase,
  input: {
    id: string;
    templateId: string;
    content: string;
  }
): void {
  db.prepare(
    `insert into task_template_items
     (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, 0, 60, ?, '{}', 0)`
  ).run(input.id, input.templateId, input.content);
}
