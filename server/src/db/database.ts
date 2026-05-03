import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { toChinaOffsetDateTime } from "../domain/dateTime.js";
import { schemaSql } from "./schema.js";

export type AppDatabase = Database.Database;

export function migrate(db: AppDatabase): void {
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  normalizeTaskInstanceDateTimes(db);
}

function normalizeTaskInstanceDateTimes(db: AppDatabase): void {
  const rows = db
    .prepare("select id, start_at, end_at from task_instances where start_at not like '%+08:00' or end_at not like '%+08:00'")
    .all() as Array<{ id: string; start_at: string; end_at: string }>;
  if (rows.length === 0) return;

  const update = db.prepare("update task_instances set start_at = ?, end_at = ? where id = ?");
  const updateRows = db.transaction((items: typeof rows) => {
    for (const row of items) {
      update.run(normalizeDateTime(row.start_at), normalizeDateTime(row.end_at), row.id);
    }
  });
  updateRows(rows);
}

function normalizeDateTime(value: string): string {
  try {
    return toChinaOffsetDateTime(value);
  } catch {
    return value;
  }
}

export function openDatabase(filename = "server/db/workboard.sqlite"): AppDatabase {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  migrate(db);
  return db;
}

export function createTestDatabase(): AppDatabase {
  const db = new Database(":memory:");
  migrate(db);
  return db;
}
