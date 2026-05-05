import type { TimeTag } from "./timeTags.js";

export const taskInstanceSources = ["generated", "manual", "override"] as const;
export const taskInstanceStatuses = ["pending", "in_progress", "done", "cancelled"] as const;

export type TaskInstanceSource = (typeof taskInstanceSources)[number];
export type TaskInstanceStatus = (typeof taskInstanceStatuses)[number];

export function parseExtDataJson(raw: string, onInvalidJson?: (raw: string) => void): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    onInvalidJson?.(raw);
    return {};
  }
  return {};
}

export function extDataString(extData: Record<string, unknown>, key: string): string {
  const value = extData[key];
  return typeof value === "string" ? value : "";
}

export function extDataTimeTag(extData: Record<string, unknown>): TimeTag {
  const value = extData.timeTag;
  return value === "上午" || value === "下午" || value === "全天" ? value : "全天";
}
