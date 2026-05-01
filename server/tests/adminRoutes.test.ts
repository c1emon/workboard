import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";
import { createBoardEventBroadcaster } from "../src/routes/boardEvents.js";

describe("admin routes", () => {
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
        permit: "动火许可",
        personnel: "张三",
        area: "A区",
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
      permits: [{ timeTag: "上午", permit: "动火许可", personnel: "张三", area: "A区", other: "已审批" }],
      others: [{ timeTag: "下午", task: "设备巡检", personnel: "李四", vehicle: "皮卡", other: "带工具" }],
      leavePeople: ["王五"]
    });
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
        permit: "动火许可"
      }
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(boardEvents.getVersion()).toBe(2);
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
        permit: "动火许可",
        personnel: "张三",
        area: "A区",
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
        permit: "受限空间",
        personnel: "李四",
        area: "B区",
        other: "待复核"
      }
    });
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
        permit: "动火许可",
        personnel: "张三",
        area: "A区",
        other: "已审批",
        enabled: true
      }
    ]);
    expect(updateResponse.statusCode).toBe(200);
    expect(disableResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
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
        enabled: true
      }
    ]);
    expect(disableResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(204);
    expect(finalListResponse.json()).toEqual([]);
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

  it("returns 400 for invalid timeTag payloads", async () => {
    const db = createTestDatabase();
    const app = createApp(db);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/permit-arrangements",
      payload: {
        date: "2026-05-01",
        timeTag: "晚上",
        permit: "动火许可"
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
    ["/api/admin/permit-arrangements", { date: "2026/05/01", timeTag: "上午", permit: "动火许可" }],
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
