import type { AppDatabase } from "../db/database.js";
import { toChinaDate, toChinaOffsetDateTime } from "./dateTime.js";
import { compareTimeTag, type TimeTag } from "./timeTags.js";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; status: TaskInstanceStatus; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; target: string; task: string; personnel: string; vehicle: string; other: string; status: TaskInstanceStatus }>;
  patrols: Array<{
    timeTag: TimeTag;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    status: TaskInstanceStatus;
    metadata: Record<string, unknown>;
  }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string; status: TaskInstanceStatus }>;
  leavePeople: string[];
}

interface LeavePersonRow {
  name: string;
}

interface TaskInstanceRow {
  id: string;
  type: "operation" | "permit" | "patrol" | "other";
  template_id: string | null;
  source_template_item_id: string | null;
  source_type: "generated" | "manual" | "override";
  generation_key: string | null;
  occurrence_date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
}

type TaskInstanceStatus = TaskInstanceRow["status"];

interface SnapshotTaskInstance {
  id: string;
  type: TaskInstanceRow["type"];
  startAt: string;
  endAt: string;
  content: string;
  status: TaskInstanceStatus;
  metadata: Record<string, unknown>;
}

export function getBoardSnapshot(db: AppDatabase, now = new Date()): BoardSnapshot {
  const date = toChinaDate(now);
  const operationInstances = loadTaskInstances(db, "operation", {
    start: new Date(now.getTime() - 24 * 60 * 60_000),
    end: new Date(now.getTime() + 24 * 60 * 60_000)
  });
  const dayWindow = {
    start: new Date(`${date}T00:00:00+08:00`),
    end: new Date(`${date}T23:59:59.999+08:00`)
  };
  const operationItems = operationInstances
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .map((item) => ({
      content: item.content ?? "",
      startAt: item.startAt,
      endAt: item.endAt,
      status: item.status,
      metadata: item.metadata
    }));
  const patrols = loadTaskInstances(db, "patrol", dayWindow)
    .sort(
      (a, b) =>
        compareTimeTag(metadataTimeTag(a.metadata), metadataTimeTag(b.metadata)) ||
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      target: metadataString(item.metadata, "target"),
      personnel: metadataString(item.metadata, "personnel"),
      vehicle: metadataString(item.metadata, "vehicle"),
      other: metadataString(item.metadata, "other"),
      status: item.status,
      metadata: item.metadata
    }));
  const permits = loadTaskInstances(db, "permit", dayWindow)
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      target: metadataString(item.metadata, "target"),
      task: item.content ?? "",
      personnel: metadataString(item.metadata, "personnel"),
      vehicle: metadataString(item.metadata, "vehicle"),
      other: metadataString(item.metadata, "other"),
      status: item.status
    }))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const others = loadTaskInstances(db, "other", dayWindow)
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      task: metadataString(item.metadata, "target") || (item.content ?? ""),
      personnel: metadataString(item.metadata, "personnel"),
      vehicle: metadataString(item.metadata, "vehicle"),
      other: metadataString(item.metadata, "other"),
      status: item.status
    }))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const leavePeople = db
    .prepare<[string], LeavePersonRow>("select name from leave_people where date = ? and enabled = 1 order by sort_order")
    .all(date)
    .map((row) => row.name);

  return {
    serverTime: now.toISOString(),
    operation: { items: operationItems },
    permits,
    patrols,
    others,
    leavePeople
  };
}

function loadTaskInstances(
  db: AppDatabase,
  type: TaskInstanceRow["type"],
  window: { start: Date; end: Date }
): SnapshotTaskInstance[] {
  const windowStart = toChinaOffsetDateTime(window.start);
  const windowEnd = toChinaOffsetDateTime(window.end);
  const rows = db
    .prepare<[TaskInstanceRow["type"], string, string], TaskInstanceRow>(
      `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
              start_at, end_at, content, ext_data_json, status
       from task_instances
       where type = ?
         and status <> 'cancelled'
         and start_at <= ?
         and end_at >= ?
       order by start_at, end_at, id`
    )
    .all(type, windowEnd, windowStart);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    startAt: row.start_at,
    endAt: row.end_at,
    content: row.content,
    status: row.status,
    metadata: parseMetadata(row.ext_data_json)
  }));
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function metadataTimeTag(metadata: Record<string, unknown>): TimeTag {
  const value = metadata.timeTag;
  return value === "上午" || value === "下午" || value === "全天" ? value : "全天";
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    console.warn("Failed to parse task metadata JSON", { raw });
    return {};
  }
  return {};
}
