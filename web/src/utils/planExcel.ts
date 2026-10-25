import type { OperationPlanDetailRecord, OperationPlanItemInput, PatrolPlanDetail } from "../api/client";
import type { PatrolCycleItemImportInput } from "../api/client";

type Scalar = string | number | boolean | null;
export const operationHeaders = ["序号", "任务内容", "开始偏移（分钟）", "持续时间（分钟）"];
export const patrolHeaders = ["周期第几天", "时间", "目标", "人员", "车辆", "其他"];

export async function readDetailSheet(file: File, sheetName: string, required: string[]) {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("请选择 .xlsx 文件");
  const XLSX = await import("xlsx");
  const data = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error("无法读取 Excel 文件"));
    reader.onerror = () => reject(new Error("无法读取 Excel 文件"));
    reader.readAsArrayBuffer(file);
  });
  const workbook = XLSX.read(data, { type: "array" });
  const name = workbook.SheetNames.includes(sheetName) ? sheetName
    : workbook.SheetNames.length === 1 && workbook.SheetNames[0] !== "计划信息" ? workbook.SheetNames[0] : null;
  if (!name) throw new Error(`Excel 缺少「${sheetName}」明细工作表`);
  const rows = XLSX.utils.sheet_to_json<Scalar[]>(workbook.Sheets[name], { header: 1, blankrows: true, defval: "", range: 0 });
  const headers = (rows.shift() ?? []).map((value) => String(value ?? "").trim());
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`工作表「${name}」表头缺少：${missing.join("、")}`);
  const duplicates = [...new Set(headers.filter((h, i) => h && headers.indexOf(h) !== i))];
  if (duplicates.length) throw new Error(`工作表「${name}」表头重复：${duplicates.join("、")}`);
  if (rows.some((row) => row.some((value, i) => value !== "" && value !== null && !headers[i]))) {
    throw new Error(`工作表「${name}」存在没有表头的数据列`);
  }
  return { headers, rows, name };
}

export async function parseOperationDetailExcel(file: File): Promise<OperationPlanItemInput[]> {
  const { headers, rows, name } = await readDetailSheet(file, "子任务", operationHeaders.slice(1));
  const items: OperationPlanItemInput[] = [];
  const orders = new Set<number>();
  rows.forEach((row, index) => {
    if (row.every((cell) => cell === null || String(cell).trim() === "")) return;
    const get = (header: string) => row[headers.indexOf(header)] ?? "";
    const fail = (field: string, reason: string): never => { throw new Error(`工作表「${name}」第 ${index + 2} 行 ${field}${reason}`); };
    const number = (header: string, positive: boolean) => {
      const raw = get(header);
      const value = typeof raw === "boolean" || String(raw).trim() === "" ? NaN : Number(raw);
      if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail(header, positive ? "必须是大于 0 的整数" : "必须是非负整数");
      return value;
    };
    const content = String(get("任务内容")).trim();
    if (!content) fail("任务内容", "不能为空");
    const sortOrder = headers.includes("序号") ? number("序号", true) : index + 1;
    if (orders.has(sortOrder)) fail("序号", "重复");
    orders.add(sortOrder);
    const extData: Record<string, Scalar> = Object.create(null);
    headers.forEach((header, column) => { if (header && !operationHeaders.includes(header)) extData[header] = row[column] ?? ""; });
    items.push({ content, offsetMinutes: number("开始偏移（分钟）", false), durationMinutes: number("持续时间（分钟）", true), sortOrder, extData });
  });
  if (!items.length) throw new Error(`工作表「${name}」没有可导入的子任务`);
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function parsePatrolDetailExcel(file: File): Promise<PatrolCycleItemImportInput["items"]> {
  const { headers, rows, name } = await readDetailSheet(file, "周期项", patrolHeaders);
  const items: PatrolCycleItemImportInput["items"] = [];
  rows.forEach((row, index) => {
    if (row.every((cell) => cell === null || String(cell).trim() === "")) return;
    const [day, time, target, personnel, vehicle, other] = patrolHeaders.map((header) => String(row[headers.indexOf(header)] ?? "").trim());
    const fail = (reason: string): never => { throw new Error(`工作表「${name}」第 ${index + 2} 行${reason}`); };
    const cycleDay = Number(day);
    if ([day, time, target, personnel, vehicle, other].every(value => !value)) return;
    if (!Number.isSafeInteger(cycleDay) || cycleDay < 1) fail("周期第几天必须是大于 0 的整数");
    if (!["全天", "上午", "下午"].includes(time)) fail("时间必须是 全天、上午 或 下午");
    if (!target) fail("目标不能为空");
    items.push({ cycleDay, timeTag: time as "全天" | "上午" | "下午", target, personnel, vehicle, other });
  });
  if (!items.length) throw new Error(`工作表「${name}」没有可导入的周期项`);
  return items;
}

function cellValue(value: unknown): Scalar {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return JSON.stringify(value);
}

function detailRows(fixedHeaders: string[], rows: Scalar[][], extensions: Record<string, unknown>[], excluded: string[]) {
  const keys = [...new Set(extensions.flatMap((ext) => Object.keys(ext)))].filter((key) => !excluded.includes(key)).sort();
  const used = new Set(fixedHeaders);
  const extraHeaders = keys.map((key) => {
    let name = key;
    while (!name || used.has(name)) name = `扩展：${name}`;
    used.add(name);
    return name;
  });
  return [[...fixedHeaders, ...extraHeaders], ...rows.map((row, i) => [...row, ...keys.map((key) => cellValue(extensions[i][key]))])];
}

export async function createPlanWorkbook(kind: "operation" | "patrol", plan: OperationPlanDetailRecord | PatrolPlanDetail) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const operation = kind === "operation" ? plan as OperationPlanDetailRecord : null;
  const patrol = kind === "patrol" ? plan as PatrolPlanDetail : null;
  const cycle = operation ? Math.max(0, ...operation.items.map((item) => item.offsetMinutes + item.durationMinutes)) : patrol!.cycleLength;
  const info: Scalar[][] = [["字段", "值"], ["计划名称", plan.name], ["说明", plan.description],
    ["类型", plan.recurrenceType === "once" ? "一次性" : plan.recurrenceType === "finite" ? "有限循环" : "无限循环"],
    ["开始时间", plan.startAt], ["结束时间", plan.recurrenceType === "finite" ? plan.endAt : ""],
    ["启用状态", plan.enabled ? "已启用" : "已禁用"], ["跳过周末", plan.skipWeekends], ["跳过节假日", plan.skipHolidays],
    [operation ? "周期时长（分钟）" : "周期天数", cycle]];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(info), "计划信息");
  const rows = operation ? detailRows(operationHeaders,
    operation.items.map((item, index) => [index + 1, item.content, item.offsetMinutes, item.durationMinutes]),
    operation.items.map((item) => item.extData), [])
    : detailRows(patrolHeaders, patrol!.items.map((item) => [item.cycleDay, item.timeTag, item.target, item.personnel, item.vehicle, item.other]),
      patrol!.items.map((item) => item.extData ?? {}), ["cycleDay", "timeTag", "target", "personnel", "vehicle", "other"]);
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), operation ? "子任务" : "周期项");
  return workbook;
}

export async function downloadPlanWorkbook(kind: "operation" | "patrol", plan: OperationPlanDetailRecord | PatrolPlanDetail) {
  const XLSX = await import("xlsx");
  const workbook = await createPlanWorkbook(kind, plan);
  const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replaceAll("-", "");
  const safeName = plan.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 100) || "未命名";
  XLSX.writeFile(workbook, `${kind === "operation" ? "操作" : "巡视"}计划-${safeName}-${date}.xlsx`);
}

export async function downloadDetailTemplate(kind: "operation" | "patrol") {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([kind === "operation" ? operationHeaders : patrolHeaders]), kind === "operation" ? "子任务" : "周期项");
  XLSX.writeFile(workbook, `${kind === "operation" ? "操作子任务" : "巡视周期项"}导入模板.xlsx`);
}
