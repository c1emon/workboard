import { describe, expect, it } from "vitest";
import { extDataString, extDataTimeTag } from "../src/utils/extData";

describe("extData helpers", () => {
  it("normalizes string fields and time tags", () => {
    const extData = { target: "A区", count: 3, timeTag: "上午" };

    expect(extDataString(extData, "target")).toBe("A区");
    expect(extDataString(extData, "count")).toBe("");
    expect(extDataTimeTag(extData)).toBe("上午");
    expect(extDataTimeTag({ timeTag: "夜间" })).toBeNull();
  });
});
