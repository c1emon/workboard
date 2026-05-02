export const taskInstanceSources = ["generated", "manual", "override"] as const;
export const taskInstanceStatuses = ["pending", "in_progress", "done", "cancelled"] as const;

export type TaskInstanceSource = (typeof taskInstanceSources)[number];
export type TaskInstanceStatus = (typeof taskInstanceStatuses)[number];

export function parseTaskInstanceMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}
