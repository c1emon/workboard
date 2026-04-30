export type TimeTag = "全天" | "上午" | "下午";

const order: Record<TimeTag, number> = {
  全天: 0,
  上午: 1,
  下午: 2
};

export function compareTimeTag(a: TimeTag, b: TimeTag): number {
  return order[a] - order[b];
}
