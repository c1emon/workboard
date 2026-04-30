import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export async function createPermit(input: {
  date: string;
  timeTag: "全天" | "上午" | "下午";
  permit: string;
  personnel: string;
  area: string;
  other: string;
}): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/api/admin/permit-arrangements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(`Permit creation failed: ${response.status}`);
  return response.json();
}

export function subscribeBoardUpdates(onUpdate: () => void): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  return source;
}
