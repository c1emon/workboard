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
      "other_arrangements",
      "permit_arrangements",
      "task_containers",
      "task_items"
    ]);
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
