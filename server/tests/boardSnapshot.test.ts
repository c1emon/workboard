import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";
import { getBoardSnapshot } from "../src/domain/boardSnapshot.js";
import { createBoardEventBroadcaster } from "../src/routes/boardEvents.js";

describe("board snapshot", () => {
  it("sorts permits by time tag", () => {
    const db = createTestDatabase();
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("p1", "2026-05-01", "下午", "封闭许可", "孙八", "西侧", "待确认", 1, 0);
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("p2", "2026-05-01", "全天", "动火许可", "张三", "A区", "已审批", 1, 0);

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.permits.map((permit) => permit.timeTag)).toEqual(["全天", "下午"]);
  });

  it("sorts other arrangements by time tag", () => {
    const db = createTestDatabase();
    db.prepare("insert into other_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("o1", "2026-05-01", "下午", "清点物资", "李四", "电瓶车", "", 1, 0);
    db.prepare("insert into other_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("o2", "2026-05-01", "上午", "设备巡检", "王五", "皮卡", "", 1, 0);
    db.prepare("insert into other_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("o3", "2026-05-01", "全天", "值守", "赵六", "", "", 1, 0);

    const snapshot = getBoardSnapshot(db, new Date("2026-05-01T15:42:18+08:00"));

    expect(snapshot.others.map((other) => other.timeTag)).toEqual(["全天", "上午", "下午"]);
  });

  it("returns board snapshot JSON from the board route", async () => {
    const db = createTestDatabase();
    const date = toChinaDate(new Date());
    db.prepare("insert into permit_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("p1", date, "上午", "动火许可", "张三", "A区", "已审批", 1, 0);
    db.prepare("insert into other_arrangements values (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("o1", date, "全天", "值守", "赵六", "", "", 1, 0);
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
});

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
