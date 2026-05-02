export type RecurrenceType = "once" | "finite" | "infinite";

export interface TaskContainer {
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
}

export interface TaskItemInput {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content?: string;
  metadata: Record<string, unknown>;
  sortOrder?: number;
}

export interface ExpandedTaskItem extends TaskItemInput {
  containerId: string;
  startAt: string;
  endAt: string;
}

export interface ExpandOptions {
  windowStart: string;
  windowEnd: string;
  holidays: Set<string>;
}

export function validateTaskItem(
  parentDurationMinutes: number,
  item: Pick<TaskItemInput, "offsetMinutes" | "durationMinutes">
): { ok: true } | { ok: false; message: string } {
  if (item.offsetMinutes < 0) return { ok: false, message: "offset must be non-negative" };
  if (item.durationMinutes <= 0) return { ok: false, message: "duration must be positive" };
  if (item.offsetMinutes + item.durationMinutes > parentDurationMinutes) {
    return { ok: false, message: "child task ends after parent occurrence" };
  }
  return { ok: true };
}

export function expandContainer(
  container: TaskContainer,
  items: TaskItemInput[],
  options: ExpandOptions
): ExpandedTaskItem[] {
  if (!container.enabled) return [];
  const start = new Date(container.startAt);
  const end = new Date(container.endAt);
  const duration = end.getTime() - start.getTime();
  const windowStart = new Date(options.windowStart).getTime();
  const windowEnd = new Date(options.windowEnd).getTime();
  const occurrences = occurrenceStarts(container, windowStart, windowEnd, duration, options.holidays);

  return occurrences.flatMap((occurrenceStart) => {
    const occurrenceEnd = occurrenceStart + duration;
    if (occurrenceEnd < windowStart || occurrenceStart > windowEnd) return [];
    return items
      .map((item) => {
        const childStart = occurrenceStart + item.offsetMinutes * 60_000;
        const childEnd = childStart + item.durationMinutes * 60_000;
        return {
          ...item,
          containerId: container.id,
          startAt: formatWithChinaOffset(childStart),
          endAt: formatWithChinaOffset(childEnd)
        };
      })
      .filter((item) => new Date(item.endAt).getTime() >= windowStart && new Date(item.startAt).getTime() <= windowEnd);
  });
}

function occurrenceStarts(
  container: TaskContainer,
  windowStart: number,
  windowEnd: number,
  durationMs: number,
  holidays: Set<string>
): number[] {
  const first = new Date(container.startAt).getTime();
  if (container.recurrenceType === "once") return shouldSkipOccurrence(container, first, holidays) ? [] : [first];
  const intervalMinutes = container.recurrenceIntervalMinutes ?? 0;
  if (intervalMinutes <= 0) {
    throw new Error(`recurrenceIntervalMinutes must be positive for ${container.recurrenceType} recurrence`);
  }
  if (container.recurrenceType === "finite" && (container.recurrenceCount ?? 0) <= 0) {
    throw new Error("recurrenceCount must be positive for finite recurrence");
  }

  const interval = intervalMinutes * 60_000;
  const countLimit = container.recurrenceType === "finite" ? container.recurrenceCount ?? 0 : 10_000;
  const starts: number[] = [];
  let eligibleCount = 0;
  for (let index = 0; eligibleCount < countLimit; index += 1) {
    const occurrence = first + index * interval;
    const occurrenceEnd = occurrence + durationMs;
    if (occurrence > windowEnd) break;
    if (shouldSkipOccurrence(container, occurrence, holidays)) continue;
    eligibleCount += 1;
    if (occurrenceEnd >= windowStart && occurrence <= windowEnd) starts.push(occurrence);
  }
  return starts;
}

function shouldSkipOccurrence(container: TaskContainer, occurrenceStart: number, holidays: Set<string>): boolean {
  const chinaDate = formatWithChinaOffset(occurrenceStart).slice(0, 10);
  if (container.skipHolidays && holidays.has(chinaDate)) return true;
  if (!container.skipWeekends) return false;
  const day = new Date(occurrenceStart + 8 * 60 * 60 * 1000).getUTCDay();
  return day === 0 || day === 6;
}

function formatWithChinaOffset(epochMs: number): string {
  const shifted = new Date(epochMs + 8 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 23)}+08:00`;
}
