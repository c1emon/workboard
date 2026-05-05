import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/database.js";
import { formatWithChinaOffset, toChinaDate } from "./dateTime.js";
import { expandTemplate, type ExpandedTemplateItem, type TaskTemplate, type TaskTemplateItemInput } from "./templateExpansion.js";
import { parseTaskInstanceMetadata, type TaskInstanceSource, type TaskInstanceStatus } from "./taskInstances.js";
import { timeRangeForDateTag, type TimeTag } from "./timeTags.js";

type TaskTemplateType = "operation" | "permit" | "patrol" | "other";

export interface GenerateTaskInstancesInput {
  windowStartDate: string;
  windowEndDate: string;
  types?: TaskTemplateType[];
  templateIds?: string[];
  refreshPending?: boolean;
}

export interface GenerateTaskInstancesOutput {
  inserted: number;
  updated: number;
  skipped: number;
}

interface HolidayRow {
  date: string;
  type: "holiday" | "adjusted_workday";
}

interface TaskTemplateRow {
  id: string;
  type: TaskTemplateType;
  name: string;
  start_at: string;
  end_at: string;
  recurrence_type: "once" | "finite" | "infinite";
  recurrence_interval_minutes: number | null;
  recurrence_count: number | null;
  skip_weekends: number;
  skip_holidays: number;
  enabled: number;
  ext_data_json: string;
}

interface TaskTemplateItemRow {
  id: string;
  template_id: string;
  offset_minutes: number;
  duration_minutes: number;
  content: string;
  ext_data_json: string;
  sort_order: number;
}

interface ExistingTaskInstanceRow {
  id: string;
  source_type: TaskInstanceSource;
  status: TaskInstanceStatus;
}

interface InstanceSnapshot {
  type: TaskTemplateType;
  templateId: string;
  templateItemId: string;
  generationKey: string;
  occurrenceDate: string;
  startAt: string;
  endAt: string;
  content: string;
  metadata: Record<string, unknown>;
}

export function generateTaskInstances(db: AppDatabase, input: GenerateTaskInstancesInput): GenerateTaskInstancesOutput {
  const refreshPending = input.refreshPending ?? false;
  const windowStart = `${input.windowStartDate}T00:00:00+08:00`;
  const windowEnd = `${input.windowEndDate}T23:59:59.999+08:00`;
  const holidaySets = loadHolidaySets(db);
  const selectedTypes = new Set(input.types ?? ["operation", "permit", "patrol", "other"]);
  const selectedTemplateIds = input.templateIds ? new Set(input.templateIds) : null;
  const templates = loadTaskTemplates(db).filter(
    (template) => selectedTypes.has(template.type) && (!selectedTemplateIds || selectedTemplateIds.has(template.id))
  );
  const itemsByTemplate = loadTaskTemplateItems(db);
  const stats: GenerateTaskInstancesOutput = { inserted: 0, updated: 0, skipped: 0 };

  const run = db.transaction(() => {
    for (const template of templates) {
      if (!template.enabled) continue;
      if (toChinaDate(template.startAt) > input.windowEndDate) continue;
      const items = itemsByTemplate.get(template.id) ?? [];
      const snapshots =
        template.type === "patrol"
          ? patrolSnapshots(template, items, input.windowStartDate, input.windowEndDate, holidaySets)
          : simpleSnapshots(template, items, windowStart, windowEnd, holidaySets);

      for (const snapshot of snapshots) {
        upsertGeneratedInstance(db, snapshot, refreshPending, stats);
      }
    }
  });

  run();
  return stats;
}

function simpleSnapshots(
  template: TaskTemplate,
  items: TaskTemplateItemInput[],
  windowStart: string,
  windowEnd: string,
  holidaySets: { holidays: Set<string>; adjustedWorkdays: Set<string> }
): InstanceSnapshot[] {
  return expandTemplate(template, items, {
    windowStart,
    windowEnd,
    holidays: holidaySets.holidays,
    adjustedWorkdays: holidaySets.adjustedWorkdays
  }).map((item) => snapshotFromExpandedItem(template, item));
}

function snapshotFromExpandedItem(template: TaskTemplate, item: ExpandedTemplateItem): InstanceSnapshot {
  const occurrenceStartAt = addMinutes(item.startAt, -item.offsetMinutes);
  return {
    type: template.type,
    templateId: template.id,
    templateItemId: item.id,
    generationKey: generationKey(template.id, item.id, occurrenceStartAt),
    occurrenceDate: item.startAt.slice(0, 10),
    startAt: item.startAt,
    endAt: item.endAt,
    content: item.content ?? "",
    metadata: item.metadata
  };
}

function patrolSnapshots(
  template: TaskTemplate,
  items: TaskTemplateItemInput[],
  windowStartDate: string,
  windowEndDate: string,
  holidaySets: { holidays: Set<string>; adjustedWorkdays: Set<string> }
): InstanceSnapshot[] {
  const snapshots: InstanceSnapshot[] = [];
  const cycleLength = maxPatrolCycleDay(items);
  if (cycleLength === 0) return snapshots;
  const startDate = toChinaDate(template.startAt);
  let eligibleDateCount = 0;

  for (let date = startDate; date <= windowEndDate; date = addDays(date, 1)) {
    if (shouldSkipDate(template, date, holidaySets)) continue;
    eligibleDateCount += 1;
    if (template.recurrenceType === "once" && eligibleDateCount > cycleLength) break;
    if (date < windowStartDate) continue;

    const cycleDay = ((eligibleDateCount - 1) % cycleLength) + 1;
    for (const item of items.filter((candidate) => positiveInteger(candidate.metadata.cycleDay, 0) === cycleDay)) {
      const timeTag = metadataTimeTag(item.metadata);
      const { startAt, endAt } = timeRangeForDateTag(date, timeTag);
      const metadata = {
        timeTag,
        target: metadataString(item.metadata, "target") || (item.content ?? ""),
        personnel: metadataString(item.metadata, "personnel"),
        vehicle: metadataString(item.metadata, "vehicle"),
        other: metadataString(item.metadata, "other"),
        cycleDay
      };

      snapshots.push({
        type: "patrol",
        templateId: template.id,
        templateItemId: item.id,
        generationKey: generationKey(template.id, item.id, patrolOccurrenceAnchor(date)),
        occurrenceDate: date,
        startAt: formatWithChinaOffset(new Date(startAt).getTime()),
        endAt: formatWithChinaOffset(new Date(endAt).getTime()),
        content: item.content ?? "",
        metadata
      });
    }
  }

  return snapshots;
}

function upsertGeneratedInstance(
  db: AppDatabase,
  snapshot: InstanceSnapshot,
  refreshPending: boolean,
  stats: GenerateTaskInstancesOutput
): void {
  const existing = db
    .prepare<[string], ExistingTaskInstanceRow>("select id, source_type, status from task_instances where generation_key = ?")
    .get(snapshot.generationKey);
  const now = new Date().toISOString();
  const extDataJson = JSON.stringify(snapshot.metadata);

  if (!existing) {
    db.prepare(
      `insert into task_instances
       (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
        start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values (?, ?, ?, ?, 'generated', ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      nanoid(),
      snapshot.type,
      snapshot.templateId,
      snapshot.templateItemId,
      snapshot.generationKey,
      snapshot.occurrenceDate,
      snapshot.startAt,
      snapshot.endAt,
      snapshot.content,
      extDataJson,
      now,
      now
    );
    stats.inserted += 1;
    return;
  }

  if (existing.source_type === "generated" && existing.status === "pending" && refreshPending) {
    db.prepare(
      `update task_instances
       set type = ?, template_id = ?, source_template_item_id = ?, occurrence_date = ?,
           start_at = ?, end_at = ?, content = ?, ext_data_json = ?, generated_at = ?, updated_at = ?
       where id = ?`
    ).run(
      snapshot.type,
      snapshot.templateId,
      snapshot.templateItemId,
      snapshot.occurrenceDate,
      snapshot.startAt,
      snapshot.endAt,
      snapshot.content,
      extDataJson,
      now,
      now,
      existing.id
    );
    stats.updated += 1;
    return;
  }

  stats.skipped += 1;
}

function loadHolidaySets(db: AppDatabase): { holidays: Set<string>; adjustedWorkdays: Set<string> } {
  const rows = db.prepare<[], HolidayRow>("select date, type from holidays").all();
  return {
    holidays: new Set(rows.filter((row) => row.type === "holiday").map((row) => row.date)),
    adjustedWorkdays: new Set(rows.filter((row) => row.type === "adjusted_workday").map((row) => row.date))
  };
}

function loadTaskTemplates(db: AppDatabase): TaskTemplate[] {
  return db
    .prepare<[], TaskTemplateRow>(
      `select id, type, name, start_at, end_at, recurrence_type, recurrence_interval_minutes,
              recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json
       from task_templates
       order by start_at, id`
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
      enabled: row.enabled === 1,
      metadata: parseTaskInstanceMetadata(row.ext_data_json)
    }));
}

function loadTaskTemplateItems(db: AppDatabase): Map<string, TaskTemplateItemInput[]> {
  const rows = db
    .prepare<[], TaskTemplateItemRow>(
      `select id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order
       from task_template_items
       order by sort_order, offset_minutes, id`
    )
    .all();
  const grouped = new Map<string, TaskTemplateItemInput[]>();

  for (const row of rows) {
    const item = {
      id: row.id,
      offsetMinutes: row.offset_minutes,
      durationMinutes: row.duration_minutes,
      content: row.content,
      metadata: parseTaskInstanceMetadata(row.ext_data_json),
      sortOrder: row.sort_order
    };
    grouped.set(row.template_id, [...(grouped.get(row.template_id) ?? []), item]);
  }

  return grouped;
}

function shouldSkipDate(
  template: Pick<TaskTemplate, "skipHolidays" | "skipWeekends">,
  date: string,
  holidaySets: { holidays: Set<string>; adjustedWorkdays: Set<string> }
): boolean {
  if (template.skipHolidays && holidaySets.holidays.has(date)) return true;
  if (!template.skipWeekends || holidaySets.adjustedWorkdays.has(date)) return false;
  return isWeekend(date);
}

function generationKey(templateId: string, templateItemId: string, occurrenceStartAt: string): string {
  return `${templateId}:${templateItemId}:${occurrenceStartAt}`;
}

function patrolOccurrenceAnchor(date: string): string {
  return `${date}T00:00:00+08:00`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

function addMinutes(value: string, minutes: number): string {
  return formatWithChinaOffset(new Date(value).getTime() + minutes * 60_000);
}

function isWeekend(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function positiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0) return Number(value);
  return fallback;
}

function maxPatrolCycleDay(items: TaskTemplateItemInput[]): number {
  return items.reduce((max, item) => Math.max(max, positiveInteger(item.metadata.cycleDay, 0)), 0);
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function metadataTimeTag(metadata: Record<string, unknown>): TimeTag {
  const value = metadata.timeTag;
  return value === "上午" || value === "下午" || value === "全天" ? value : "全天";
}
