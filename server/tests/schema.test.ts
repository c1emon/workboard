import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestDatabase, openDatabase } from "../src/db/database.js";

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
      "task_containers",
      "task_items"
    ]);
  });

  it("keeps task item business fields in metadata instead of dedicated columns", () => {
    const db = createTestDatabase();
    const columns = db
      .prepare("pragma table_info(task_items)")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual([
      "id",
      "container_id",
      "offset_minutes",
      "duration_minutes",
      "content",
      "ext_data_json",
      "sort_order"
    ]);
  });

  it("enforces one leave person per date and name", () => {
    const db = createTestDatabase();

    db.prepare("insert into leave_people (id, date, name) values (?, ?, ?)").run("leave-1", "2026-05-01", "王五");

    expect(() =>
      db.prepare("insert into leave_people (id, date, name) values (?, ?, ?)").run("leave-2", "2026-05-01", "王五")
    ).toThrow();
  });

  it("creates the parent directory before opening a database file", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "workboard-db-"));
    const databasePath = join(tempRoot, "missing-parent", "workboard.sqlite");

    try {
      expect(existsSync(join(tempRoot, "missing-parent"))).toBe(false);

      const db = openDatabase(databasePath);
      db.close();

      expect(existsSync(databasePath)).toBe(true);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
