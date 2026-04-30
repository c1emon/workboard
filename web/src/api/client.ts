import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export function subscribeBoardUpdates(onUpdate: () => void): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  return source;
}
