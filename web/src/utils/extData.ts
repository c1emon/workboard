export type ExtDataTimeTag = "全天" | "上午" | "下午";

export function extDataString(extData: Record<string, unknown>, key: string): string {
  const value = extData[key];
  return typeof value === "string" ? value : "";
}

export function extDataTimeTag(extData: Record<string, unknown>): ExtDataTimeTag | null {
  const value = extData.timeTag;
  return value === "全天" || value === "上午" || value === "下午" ? value : null;
}
