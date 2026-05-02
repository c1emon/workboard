import type { AppDatabase } from "../db/database.js";
import { expandContainer, type ExpandedTaskItem, type TaskContainer, type TaskItemInput } from "./taskExpansion.js";
import { compareTimeTag, type TimeTag } from "./timeTags.js";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; permit: string; personnel: string; area: string; other: string }>;
  patrols: Array<{ timeTag: TimeTag; target: string; personnel: string; vehicle: string; other: string; metadata: Record<string, unknown> }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string }>;
  leavePeople: string[];
}

interface LeavePersonRow {
  name: string;
}

interface HolidayRow {
  date: string;
}

interface TaskContainerRow {
  id: string;
  type: "operation" | "permit" | "patrol" | "other";
  name: string;
  start_at: string;
  end_at: string;
  recurrence_type: "once" | "finite" | "infinite";
  recurrence_interval_minutes: number | null;
  recurrence_count: number | null;
  skip_weekends: number;
  skip_holidays: number;
  enabled: number;
}

interface TaskItemRow {
  id: string;
  container_id: string;
  offset_minutes: number;
  duration_minutes: number;
  content: string;
  ext_data_json: string;
  sort_order: number;
}

interface SnapshotTaskItem extends TaskItemInput {
  sortOrder: number;
}

type ExpandedArrangementItem = ExpandedTaskItem & { sortOrder?: number };

export function getBoardSnapshot(db: AppDatabase, now = new Date()): BoardSnapshot {
  const date = toChinaDate(now);
  const holidays = new Set(
    db.prepare<[], HolidayRow>("select date from holidays where type = 'holiday'").all().map((row) => row.date)
  );
  const containers = loadTaskContainers(db);
  const itemsByContainer = loadTaskItems(db);
  const operationItems = containers
    .filter((container) => container.type === "operation")
    .flatMap((container) =>
      expandContainer(container, itemsByContainer.get(container.id) ?? [], {
        windowStart: new Date(now.getTime() - 24 * 60 * 60_000).toISOString(),
        windowEnd: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
        holidays
      })
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime() || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item) => ({
      content: item.content ?? "",
      startAt: item.startAt,
      endAt: item.endAt,
      metadata: item.metadata
    }));
  const patrols = containers
    .filter((container) => container.type === "patrol")
    .flatMap((container) =>
      expandContainer(container, itemsByContainer.get(container.id) ?? [], {
        windowStart: `${date}T00:00:00+08:00`,
        windowEnd: `${date}T23:59:59.999+08:00`,
        holidays
      })
    )
    .sort(
      (a, b) =>
        compareTimeTag(metadataTimeTag(a.metadata), metadataTimeTag(b.metadata)) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      target: metadataString(item.metadata, "target"),
      personnel: metadataString(item.metadata, "personnel"),
      vehicle: metadataString(item.metadata, "vehicle"),
      other: metadataString(item.metadata, "other"),
      metadata: item.metadata
    }));
  const permitItems = expandArrangementContainers(containers, itemsByContainer, "permit", date, holidays);
  const permits = permitItems
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      permit: metadataString(item.metadata, "target") || (item.content ?? ""),
      personnel: metadataString(item.metadata, "personnel"),
      area: String(item.metadata.area ?? ""),
      other: metadataString(item.metadata, "other")
    }))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const otherItems = expandArrangementContainers(containers, itemsByContainer, "other", date, holidays);
  const others = otherItems
    .map((item) => ({
      timeTag: metadataTimeTag(item.metadata),
      task: metadataString(item.metadata, "target") || (item.content ?? ""),
      personnel: metadataString(item.metadata, "personnel"),
      vehicle: metadataString(item.metadata, "vehicle"),
      other: metadataString(item.metadata, "other")
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

function expandArrangementContainers(
  containers: TaskContainer[],
  itemsByContainer: Map<string, SnapshotTaskItem[]>,
  type: "permit" | "other",
  date: string,
  holidays: Set<string>
): ExpandedArrangementItem[] {
  return containers
    .filter((container) => container.type === type)
    .flatMap((container) =>
      expandContainer(container, itemsByContainer.get(container.id) ?? [], {
        windowStart: `${date}T00:00:00+08:00`,
        windowEnd: `${date}T23:59:59.999+08:00`,
        holidays
      })
    )
    .sort(
      (a, b) =>
        compareTimeTag(metadataTimeTag(a.metadata), metadataTimeTag(b.metadata)) ||
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
}

function loadTaskContainers(db: AppDatabase): TaskContainer[] {
  return db
    .prepare<[], TaskContainerRow>(
      `select id, type, name, start_at, end_at, recurrence_type, recurrence_interval_minutes,
              recurrence_count, skip_weekends, skip_holidays, enabled
       from task_containers
       where enabled = 1
       order by start_at`
    )
    .all()
    .map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      recurrenceType: row.recurrence_type,
      recurrenceIntervalMinutes: row.recurrence_interval_minutes,
      recurrenceCount: row.recurrence_count,
      skipWeekends: row.skip_weekends === 1,
      skipHolidays: row.skip_holidays === 1,
      enabled: row.enabled === 1
    }));
}

function loadTaskItems(db: AppDatabase): Map<string, SnapshotTaskItem[]> {
  const rows = db
    .prepare<[], TaskItemRow>(
      `select id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order
       from task_items
       order by sort_order, offset_minutes`
    )
    .all();
  const grouped = new Map<string, SnapshotTaskItem[]>();

  for (const row of rows) {
    const item: SnapshotTaskItem = {
      id: row.id,
      offsetMinutes: row.offset_minutes,
      durationMinutes: row.duration_minutes,
      content: row.content,
      metadata: parseMetadata(row.ext_data_json),
      sortOrder: row.sort_order
    };
    grouped.set(row.container_id, [...(grouped.get(row.container_id) ?? []), item]);
  }

  return grouped;
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

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
