// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePatrolCycleItemExcel } from "../src/utils/patrolCycleItemExcel";

describe("parsePatrolCycleItemExcel", () => {
  it("maps Excel rows to patrol cycle item import payloads", async () => {
    const file = workbookFile([
      ["周期第几天", "时间", "目标", "人员", "车辆", "其他"],
      [1, "上午", "1号线", "张三", "巡检车", "带记录仪"],
      [2, "下午", "2号线", "李四", "", ""]
    ]);

    await expect(parsePatrolCycleItemExcel(file)).resolves.toEqual([
      { cycleDay: 1, timeTag: "上午", target: "1号线", personnel: "张三", vehicle: "巡检车", other: "带记录仪" },
      { cycleDay: 2, timeTag: "下午", target: "2号线", personnel: "李四", vehicle: "", other: "" }
    ]);
  });

  it("rejects invalid time tags with row numbers", async () => {
    const file = workbookFile([
      ["周期第几天", "时间", "目标", "人员", "车辆", "其他"],
      [1, "晚上", "1号线", "", "", ""]
    ]);

    await expect(parsePatrolCycleItemExcel(file)).rejects.toThrow("第 2 行时间必须是 全天、上午 或 下午");
  });

  it("loads xlsx only when parsing an import file", () => {
    const source = readFileSync(join(process.cwd(), "src/utils/patrolCycleItemExcel.ts"), "utf8");

    expect(source).not.toContain("import * as XLSX from \"xlsx\"");
    expect(source).toContain("import(\"xlsx\")");
  });
});

function workbookFile(rows: unknown[][]): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "周期项");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new File([buffer], "patrol.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
