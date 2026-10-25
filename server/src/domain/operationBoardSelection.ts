import type { AppDatabase } from "../db/database.js";

const selectionKey = "operation_plan_id";

export function getOperationBoardSelection(db: AppDatabase) {
  // A row with a null value is an initialized empty selection, not a request to pick again.
  db.prepare(`insert or ignore into board_settings (key, value)
    select ?, id from task_templates where type = 'operation' order by start_at desc, name limit 1`).run(selectionKey);
  db.prepare("insert or ignore into board_settings (key, value) values (?, null)").run(selectionKey);
  const saved = db.prepare<[string], { value: string | null }>("select value from board_settings where key = ?").get(selectionKey)!;
  const plan = saved.value ? db.prepare<[string], { id: string; name: string; enabled: number }>(
    "select id, name, enabled from task_templates where id = ? and type = 'operation'"
  ).get(saved.value) : undefined;
  return { planId: saved.value, name: plan?.name ?? null, exists: !!plan, enabled: plan?.enabled === 1 };
}

export function setOperationBoardSelection(db: AppDatabase, planId: string): void {
  db.prepare("insert into board_settings (key, value) values (?, ?) on conflict(key) do update set value = excluded.value")
    .run(selectionKey, planId);
}
