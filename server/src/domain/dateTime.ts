const chinaOffsetMs = 8 * 60 * 60 * 1000;

export function formatWithChinaOffset(epochMs: number): string {
  if (!Number.isFinite(epochMs)) throw new RangeError("Invalid epoch milliseconds");
  const shifted = new Date(epochMs + chinaOffsetMs);
  return `${shifted.toISOString().slice(0, 23)}+08:00`;
}

export function toChinaOffsetDateTime(value: string | number | Date): string {
  const epochMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return formatWithChinaOffset(epochMs);
}

export function toChinaDate(value: string | number | Date): string {
  return toChinaOffsetDateTime(value).slice(0, 10);
}
