import type { BoardSnapshot } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

type TimeTag = "全天" | "上午" | "下午";

export interface PermitArrangementRecord {
  id: string;
  date: string;
  timeTag: TimeTag;
  permit: string;
  personnel: string;
  area: string;
  other: string;
  enabled: boolean;
}

export interface OtherArrangementRecord {
  id: string;
  date: string;
  timeTag: TimeTag;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
  enabled: boolean;
}

export interface PatrolArrangementRecord {
  id: string;
  itemId: string;
  date: string;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  enabled: boolean;
}

export interface LeavePersonRecord {
  id: string;
  date: string;
  name: string;
  enabled: boolean;
}

export interface HolidayRecord {
  id: string;
  date: string;
  name: string;
  type: "holiday" | "adjusted_workday";
}

export interface ChineseDaysPayload {
  holidays: Record<string, string>;
  workdays: Record<string, string>;
  inLieuDays: Record<string, string>;
}

export interface HolidayImportResult {
  imported: number;
  holidays: number;
  adjustedWorkdays: number;
}

export interface OperationPlanItemRecord {
  id: string;
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
}

export interface OperationPlanRecord {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes: number | null;
  recurrenceCount: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
  childTaskCount: number;
  firstItemContent: string;
}

export interface OperationPlanDetailRecord extends OperationPlanRecord {
  items: OperationPlanItemRecord[];
}

export interface OperationPlanInput {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
  item?: {
    id?: string;
    offsetMinutes: number;
    durationMinutes: number;
    content: string;
    metadata: Record<string, unknown>;
    sortOrder: number;
  };
}

export interface BoardUpdateConnectionHandlers {
  onOpen: () => void;
  onError: () => void;
}

async function postAdmin<TInput extends object>(path: string, input: TInput): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
  return response.json();
}

async function fetchAdmin<TOutput>(path: string): Promise<TOutput> {
  const response = await fetch(`${apiBase}/api/admin/${path}`);
  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
  return response.json();
}

async function putAdmin<TInput extends object>(path: string, input: TInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
}

async function patchAdmin<TInput extends object>(path: string, input: TInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
}

async function deleteAdmin(path: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
}

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) throw new Error(`Board fetch failed: ${response.status}`);
  return response.json();
}

export async function fetchPermitArrangements(date: string): Promise<PermitArrangementRecord[]> {
  return fetchAdmin(`permit-arrangements?date=${encodeURIComponent(date)}`);
}

export async function createPermit(input: {
  date: string;
  timeTag: TimeTag;
  permit: string;
  personnel: string;
  area: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("permit-arrangements", input);
}

export async function updatePermitArrangement(id: string, input: Omit<PermitArrangementRecord, "id" | "enabled">): Promise<void> {
  return putAdmin(`permit-arrangements/${encodeURIComponent(id)}`, input);
}

export async function updatePermitArrangementEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`permit-arrangements/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deletePermitArrangement(id: string): Promise<void> {
  return deleteAdmin(`permit-arrangements/${encodeURIComponent(id)}`);
}

export async function fetchOtherArrangements(date: string): Promise<OtherArrangementRecord[]> {
  return fetchAdmin(`other-arrangements?date=${encodeURIComponent(date)}`);
}

export async function createOtherArrangement(input: {
  date: string;
  timeTag: TimeTag;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("other-arrangements", input);
}

export async function updateOtherArrangement(id: string, input: Omit<OtherArrangementRecord, "id" | "enabled">): Promise<void> {
  return putAdmin(`other-arrangements/${encodeURIComponent(id)}`, input);
}

export async function updateOtherArrangementEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`other-arrangements/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deleteOtherArrangement(id: string): Promise<void> {
  return deleteAdmin(`other-arrangements/${encodeURIComponent(id)}`);
}

export async function fetchPatrolArrangements(date: string): Promise<PatrolArrangementRecord[]> {
  return fetchAdmin(`patrol-arrangements?date=${encodeURIComponent(date)}`);
}

export async function createPatrolArrangement(input: {
  date: string;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("patrol-arrangements", input);
}

export async function updatePatrolArrangement(id: string, input: Omit<PatrolArrangementRecord, "id" | "itemId" | "enabled">): Promise<void> {
  return putAdmin(`patrol-arrangements/${encodeURIComponent(id)}`, input);
}

export async function updatePatrolArrangementEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`patrol-arrangements/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deletePatrolArrangement(id: string): Promise<void> {
  return deleteAdmin(`patrol-arrangements/${encodeURIComponent(id)}`);
}

export async function createLeavePerson(input: { date: string; name: string }): Promise<{ id: string }> {
  return postAdmin("leave-people", input);
}

export async function fetchLeavePeople(date: string): Promise<LeavePersonRecord[]> {
  return fetchAdmin(`leave-people?date=${encodeURIComponent(date)}`);
}

export async function updateLeavePerson(id: string, input: Omit<LeavePersonRecord, "id" | "enabled">): Promise<void> {
  return putAdmin(`leave-people/${encodeURIComponent(id)}`, input);
}

export async function updateLeavePersonEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`leave-people/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deleteLeavePerson(id: string): Promise<void> {
  return deleteAdmin(`leave-people/${encodeURIComponent(id)}`);
}

export async function createHoliday(input: { date: string; name: string }): Promise<{ id: string }> {
  return postAdmin("holidays", input);
}

export async function fetchHolidays(year: number): Promise<HolidayRecord[]> {
  return fetchAdmin(`holidays?year=${encodeURIComponent(String(year))}`);
}

export async function importChineseDaysHolidays(input: ChineseDaysPayload): Promise<HolidayImportResult> {
  const response = await fetch(`${apiBase}/api/admin/holidays/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) throw new Error(`Admin request failed: ${response.status}`);
  return response.json();
}

export async function fetchOperationPlans(date: string, scope: "date" | "all"): Promise<OperationPlanRecord[]> {
  const params = new URLSearchParams({ scope });
  if (scope === "date") params.set("date", date);
  return fetchAdmin(`operation-plans?${params.toString()}`);
}

export async function fetchOperationPlan(id: string): Promise<OperationPlanDetailRecord> {
  return fetchAdmin(`operation-plans/${encodeURIComponent(id)}`);
}

export async function createOperationPlan(input: OperationPlanInput): Promise<{ id: string }> {
  return postAdmin("operation-plans", input);
}

export async function updateOperationPlan(id: string, input: OperationPlanInput): Promise<void> {
  return putAdmin(`operation-plans/${encodeURIComponent(id)}`, input);
}

export async function updateOperationPlanEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`operation-plans/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deleteOperationPlan(id: string): Promise<void> {
  return deleteAdmin(`operation-plans/${encodeURIComponent(id)}`);
}

export async function createTaskContainer(input: {
  type: "operation" | "patrol";
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
  skipWeekends: boolean;
  skipHolidays: boolean;
}): Promise<{ id: string }> {
  return postAdmin("task-containers", input);
}

export async function createTaskItem(input: {
  containerId: string;
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  timeTag?: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
}): Promise<{ id: string }> {
  return postAdmin("task-items", input);
}

export async function deleteTaskItem(id: string): Promise<void> {
  return deleteAdmin(`task-items/${encodeURIComponent(id)}`);
}

export function subscribeBoardUpdates(onUpdate: () => void, handlers?: BoardUpdateConnectionHandlers): EventSource {
  const source = new EventSource(`${apiBase}/api/events`);
  source.addEventListener("board:update", onUpdate);
  if (handlers) {
    source.addEventListener("open", handlers.onOpen);
    source.addEventListener("error", handlers.onError);
  }
  return source;
}
