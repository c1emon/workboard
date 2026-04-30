import Database from "better-sqlite3";
import { schemaSql } from "./schema.js";

export type AppDatabase = Database.Database;

export function migrate(db: AppDatabase): void {
  db.pragma("foreign_keys = ON");
  db.exec(schemaSql);
}

export function openDatabase(filename = "server/db/workboard.sqlite"): AppDatabase {
  const db = new Database(filename);
  migrate(db);
  return db;
}

export function createTestDatabase(): AppDatabase {
  const db = new Database(":memory:");
  migrate(db);
  return db;
}
