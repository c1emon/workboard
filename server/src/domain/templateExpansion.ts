export type RecurrenceType = "once" | "finite" | "infinite";

export interface TaskTemplate {
  id: string;
  type: "operation" | "permit" | "patrol" | "other";
  name: string;
  startAt: string;
  endAt: string;
  recurrenceType: RecurrenceType;
  recurrenceIntervalMinutes: number | null;
  recurrenceCount: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
  metadata: Record<string, unknown>;
}

export interface TaskTemplateItemInput {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content?: string;
  metadata: Record<string, unknown>;
  sortOrder?: number;
}

export interface ExpandedTemplateItem extends TaskTemplateItemInput {
  templateId: string;
  startAt: string;
  endAt: string;
}

export interface ExpandOptions {
  windowStart: string;
  windowEnd: string;
  holidays: Set<string>;
  adjustedWorkdays?: Set<string>;
}

export function validateTaskItem(
  parentDurationMinutes: number,
  item: Pick<TaskTemplateItemInput, "offsetMinutes" | "durationMinutes">
): { ok: true } | { ok: false; message: string } {
  if (item.offsetMinutes < 0) return { ok: false, message: "offset must be non-negative" };
  if (item.durationMinutes <= 0) return { ok: false, message: "duration must be positive" };
  if (item.offsetMinutes + item.durationMinutes > parentDurationMinutes) {
    return { ok: false, message: "child task ends after parent occurrence" };
  }
  return { ok: true };
}

export function expandTemplate(
  template: TaskTemplate,
  items: TaskTemplateItemInput[],
  options: ExpandOptions
): ExpandedTemplateItem[] {
  if (!template.enabled) return [];
  const start = new Date(template.startAt);
  const end = new Date(template.endAt);
  const duration = end.getTime() - start.getTime();
  const windowStart = new Date(options.windowStart).getTime();
  const windowEnd = new Date(options.windowEnd).getTime();
  const occurrences = occurrenceStarts(
    template,
    windowStart,
    windowEnd,
    duration,
    options.holidays,
    options.adjustedWorkdays ?? new Set()
  );

  return occurrences.flatMap((occurrenceStart) => {
    const occurrenceEnd = occurrenceStart + duration;
    if (occurrenceEnd < windowStart || occurrenceStart > windowEnd) return [];
    return items
      .map((item) => {
        const childStart = occurrenceStart + item.offsetMinutes * 60_000;
        const childEnd = childStart + item.durationMinutes * 60_000;
        return {
          ...item,
          templateId: template.id,
          startAt: formatWithChinaOffset(childStart),
          endAt: formatWithChinaOffset(childEnd)
        };
      })
      .filter((item) => new Date(item.endAt).getTime() >= windowStart && new Date(item.startAt).getTime() <= windowEnd);
  });
}

function occurrenceStarts(
  template: TaskTemplate,
  windowStart: number,
  windowEnd: number,
  durationMs: number,
  holidays: Set<string>,
  adjustedWorkdays: Set<string>
): number[] {
  const first = new Date(template.startAt).getTime();
  if (template.recurrenceType === "once") return shouldSkipOccurrence(template, first, holidays, adjustedWorkdays) ? [] : [first];
  const intervalMinutes = template.recurrenceIntervalMinutes ?? 0;
  if (intervalMinutes <= 0) {
    throw new Error(`recurrenceIntervalMinutes must be positive for ${template.recurrenceType} recurrence`);
  }
  if (template.recurrenceType === "finite" && (template.recurrenceCount ?? 0) <= 0) {
    throw new Error("recurrenceCount must be positive for finite recurrence");
  }

  const interval = intervalMinutes * 60_000;
  const countLimit = template.recurrenceType === "finite" ? template.recurrenceCount ?? 0 : 10_000;
  const starts: number[] = [];
  let eligibleCount = 0;
  for (let index = 0; eligibleCount < countLimit; index += 1) {
    const occurrence = first + index * interval;
    const occurrenceEnd = occurrence + durationMs;
    if (occurrence > windowEnd) break;
    if (shouldSkipOccurrence(template, occurrence, holidays, adjustedWorkdays)) continue;
    eligibleCount += 1;
    if (occurrenceEnd >= windowStart && occurrence <= windowEnd) starts.push(occurrence);
  }
  return starts;
}

function shouldSkipOccurrence(
  template: TaskTemplate,
  occurrenceStart: number,
  holidays: Set<string>,
  adjustedWorkdays: Set<string>
): boolean {
  const chinaDate = formatWithChinaOffset(occurrenceStart).slice(0, 10);
  if (template.skipHolidays && holidays.has(chinaDate)) return true;
  if (!template.skipWeekends || adjustedWorkdays.has(chinaDate)) return false;
  const day = new Date(occurrenceStart + 8 * 60 * 60 * 1000).getUTCDay();
  return day === 0 || day === 6;
}

function formatWithChinaOffset(epochMs: number): string {
  const shifted = new Date(epochMs + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 23)}+08:00`;
}
