export type TimeTag = "全天" | "上午" | "下午";
export type TaskInstanceStatus = "pending" | "in_progress" | "done" | "cancelled";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; status: TaskInstanceStatus; extData: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; target: string; task: string; personnel: string; vehicle: string; other: string; status: TaskInstanceStatus }>;
  patrols: Array<{
    timeTag: TimeTag;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    status: TaskInstanceStatus;
    extData: Record<string, unknown>;
  }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string; status: TaskInstanceStatus }>;
  leavePeople: string[];
}
