import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

type TimeTag = "全天" | "上午" | "下午";

async function postAdmin<TInput extends object>(path: string, input: TInput): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
  return response.json();
}

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export async function createPermit(input: {
  date: string;
  timeTag: TimeTag;
  permit: string;
  personnel: string;
  area: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("permit-arrangements", input);
}

export async function createOtherArrangement(input: {
  date: string;
  timeTag: TimeTag;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("other-arrangements", input);
}

export async function createLeavePerson(input: { date: string; name: string }): Promise<{ id: string }> {
  return postAdmin("leave-people", input);
}

export async function createHoliday(input: { date: string; name: string }): Promise<{ id: string }> {
  return postAdmin("holidays", input);
}

export async function createTaskContainer(input: {
  type: "operation" | "patrol";
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
}): Promise<{ id: string }> {
  return postAdmin("task-containers", input);
}

export async function createTaskItem(input: {
  containerId: string;
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  timeTag?: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
}): Promise<{ id: string }> {
  return postAdmin("task-items", input);
}

export function subscribeBoardUpdates(onUpdate: () => void): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  return source;
}
