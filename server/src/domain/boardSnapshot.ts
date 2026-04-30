import type { AppDatabase } from "../db/database.js";
import { compareTimeTag, type TimeTag } from "./timeTags.js";

export interface BoardSnapshot {
  serverTime: string;
  operation: { items: Array<{ content: string; startAt: string; endAt: string; metadata: Record<string, unknown> }> };
  permits: Array<{ timeTag: TimeTag; permit: string; personnel: string; area: string; other: string }>;
  patrols: Array<{ timeTag: TimeTag; target: string; personnel: string; vehicle: string; other: string; metadata: Record<string, unknown> }>;
  others: Array<{ timeTag: TimeTag; task: string; personnel: string; vehicle: string; other: string }>;
  leavePeople: string[];
}

interface PermitArrangementRow {
  time_tag: TimeTag;
  permit: string;
  personnel: string;
  area: string;
  other: string;
}

interface OtherArrangementRow {
  time_tag: TimeTag;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
}

interface LeavePersonRow {
  name: string;
}

export function getBoardSnapshot(db: AppDatabase, now = new Date()): BoardSnapshot {
  const date = toChinaDate(now);
  const permits = db
    .prepare<[string], PermitArrangementRow>(
      "select time_tag, permit, personnel, area, other from permit_arrangements where date = ? and enabled = 1 order by sort_order"
    )
    .all(date)
    .map((row) => ({
      timeTag: row.time_tag,
      permit: row.permit,
      personnel: row.personnel,
      area: row.area,
      other: row.other
    }))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const others = db
    .prepare<[string], OtherArrangementRow>(
      "select time_tag, task, personnel, vehicle, other from other_arrangements where date = ? and enabled = 1 order by sort_order"
    )
    .all(date)
    .map((row) => ({
      timeTag: row.time_tag,
      task: row.task,
      personnel: row.personnel,
      vehicle: row.vehicle,
      other: row.other
    }))
    .sort((a, b) => compareTimeTag(a.timeTag, b.timeTag));
  const leavePeople = db
    .prepare<[string], LeavePersonRow>("select name from leave_people where date = ? and enabled = 1 order by sort_order")
    .all(date)
    .map((row) => row.name);

  return {
    serverTime: now.toISOString(),
    operation: { items: [] },
    permits,
    patrols: [],
    others,
    leavePeople
  };
}

function toChinaDate(date: Date): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
