import { describe, expect, it } from "vitest";
import { extDataString, extDataTimeTag, parseExtDataJson } from "../src/domain/taskInstances.js";

describe("extData helpers", () => {
  it("parses object JSON and rejects invalid or non-object JSON", () => {
    expect(parseExtDataJson('{"target":"A区"}')).toEqual({ target: "A区" });
    expect(parseExtDataJson("[1,2]")).toEqual({});
    expect(parseExtDataJson("{invalid")).toEqual({});
  });

  it("normalizes string fields and time tags", () => {
    const extData = { target: "A区", count: 3, timeTag: "下午" };

    expect(extDataString(extData, "target")).toBe("A区");
    expect(extDataString(extData, "count")).toBe("");
    expect(extDataTimeTag(extData)).toBe("下午");
    expect(extDataTimeTag({ timeTag: "夜间" })).toBe("全天");
  });
});
