export type TimeTag = "全天" | "上午" | "下午";

const order: Record<TimeTag, number> = {
  全天: 0,
  上午: 1,
  下午: 2
};

const ranges: Record<TimeTag, { start: string; end: string }> = {
  全天: { start: "00:00:00+08:00", end: "23:59:59+08:00" },
  上午: { start: "08:00:00+08:00", end: "12:00:00+08:00" },
  下午: { start: "12:00:00+08:00", end: "17:00:00+08:00" }
};

export function compareTimeTag(a: TimeTag, b: TimeTag): number {
  return order[a] - order[b];
}

export function timeRangeForDateTag(date: string, timeTag: TimeTag): { startAt: string; endAt: string } {
  const range = ranges[timeTag];
  return {
    startAt: `${date}T${range.start}`,
    endAt: `${date}T${range.end}`
  };
}

export function durationMinutesForRange(startAt: string, endAt: string): number {
  return Math.max(1, Math.floor((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000));
}
