import * as XLSX from "xlsx";
import type { PatrolCycleItemImportInput } from "../api/client";

type ImportedPatrolCycleItem = PatrolCycleItemImportInput["items"][number];

const requiredHeaders = ["周期第几天", "时间", "目标", "人员", "车辆", "其他"] as const;
const validTimeTags = new Set(["全天", "上午", "下午"]);

export async function parsePatrolCycleItemExcel(file: File): Promise<ImportedPatrolCycleItem[]> {
  const workbook = XLSX.read(await readFileArrayBuffer(file), { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel 文件没有工作表");

  const rows = XLSX.utils.sheet_to_json<Array<string | number | null | undefined>>(workbook.Sheets[firstSheet], {
    header: 1,
    blankrows: false,
    defval: ""
  });
  const [headers, ...dataRows] = rows;
  validateHeaders(headers ?? []);

  const items = dataRows
    .map((row, index) => parseRow(row, index + 2))
    .filter((item): item is ImportedPatrolCycleItem => item !== null);
  if (items.length === 0) throw new Error("Excel 文件没有可导入的周期项");
  return items;
}

async function readFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("无法读取 Excel 文件"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("无法读取 Excel 文件")));
    reader.readAsArrayBuffer(file);
  });
}

function validateHeaders(headers: Array<string | number | null | undefined>): void {
  const normalized = headers.map((header) => stringValue(header));
  const missing = requiredHeaders.filter((header) => !normalized.includes(header));
  if (missing.length > 0) throw new Error(`Excel 表头缺少：${missing.join("、")}`);
}

function parseRow(row: Array<string | number | null | undefined>, rowNumber: number): ImportedPatrolCycleItem | null {
  const [cycleDayRaw, timeTagRaw, targetRaw, personnelRaw, vehicleRaw, otherRaw] = row;
  if ([cycleDayRaw, timeTagRaw, targetRaw, personnelRaw, vehicleRaw, otherRaw].every((value) => stringValue(value) === "")) return null;

  const cycleDay = Number(cycleDayRaw);
  const timeTag = stringValue(timeTagRaw);
  const target = stringValue(targetRaw);
  if (!Number.isInteger(cycleDay) || cycleDay < 1) throw new Error(`第 ${rowNumber} 行周期第几天必须是大于 0 的整数`);
  if (!validTimeTags.has(timeTag)) throw new Error(`第 ${rowNumber} 行时间必须是 全天、上午 或 下午`);
  if (!target) throw new Error(`第 ${rowNumber} 行目标不能为空`);

  return {
    cycleDay,
    timeTag: timeTag as ImportedPatrolCycleItem["timeTag"],
    target,
    personnel: stringValue(personnelRaw),
    vehicle: stringValue(vehicleRaw),
    other: stringValue(otherRaw)
  };
}

function stringValue(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}
