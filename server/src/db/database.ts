import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { schemaSql } from "./schema.js";

export type AppDatabase = Database.Database;

export function migrate(db: AppDatabase): void {
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
  const holidayColumns = db.prepare("pragma table_info(holidays)").all() as Array<{ name: string }>;
  if (!holidayColumns.some((column) => column.name === "type")) {
    db.exec("alter table holidays add column type text not null default 'holiday' check (type in ('holiday', 'adjusted_workday'))");
  }
  ensureArrangementTimeColumns(db, "permit_arrangements");
  ensureArrangementTimeColumns(db, "other_arrangements");
  ensureLeavePeopleUniqueIndex(db);
}

function ensureArrangementTimeColumns(db: AppDatabase, tableName: "permit_arrangements" | "other_arrangements"): void {
  const columns = db.prepare(`pragma table_info(${tableName})`).all() as Array<{ name: string }>;
  const hasStartAt = columns.some((column) => column.name === "start_at");
  const hasEndAt = columns.some((column) => column.name === "end_at");

  if (!hasStartAt) db.exec(`alter table ${tableName} add column start_at text not null default ''`);
  if (!hasEndAt) db.exec(`alter table ${tableName} add column end_at text not null default ''`);

  db.exec(`
    update ${tableName}
    set
      start_at = date || case time_tag
        when '上午' then 'T08:00:00+08:00'
        when '下午' then 'T12:00:00+08:00'
        else 'T00:00:00+08:00'
      end,
      end_at = date || case time_tag
        when '上午' then 'T12:00:00+08:00'
        when '下午' then 'T17:00:00+08:00'
        else 'T23:59:59+08:00'
      end
    where start_at = '' or end_at = ''
  `);
}

function ensureLeavePeopleUniqueIndex(db: AppDatabase): void {
  db.exec(`
    delete from leave_people
    where rowid not in (
      select min(rowid)
      from leave_people
      group by date, name
    )
  `);
  db.exec("create unique index if not exists leave_people_date_name_unique on leave_people (date, name)");
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
