import { reactive, ref } from "vue";
import {
  createTaskInstance,
  deleteTaskInstance,
  fetchTaskInstances,
  generateTaskInstances,
  type TaskInstanceInput,
  type TaskInstanceRecord,
  updateTaskInstance,
  updateTaskInstanceStatus
} from "../../api/client";
import type { TaskInstanceAdminContext } from "./types";

export interface TaskInstanceForm {
  type: TaskInstanceRecord["type"];
  startAt: string;
  endAt: string;
  content: string;
  metadataJson: string;
}

export function useTaskInstanceAdmin(context: TaskInstanceAdminContext) {
  const { selectedDate, today, withStatus, refresh, requestConfirmation } = context;
  const taskInstanceRows = ref<TaskInstanceRecord[]>([]);
  const taskInstanceFormOpen = ref(false);
  const taskInstanceEditingId = ref<string | null>(null);
  const taskInstanceGenerationSummary = ref("");
  const taskInstanceForm = reactive<TaskInstanceForm>({
    type: "patrol",
    startAt: `${today}T08:00:00+08:00`,
    endAt: `${today}T12:00:00+08:00`,
    content: "",
    metadataJson: "{}"
  });

  async function loadTaskInstanceRows(): Promise<void> {
    taskInstanceRows.value = await fetchTaskInstances(selectedDate.value, "patrol");
  }

  function openTaskInstanceCreate(): void {
    taskInstanceEditingId.value = null;
    taskInstanceFormOpen.value = true;
    taskInstanceForm.type = "patrol";
    taskInstanceForm.startAt = `${selectedDate.value || today}T08:00:00+08:00`;
    taskInstanceForm.endAt = `${selectedDate.value || today}T12:00:00+08:00`;
    taskInstanceForm.content = "";
    taskInstanceForm.metadataJson = "{}";
  }

  function openTaskInstanceEdit(record: TaskInstanceRecord): void {
    taskInstanceEditingId.value = record.id;
    taskInstanceFormOpen.value = true;
    taskInstanceForm.type = record.type;
    taskInstanceForm.startAt = record.startAt;
    taskInstanceForm.endAt = record.endAt;
    taskInstanceForm.content = record.content;
    taskInstanceForm.metadataJson = JSON.stringify(record.metadata, null, 2);
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

  async function regenerateTaskInstances(): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "重新生成实例",
      message: `将刷新 ${selectedDate.value} 的待处理生成实例。`,
      detail: "已完成、进行中、取消或手动实例不会被覆盖。",
      confirmLabel: "重新生成"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      const result = await generateTaskInstances({
        windowStartDate: selectedDate.value,
        windowEndDate: selectedDate.value,
        types: ["patrol"],
        refreshPending: true
      });
      taskInstanceGenerationSummary.value = `新增 ${result.inserted}，更新 ${result.updated}，跳过 ${result.skipped}`;
      await refresh();
    });
  }

  function taskInstancePayload(): TaskInstanceInput {
    return {
      type: taskInstanceForm.type,
      startAt: taskInstanceForm.startAt,
      endAt: taskInstanceForm.endAt,
      content: taskInstanceForm.content,
      metadata: parseMetadata(taskInstanceForm.metadataJson)
    };
  }

  return {
    taskInstanceRows,
    taskInstanceForm,
    taskInstanceFormOpen,
    taskInstanceEditingId,
    taskInstanceGenerationSummary,
    loadTaskInstanceRows,
    openTaskInstanceCreate,
    openTaskInstanceEdit,
    closeTaskInstanceForm,
    saveTaskInstance,
    cancelTaskInstance,
    removeTaskInstance,
    regenerateTaskInstances
  };
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function toChinaDate(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
