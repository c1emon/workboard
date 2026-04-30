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
