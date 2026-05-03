import type { BoardSnapshot, TaskInstanceStatus } from "./types";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

type TimeTag = "全天" | "上午" | "下午";
type ListScope = "date" | "all";
type TaskTemplateType = "operation" | "permit" | "patrol" | "other";

export interface PermitArrangementRecord {
  id: string;
  date: string;
  timeTag: TimeTag;
  startAt: string;
  endAt: string;
  target: string;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
  enabled: boolean;
}

export interface OtherArrangementRecord {
  id: string;
  date: string;
  timeTag: TimeTag;
  startAt: string;
  endAt: string;
  task: string;
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
  endAt: string | null;
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

export interface OperationPlanItemInput {
  offsetMinutes: number;
  durationMinutes: number;
  content: string;
  metadata: Record<string, unknown>;
  sortOrder: number;
}

export interface TaskInstanceRecord {
  id: string;
  type: TaskTemplateType;
  templateId: string | null;
  sourceTemplateItemId: string | null;
  sourceType: "generated" | "manual" | "override";
  generationKey: string | null;
  occurrenceDate: string;
  startAt: string;
  endAt: string;
  content: string;
  metadata: Record<string, unknown>;
  status: TaskInstanceStatus;
  generatedAt: string;
  updatedAt: string;
}

export interface TaskInstanceInput {
  type: TaskTemplateType;
  startAt: string;
  endAt: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface TaskInstanceGenerationInput {
  windowStartDate: string;
  windowEndDate: string;
  types?: TaskTemplateType[];
  templateIds?: string[];
  refreshPending?: boolean;
}

export interface TaskInstanceGenerationResult {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface PatrolCycleItemRecord {
  id: string;
  templateId: string;
  cycleDay: number;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  content: string;
  sortOrder: number;
}

export interface PatrolPlanRecord {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "infinite";
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled: boolean;
  cycleLength: number;
}

export interface PatrolPlanDetail extends PatrolPlanRecord {
  items: PatrolCycleItemRecord[];
}

export interface PatrolPlanInput {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  recurrenceType: "once" | "infinite";
  skipWeekends: boolean;
  skipHolidays: boolean;
  enabled?: boolean;
}

export interface PatrolCycleItemInput {
  cycleDay: number;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  sortOrder: number;
  content?: string;
}

export interface BoardUpdateConnectionHandlers {
  onOpen: () => void;
  onError: () => void;
}

interface ApiIssue {
  path?: Array<string | number>;
  message?: string;
}

interface ApiErrorBody {
  error?: string;
  message?: string;
  issues?: ApiIssue[];
}

async function throwApiError(response: Response, fallback: string): Promise<never> {
  let body: ApiErrorBody | null = null;
  try {
    const parsed = (await response.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as ApiErrorBody;
  } catch {
    body = null;
  }

  const issueDetails =
    body?.issues
      ?.map((issue) => {
        const path = issue.path?.join(".");
        return [path, issue.message].filter(Boolean).join(": ");
      })
      .filter(Boolean) ?? [];
  const details = [body?.error, body?.message, ...issueDetails].filter(Boolean);
  throw new Error(details.length > 0 ? details.join(": ") : `${fallback}: ${response.status}`);
}

async function postAdmin<TInput extends object>(path: string, input: TInput): Promise<{ id: string }> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) await throwApiError(response, "Admin request failed");
  return response.json();
}

async function postAdminFor<TInput extends object, TOutput>(path: string, input: TInput): Promise<TOutput> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) await throwApiError(response, "Admin request failed");
  return response.json();
}

async function fetchAdmin<TOutput>(path: string): Promise<TOutput> {
  const response = await fetch(`${apiBase}/api/admin/${path}`);
  if (!response.ok) await throwApiError(response, "Admin request failed");
  return response.json();
}

async function putAdmin<TInput extends object>(path: string, input: TInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) await throwApiError(response, "Admin request failed");
}

async function patchAdmin<TInput extends object>(path: string, input: TInput): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) await throwApiError(response, "Admin request failed");
}

async function deleteAdmin(path: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/admin/${path}`, { method: "DELETE" });
  if (!response.ok) await throwApiError(response, "Admin request failed");
}

export async function fetchBoard(): Promise<BoardSnapshot> {
  const response = await fetch(`${apiBase}/api/board`);
  if (!response.ok) await throwApiError(response, "Board fetch failed");
  return response.json();
}

function arrangementListPath(path: string, date: string, scope: ListScope = "date"): string {
  const params = new URLSearchParams({ scope });
  if (scope === "date") params.set("date", date);
  return `${path}?${params.toString()}`;
}

export async function fetchPermitArrangements(date: string, scope: ListScope = "date"): Promise<PermitArrangementRecord[]> {
  return fetchAdmin(arrangementListPath("permit-arrangements", date, scope));
}

export async function createPermit(input: {
  date: string;
  timeTag: TimeTag;
  target: string;
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
}): Promise<{ id: string }> {
  return postAdmin("permit-arrangements", input);
}

export async function updatePermitArrangement(
  id: string,
  input: Omit<PermitArrangementRecord, "id" | "enabled" | "startAt" | "endAt">
): Promise<void> {
  return putAdmin(`permit-arrangements/${encodeURIComponent(id)}`, input);
}

export async function updatePermitArrangementEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`permit-arrangements/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deletePermitArrangement(id: string): Promise<void> {
  return deleteAdmin(`permit-arrangements/${encodeURIComponent(id)}`);
}

export async function fetchOtherArrangements(date: string, scope: ListScope = "date"): Promise<OtherArrangementRecord[]> {
  return fetchAdmin(arrangementListPath("other-arrangements", date, scope));
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

export async function updateOtherArrangement(
  id: string,
  input: Omit<OtherArrangementRecord, "id" | "enabled" | "startAt" | "endAt">
): Promise<void> {
  return putAdmin(`other-arrangements/${encodeURIComponent(id)}`, input);
}

export async function updateOtherArrangementEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`other-arrangements/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deleteOtherArrangement(id: string): Promise<void> {
  return deleteAdmin(`other-arrangements/${encodeURIComponent(id)}`);
}

export async function createLeavePerson(input: { date: string; name: string }): Promise<{ id: string }> {
  return postAdmin("leave-people", input);
}

export async function fetchLeavePeople(date: string, scope: ListScope = "date"): Promise<LeavePersonRecord[]> {
  return fetchAdmin(arrangementListPath("leave-people", date, scope));
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

  if (!response.ok) await throwApiError(response, "Admin request failed");
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

export async function createOperationPlanItem(planId: string, input: OperationPlanItemInput): Promise<{ id: string }> {
  return postAdmin(`operation-plans/${encodeURIComponent(planId)}/items`, input);
}

export async function updateOperationPlanItem(planId: string, itemId: string, input: OperationPlanItemInput): Promise<void> {
  return putAdmin(`operation-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`, input);
}

export async function deleteOperationPlanItem(planId: string, itemId: string): Promise<void> {
  return deleteAdmin(`operation-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`);
}

export async function fetchTaskInstances(date: string, type?: TaskTemplateType, scope: ListScope = "date"): Promise<TaskInstanceRecord[]> {
  const params = new URLSearchParams({ scope });
  if (scope === "date") params.set("date", date);
  if (type) params.set("type", type);
  return fetchAdmin(`task-instances?${params.toString()}`);
}

export async function createTaskInstance(input: TaskInstanceInput): Promise<TaskInstanceRecord> {
  return postAdminFor("task-instances", input);
}

export async function updateTaskInstance(id: string, input: TaskInstanceInput): Promise<void> {
  return putAdmin(`task-instances/${encodeURIComponent(id)}`, input);
}

export async function updateTaskInstanceStatus(id: string, status: TaskInstanceStatus): Promise<void> {
  return patchAdmin(`task-instances/${encodeURIComponent(id)}/status`, { status });
}

export async function deleteTaskInstance(id: string): Promise<void> {
  return deleteAdmin(`task-instances/${encodeURIComponent(id)}`);
}

export async function generateTaskInstances(input: TaskInstanceGenerationInput): Promise<TaskInstanceGenerationResult> {
  return postAdminFor("task-instances/generate", input);
}

export async function fetchPatrolPlans(): Promise<PatrolPlanRecord[]> {
  return fetchAdmin("patrol-plans");
}

export async function fetchPatrolPlan(id: string): Promise<PatrolPlanDetail> {
  return fetchAdmin(`patrol-plans/${encodeURIComponent(id)}`);
}

export async function createPatrolPlan(input: PatrolPlanInput): Promise<{ id: string }> {
  return postAdmin("patrol-plans", input);
}

export async function updatePatrolPlan(id: string, input: PatrolPlanInput): Promise<void> {
  return putAdmin(`patrol-plans/${encodeURIComponent(id)}`, input);
}

export async function updatePatrolPlanEnabled(id: string, enabled: boolean): Promise<void> {
  return patchAdmin(`patrol-plans/${encodeURIComponent(id)}/enabled`, { enabled });
}

export async function deletePatrolPlan(id: string): Promise<void> {
  return deleteAdmin(`patrol-plans/${encodeURIComponent(id)}`);
}

export async function createPatrolPlanItem(planId: string, input: PatrolCycleItemInput): Promise<{ id: string }> {
  return postAdmin(`patrol-plans/${encodeURIComponent(planId)}/items`, input);
}

export async function updatePatrolPlanItem(planId: string, itemId: string, input: PatrolCycleItemInput): Promise<void> {
  return putAdmin(`patrol-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`, input);
}

export async function deletePatrolPlanItem(planId: string, itemId: string): Promise<void> {
  return deleteAdmin(`patrol-plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}`);
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
