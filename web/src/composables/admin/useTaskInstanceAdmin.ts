import { reactive, ref, watch } from "vue";
import {
  createTaskInstance,
  deleteTaskInstance,
  fetchTaskInstances,
  generateTaskInstances,
  type PatrolPlanRecord,
  type TaskInstanceInput,
  type TaskInstanceRecord,
  updateTaskInstance,
  updateTaskInstanceStatus
} from "../../api/client";
import type { TaskInstanceAdminContext } from "./types";

export interface TaskInstanceForm {
  date: string;
  timeTag: "全天" | "上午" | "下午";
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
}

export interface TaskInstanceRefreshForm {
  templateId: string;
  windowStartDate: string;
  windowEndDate: string;
}

export function useTaskInstanceAdmin(context: TaskInstanceAdminContext) {
  const { selectedDate, today, withStatus, refresh, requestConfirmation } = context;
  const taskInstanceRows = ref<TaskInstanceRecord[]>([]);
  const taskInstanceShowAll = ref(false);
  const taskInstanceFormOpen = ref(false);
  const taskInstanceRefreshOpen = ref(false);
  const taskInstanceEditingId = ref<string | null>(null);
  const taskInstanceGenerationSummary = ref("");
  const taskInstanceForm = reactive<TaskInstanceForm>({
    date: today,
    timeTag: "上午",
    target: "",
    personnel: "",
    vehicle: "",
    other: ""
  });
  const taskInstanceRefreshForm = reactive<TaskInstanceRefreshForm>({
    templateId: "",
    windowStartDate: selectedDate.value,
    windowEndDate: selectedDate.value
  });

  watch(selectedDate, (date) => {
    if (!taskInstanceRefreshOpen.value) resetRefreshForm(date);
  });

  async function loadTaskInstanceRows(): Promise<void> {
    taskInstanceRows.value = await fetchTaskInstances(selectedDate.value, "patrol", taskInstanceShowAll.value ? "all" : "date");
  }

  function openTaskInstanceCreate(): void {
    taskInstanceEditingId.value = null;
    taskInstanceFormOpen.value = true;
    resetTaskInstanceForm();
  }

  function openTaskInstanceEdit(record: TaskInstanceRecord): void {
    taskInstanceEditingId.value = record.id;
    taskInstanceFormOpen.value = true;
    taskInstanceForm.timeTag = metadataTimeTag(record.metadata) ?? timeTagFromRange(record.startAt, record.endAt);
    taskInstanceForm.date = toChinaDate(record.startAt);
    taskInstanceForm.target = metadataString(record.metadata, "target") || record.content;
    taskInstanceForm.personnel = metadataString(record.metadata, "personnel");
    taskInstanceForm.vehicle = metadataString(record.metadata, "vehicle");
    taskInstanceForm.other = metadataString(record.metadata, "other");
  }

  function closeTaskInstanceForm(): void {
    taskInstanceFormOpen.value = false;
    taskInstanceEditingId.value = null;
  }

  async function saveTaskInstance(): Promise<void> {
    const payload = taskInstancePayload();
    await withStatus(async () => {
      if (taskInstanceEditingId.value) await updateTaskInstance(taskInstanceEditingId.value, payload);
      else await createTaskInstance(payload);
      closeTaskInstanceForm();
      selectedDate.value = toChinaDate(payload.startAt);
      await refresh();
    });
  }

  async function cancelTaskInstance(record: TaskInstanceRecord): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "取消实例",
      message: `确认取消「${record.content || record.id}」吗？`,
      confirmLabel: "取消实例"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await updateTaskInstanceStatus(record.id, "cancelled");
      await refresh();
    });
  }

  async function removeTaskInstance(record: TaskInstanceRecord): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除实例",
      message: `确认删除「${record.content || record.id}」吗？`,
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deleteTaskInstance(record.id);
      await refresh();
    });
  }

  function openTaskInstanceRefresh(): void {
    resetRefreshForm(selectedDate.value || today);
    taskInstanceRefreshOpen.value = true;
  }

  function closeTaskInstanceRefresh(): void {
    taskInstanceRefreshOpen.value = false;
  }

  async function refreshTaskInstances(plans: PatrolPlanRecord[]): Promise<void> {
    const windowEndDate = refreshWindowEndDate();
    const plan = plans.find((row) => row.id === taskInstanceRefreshForm.templateId);
    const scopeText = plan ? `模板「${plan.name}」` : "全部巡视模板";
    const confirmed = await requestConfirmation({
      title: "刷新实例",
      message: `将刷新 ${scopeText} 在 ${taskInstanceRefreshForm.windowStartDate} 至 ${windowEndDate} 的待处理生成实例。`,
      detail: "已完成、进行中、取消或手动实例不会被覆盖。",
      confirmLabel: "执行刷新"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      const result = await generateTaskInstances({
        windowStartDate: taskInstanceRefreshForm.windowStartDate,
        windowEndDate,
        types: ["patrol"],
        templateIds: taskInstanceRefreshForm.templateId ? [taskInstanceRefreshForm.templateId] : undefined,
        refreshPending: true
      });
      taskInstanceGenerationSummary.value = `新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`;
      closeTaskInstanceRefresh();
      await refresh();
    });
  }

  function taskInstancePayload(): TaskInstanceInput {
    const { startAt, endAt } = timeRangeForDateTag(taskInstanceForm.date || selectedDate.value || today, taskInstanceForm.timeTag);
    return {
      type: "patrol",
      startAt,
      endAt,
      content: taskInstanceForm.target,
      metadata: {
        timeTag: taskInstanceForm.timeTag,
        target: taskInstanceForm.target,
        personnel: taskInstanceForm.personnel,
        vehicle: taskInstanceForm.vehicle,
        other: taskInstanceForm.other
      }
    };
  }

  function resetTaskInstanceForm(): void {
    taskInstanceForm.date = selectedDate.value || today;
    taskInstanceForm.timeTag = "上午";
    taskInstanceForm.target = "";
    taskInstanceForm.personnel = "";
    taskInstanceForm.vehicle = "";
    taskInstanceForm.other = "";
  }

  function resetRefreshForm(date: string): void {
    taskInstanceRefreshForm.templateId = "";
    taskInstanceRefreshForm.windowStartDate = date;
    taskInstanceRefreshForm.windowEndDate = date;
  }

  function refreshWindowEndDate(): string {
    return taskInstanceRefreshForm.windowEndDate >= taskInstanceRefreshForm.windowStartDate
      ? taskInstanceRefreshForm.windowEndDate
      : taskInstanceRefreshForm.windowStartDate;
  }

  return {
    taskInstanceRows,
    taskInstanceShowAll,
    taskInstanceForm,
    taskInstanceFormOpen,
    taskInstanceRefreshForm,
    taskInstanceRefreshOpen,
    taskInstanceEditingId,
    taskInstanceGenerationSummary,
    loadTaskInstanceRows,
    openTaskInstanceCreate,
    openTaskInstanceEdit,
    closeTaskInstanceForm,
    saveTaskInstance,
    cancelTaskInstance,
    removeTaskInstance,
    openTaskInstanceRefresh,
    closeTaskInstanceRefresh,
    refreshTaskInstances
  };
}

function toChinaDate(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function timeRangeForDateTag(date: string, timeTag: TaskInstanceForm["timeTag"]): { startAt: string; endAt: string } {
  if (timeTag === "全天") return { startAt: `${date}T00:00:00+08:00`, endAt: `${date}T23:59:59+08:00` };
  if (timeTag === "下午") return { startAt: `${date}T12:00:00+08:00`, endAt: `${date}T17:00:00+08:00` };
  return { startAt: `${date}T08:00:00+08:00`, endAt: `${date}T12:00:00+08:00` };
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function metadataTimeTag(metadata: Record<string, unknown>): TaskInstanceForm["timeTag"] | null {
  const value = metadata.timeTag;
  return value === "全天" || value === "上午" || value === "下午" ? value : null;
}

function timeTagFromRange(startAt: string, endAt: string): TaskInstanceForm["timeTag"] {
  if (startAt.includes("T00:00:00") && endAt.includes("T23:59:59")) return "全天";
  if (startAt.includes("T12:00:00") && endAt.includes("T17:00:00")) return "下午";
  return "上午";
}
