import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";
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

  it("creates operation task plans and exposes expanded board items", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const now = new Date();
    const startAt = formatChinaDateTime(now.getTime() - 30 * 60_000);
    const endAt = formatChinaDateTime(now.getTime() + 90 * 60_000);

    const containerResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-containers",
      payload: {
        type: "operation",
        name: "倒闸操作",
        description: "主线切换",
        startAt,
        endAt,
        recurrenceType: "once"
      }
    });
    const { id: containerId } = containerResponse.json() as { id: string };

    const itemResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-items",
      payload: {
        containerId,
        offsetMinutes: 15,
        durationMinutes: 30,
        content: "检查闭锁状态",
        metadata: { priority: "P1" },
        sortOrder: 1
      }
    });
    const boardResponse = await app.inject({ method: "GET", url: "/api/board" });
    await app.close();

    expect(containerResponse.statusCode).toBe(201);
    expect(itemResponse.statusCode).toBe(201);
    expect(boardResponse.json()).toMatchObject({
      operation: {
        items: [
          {
            content: "检查闭锁状态",
            metadata: { priority: "P1" }
          }
        ]
      }
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

  it("updates the selected operation child task when item id is provided", async () => {
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
      url: "/api/admin/task-items",
      payload: {
        containerId: id,
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
      url: `/api/admin/operation-plans/${id}`,
      payload: {
        name: "操作计划",
        description: "",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        recurrenceType: "once",
        skipWeekends: false,
        skipHolidays: false,
        item: { id: secondItemId, offsetMinutes: 150, durationMinutes: 45, content: "第二项更新", metadata: {}, sortOrder: 1 }
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

  it("deletes task items through the task item endpoint", async () => {
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
      url: "/api/admin/task-items",
      payload: {
        containerId: id,
        offsetMinutes: 120,
        durationMinutes: 60,
        content: "第二项",
        metadata: {},
        sortOrder: 1
      }
    });
    const { id: secondItemId } = secondItemResponse.json() as { id: string };

    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/task-items/${secondItemId}` });
    const detailResponse = await app.inject({ method: "GET", url: `/api/admin/operation-plans/${id}` });
    const missingDeleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/task-items/${secondItemId}` });
    await app.close();

    expect(deleteResponse.statusCode).toBe(204);
    expect(detailResponse.json()).toMatchObject({
      items: [{ content: "第一项" }]
    });
    expect(missingDeleteResponse.statusCode).toBe(404);
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

  it("creates patrol task plans and exposes today's patrol rows", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = toChinaDate(new Date());

    const containerResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-containers",
      payload: {
        type: "patrol",
        name: "日常巡检",
        startAt: `${date}T08:00:00+08:00`,
        endAt: `${date}T10:00:00+08:00`,
        recurrenceType: "once"
      }
    });
    const { id: containerId } = containerResponse.json() as { id: string };

    const itemResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-items",
      payload: {
        containerId,
        offsetMinutes: 30,
        durationMinutes: 60,
        timeTag: "上午",
        target: "1号线",
        personnel: "赵六",
        vehicle: "巡检车",
        other: "带测温仪",
        metadata: { route: "north" }
      }
    });
    const boardResponse = await app.inject({ method: "GET", url: "/api/board" });
    await app.close();

    expect(containerResponse.statusCode).toBe(201);
    expect(itemResponse.statusCode).toBe(201);
    expect(boardResponse.json()).toMatchObject({
      patrols: [
        {
          timeTag: "上午",
          target: "1号线",
          personnel: "赵六",
          vehicle: "巡检车",
          other: "带测温仪",
          metadata: { route: "north" }
        }
      ]
    });
  });

  it("returns 400 when a task item exceeds the parent occurrence duration", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const containerResponse = await app.inject({
      method: "POST",
      url: "/api/admin/task-containers",
      payload: {
        type: "operation",
        name: "短任务",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T09:00:00+08:00",
        recurrenceType: "once"
      }
    });
    const { id: containerId } = containerResponse.json() as { id: string };

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/task-items",
      payload: {
        containerId,
        offsetMinutes: 45,
        durationMinutes: 30,
        content: "越界子任务"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Invalid admin payload",
      message: "child task ends after parent occurrence"
    });
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
      url: "/api/admin/patrol-arrangements",
      payload: { date, timeTag: "下午", target: "1号线" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/other-arrangements",
      payload: { date, timeTag: "全天", task: "值守" }
    });

    const permitListResponse = await app.inject({ method: "GET", url: `/api/admin/permit-arrangements?date=${date}` });
    const patrolListResponse = await app.inject({ method: "GET", url: `/api/admin/patrol-arrangements?date=${date}` });
    const otherListResponse = await app.inject({ method: "GET", url: `/api/admin/other-arrangements?date=${date}` });
    await app.close();

    expect(permitListResponse.json()).toEqual([
      expect.objectContaining({
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00"
      })
    ]);
    expect(patrolListResponse.json()).toEqual([
      expect.objectContaining({
        startAt: "2026-05-01T12:00:00+08:00",
        endAt: "2026-05-01T17:00:00+08:00"
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
      url: "/api/admin/patrol-arrangements",
      payload: { date: "2026-05-01", timeTag: "上午", target: "1号线" }
    });
    await app.inject({
      method: "POST",
      url: "/api/admin/patrol-arrangements",
      payload: { date: "2026-05-02", timeTag: "下午", target: "2号线" }
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
    const patrolResponse = await app.inject({ method: "GET", url: "/api/admin/patrol-arrangements?scope=all" });
    const otherResponse = await app.inject({ method: "GET", url: "/api/admin/other-arrangements?scope=all" });
    const leaveResponse = await app.inject({ method: "GET", url: "/api/admin/leave-people?scope=all" });
    await app.close();

    expect(permitResponse.json().map((record: { task: string }) => record.task)).toEqual(["登高许可", "动火许可"]);
    expect(patrolResponse.json().map((record: { target: string }) => record.target)).toEqual(["2号线", "1号线"]);
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

  it("stores permit arrangements as one-off task containers with permit metadata", async () => {
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
    const container = db.prepare("select type, name, description, start_at, end_at, recurrence_type from task_containers where id = ?").get(id);
    const item = db
      .prepare("select offset_minutes, duration_minutes, content, ext_data_json from task_items where container_id = ?")
      .get(id) as { ext_data_json: string } | undefined;
    const legacyTable = db.prepare("select name from sqlite_master where type = 'table' and name = 'permit_arrangements'").get();
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(container).toEqual({
      type: "permit",
      name: "许可",
      description: "许可安排",
      start_at: "2026-05-01T08:00:00+08:00",
      end_at: "2026-05-01T12:00:00+08:00",
      recurrence_type: "once"
    });
    expect(item).toMatchObject({
      offset_minutes: 0,
      duration_minutes: 240,
      content: "动火许可"
    });
    expect(JSON.parse(item?.ext_data_json ?? "{}")).toEqual({
      timeTag: "上午",
      target: "A区",
      personnel: "张三",
      vehicle: "工程车",
      other: "已审批"
    });
    expect(legacyTable).toBeUndefined();
  });

  it("stores other arrangements as one-off task containers with metadata reserved for non-common fields", async () => {
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
    const container = db.prepare("select type, name, description, start_at, end_at, recurrence_type from task_containers where id = ?").get(id);
    const item = db
      .prepare("select offset_minutes, duration_minutes, content, ext_data_json from task_items where container_id = ?")
      .get(id) as { ext_data_json: string } | undefined;
    const legacyTable = db.prepare("select name from sqlite_master where type = 'table' and name = 'other_arrangements'").get();
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(container).toEqual({
      type: "other",
      name: "其他",
      description: "其他安排",
      start_at: "2026-05-01T12:00:00+08:00",
      end_at: "2026-05-01T17:00:00+08:00",
      recurrence_type: "once"
    });
    expect(item).toMatchObject({
      offset_minutes: 0,
      duration_minutes: 300,
      content: "设备巡检"
    });
    expect(JSON.parse(item?.ext_data_json ?? "{}")).toEqual({
      timeTag: "下午",
      target: "设备巡检",
      personnel: "李四",
      vehicle: "皮卡",
      other: "带工具"
    });
    expect(legacyTable).toBeUndefined();
  });

  it("lists and manages patrol arrangements by date", async () => {
    const db = createTestDatabase();
    const app = createApp(db);
    const date = "2026-05-01";

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-arrangements",
      payload: {
        date,
        timeTag: "上午",
        target: "1号线",
        personnel: "赵六",
        vehicle: "巡检车",
        other: "带测温仪"
      }
    });
    const { id } = createResponse.json() as { id: string };

    const listResponse = await app.inject({ method: "GET", url: `/api/admin/patrol-arrangements?date=${date}` });
    const disableResponse = await app.inject({
      method: "PATCH",
      url: `/api/admin/patrol-arrangements/${id}/enabled`,
      payload: { enabled: false }
    });
    const deleteResponse = await app.inject({ method: "DELETE", url: `/api/admin/patrol-arrangements/${id}` });
    const finalListResponse = await app.inject({ method: "GET", url: `/api/admin/patrol-arrangements?date=${date}` });
    await app.close();

    expect(createResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      {
        id,
        itemId: expect.any(String),
        date,
        timeTag: "上午",
        target: "1号线",
        personnel: "赵六",
        vehicle: "巡检车",
        other: "带测温仪",
        startAt: "2026-05-01T08:00:00+08:00",
        endAt: "2026-05-01T12:00:00+08:00",
        enabled: true
      }
    ]);
    expect(disableResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
  });

  it("rolls back patrol arrangement creation when child item persistence fails", async () => {
    const db = createTestDatabase();
    db.exec(`
      create trigger fail_patrol_item_insert
      before insert on task_items
      begin
        select raise(abort, 'child item insert failed');
      end;
    `);
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "上午",
        target: "1号线"
      }
    });
    const orphanCount = db.prepare("select count(*) as count from task_containers where type = 'patrol'").get() as { count: number };
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(orphanCount.count).toBe(0);
  });

  it("rolls back patrol arrangement updates when child item persistence fails", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/admin/patrol-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "上午",
        target: "1号线"
      }
    });
    const { id } = createResponse.json() as { id: string };
    db.exec(`
      create trigger fail_patrol_item_update
      before update on task_items
      begin
        select raise(abort, 'child item update failed');
      end;
    `);

    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/patrol-arrangements/${id}`,
      payload: {
        date: "2026-05-02",
        timeTag: "下午",
        target: "2号线"
      }
    });
    const container = db.prepare("select start_at, end_at from task_containers where id = ?").get(id) as {
      start_at: string;
      end_at: string;
    };
    await app.close();

    expect(response.statusCode).toBe(500);
    expect(container).toEqual({
      start_at: "2026-05-01T08:00:00+08:00",
      end_at: "2026-05-01T12:00:00+08:00"
    });
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
