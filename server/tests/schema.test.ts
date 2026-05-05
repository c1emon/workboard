import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestDatabase, migrate, openDatabase } from "../src/db/database.js";

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
      "task_instances",
      "task_template_items",
      "task_templates"
    ]);
  });

  it("creates task templates with extensible extData", () => {
    const db = createTestDatabase();
    const columns = db
      .prepare("pragma table_info(task_templates)")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toContain("ext_data_json");
  });

  it("references task templates from template items", () => {
    const db = createTestDatabase();
    const foreignKeys = db
      .prepare("pragma foreign_key_list(task_template_items)")
      .all()
      .map((row) => row as { from: string; table: string; to: string });

    expect(foreignKeys).toContainEqual(expect.objectContaining({
      from: "template_id",
      table: "task_templates",
      to: "id"
    }));
  });

  it("references task templates and source items from task instances", () => {
    const db = createTestDatabase();
    const foreignKeys = db
      .prepare("pragma foreign_key_list(task_instances)")
      .all()
      .map((row) => row as { from: string; table: string; to: string });

    expect(foreignKeys).toContainEqual(expect.objectContaining({
      from: "template_id",
      table: "task_templates",
      to: "id"
    }));
    expect(foreignKeys).toContainEqual(expect.objectContaining({
      from: "source_template_item_id",
      table: "task_template_items",
      to: "id"
    }));
  });

  it("creates a unique index for non-null task instance generation keys", () => {
    const db = createTestDatabase();
    const indexes = db
      .prepare("pragma index_list(task_instances)")
      .all()
      .map((row) => row as { name: string; unique: number; partial: number });

    expect(indexes).toContainEqual(expect.objectContaining({
      name: "task_instances_generation_key_unique",
      unique: 1,
      partial: 1
    }));
  });

  it("creates an index for task template items by template id", () => {
    const db = createTestDatabase();
    const indexes = db
      .prepare("pragma index_list(task_template_items)")
      .all()
      .map((row) => row as { name: string; unique: number });

    expect(indexes).toContainEqual(expect.objectContaining({
      name: "task_template_items_template_id_idx",
      unique: 0
    }));
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

  it("canonicalizes legacy task instance datetimes during migration", () => {
    const db = createTestDatabase();
    db.prepare(
      `insert into task_instances
       (id, type, source_type, occurrence_date, start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values ('legacy-task', 'patrol', 'manual', '2026-05-01',
               '2026-04-30T16:30:00.000Z', '2026-04-30T17:30:00.000Z',
               'UTC legacy task', '{}', 'pending', '2026-05-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z')`
    ).run();

    migrate(db);

    const row = db
      .prepare("select start_at, end_at from task_instances where id = 'legacy-task'")
      .get();
    expect(row).toEqual({
      start_at: "2026-05-01T00:30:00.000+08:00",
      end_at: "2026-05-01T01:30:00.000+08:00"
    });
  });
});
