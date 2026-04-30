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
