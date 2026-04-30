import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";

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
