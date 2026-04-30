export type TimeTag = "全天" | "上午" | "下午";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; permit: string; personnel: string; area: string; other: string }>;
  patrols: Array<{ timeTag: TimeTag; target: string; personnel: string; vehicle: string; other: string; metadata: Record<string, unknown> }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string }>;
  leavePeople: string[];
}
