import { reactive, ref } from "vue";
import {
  createPatrolPlan,
  createPatrolPlanItem,
  deletePatrolPlan,
  deletePatrolPlanItem,
  fetchPatrolPlan,
  fetchPatrolPlans,
  type PatrolCycleItemInput,
  type PatrolCycleItemRecord,
  type PatrolPlanDetail,
  type PatrolPlanInput,
  type PatrolPlanRecord,
  updatePatrolPlan,
  updatePatrolPlanEnabled,
  updatePatrolPlanItem
} from "../../api/client";
import type { TimeTag } from "../../api/types";
import type { PatrolPlanAdminContext } from "./types";

export interface PatrolPlanForm {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  skipWeekends: boolean;
  skipHolidays: boolean;
}

export interface PatrolCycleItemForm {
  cycleDay: number;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  sortOrder: number;
}

export function usePatrolPlanAdmin(context: PatrolPlanAdminContext) {
  const { withStatus, refresh, requestConfirmation } = context;
  const patrolPlanRows = ref<PatrolPlanRecord[]>([]);
  const patrolPlanDetail = ref<PatrolPlanDetail | null>(null);
  const patrolPlanDetailOpen = ref(false);
  const patrolCycleItemManagerOpen = ref(false);
  const patrolCycleItemFormOpen = ref(false);
  const patrolPlanEditingId = ref<string | null>(null);
  const patrolPlanFormOpen = ref(false);
  const patrolCycleItemEditingId = ref<string | null>(null);
  const patrolPlanForm = reactive<PatrolPlanForm>({
    name: "",
    description: "",
    startAt: "",
    endAt: "",
    skipWeekends: false,
    skipHolidays: true
  });
  const patrolCycleItemForm = reactive<PatrolCycleItemForm>({
    cycleDay: 1,
    timeTag: "上午",
    target: "",
    personnel: "",
    vehicle: "",
    other: "",
    sortOrder: 0
  });

  async function loadPatrolPlans(): Promise<void> {
    patrolPlanRows.value = await fetchPatrolPlans();
    if (patrolPlanDetail.value && patrolPlanRows.value.some((row) => row.id === patrolPlanDetail.value?.id)) {
      patrolPlanDetail.value = await fetchPatrolPlan(patrolPlanDetail.value.id);
    } else if (patrolPlanDetail.value) {
      patrolPlanDetail.value = null;
      patrolPlanDetailOpen.value = false;
    }
  }

  async function selectPatrolPlan(record: PatrolPlanRecord): Promise<void> {
    await withStatus(async () => {
      patrolPlanDetail.value = await fetchPatrolPlan(record.id);
      patrolPlanDetailOpen.value = true;
    });
  }

  async function openPatrolCycleItemManager(record: PatrolPlanRecord): Promise<void> {
    await withStatus(async () => {
      patrolPlanDetail.value = await fetchPatrolPlan(record.id);
      patrolCycleItemManagerOpen.value = true;
    });
  }

  function closePatrolPlanDetail(): void {
    patrolPlanDetailOpen.value = false;
  }

  function closePatrolCycleItemManager(): void {
    patrolCycleItemManagerOpen.value = false;
    closePatrolCycleItemForm();
  }

  function openPatrolPlanCreate(): void {
    patrolPlanEditingId.value = null;
    patrolPlanFormOpen.value = true;
    Object.assign(patrolPlanForm, {
      name: "",
      description: "",
      startAt: "",
      endAt: "",
      skipWeekends: false,
      skipHolidays: true
    });
  }

  function openPatrolPlanEdit(record: PatrolPlanRecord): void {
    patrolPlanEditingId.value = record.id;
    patrolPlanFormOpen.value = true;
    Object.assign(patrolPlanForm, {
      name: record.name,
      description: record.description,
      startAt: toDateInput(record.startAt),
      endAt: toDateInput(record.endAt),
      skipWeekends: record.skipWeekends,
      skipHolidays: record.skipHolidays
    });
  }

  function closePatrolPlanForm(): void {
    patrolPlanFormOpen.value = false;
    patrolPlanEditingId.value = null;
  }

  async function savePatrolPlan(): Promise<void> {
    const payload = patrolPlanPayload();
    await withStatus(async () => {
      if (patrolPlanEditingId.value) await updatePatrolPlan(patrolPlanEditingId.value, payload);
      else {
        const result = await createPatrolPlan(payload);
        patrolPlanDetail.value = await fetchPatrolPlan(result.id);
      }
      closePatrolPlanForm();
      await refresh();
    });
  }

  async function togglePatrolPlan(record: PatrolPlanRecord): Promise<void> {
    await withStatus(async () => {
      await updatePatrolPlanEnabled(record.id, !record.enabled);
      await refresh();
    });
  }

  async function removePatrolPlan(record: PatrolPlanRecord): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除巡视模板",
      message: `确认删除「${record.name}」吗？`,
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deletePatrolPlan(record.id);
      if (patrolPlanDetail.value?.id === record.id) patrolPlanDetail.value = null;
      await refresh();
    });
  }

  function openPatrolCycleItemCreate(): void {
    patrolCycleItemEditingId.value = null;
    patrolCycleItemFormOpen.value = true;
    Object.assign(patrolCycleItemForm, {
      cycleDay: 1,
      timeTag: "上午",
      target: "",
      personnel: "",
      vehicle: "",
      other: "",
      sortOrder: nextCycleItemSortOrder(1, "上午")
    });
  }

  function openPatrolCycleItemEdit(item: PatrolCycleItemRecord): void {
    patrolCycleItemEditingId.value = item.id;
    patrolCycleItemFormOpen.value = true;
    Object.assign(patrolCycleItemForm, {
      cycleDay: item.cycleDay,
      timeTag: item.timeTag,
      target: item.target,
      personnel: item.personnel,
      vehicle: item.vehicle,
      other: item.other,
      sortOrder: item.sortOrder
    });
  }

  function closePatrolCycleItemForm(): void {
    patrolCycleItemFormOpen.value = false;
    patrolCycleItemEditingId.value = null;
  }

  async function savePatrolCycleItem(): Promise<void> {
    if (!patrolPlanDetail.value) return;
    const planId = patrolPlanDetail.value.id;
    const payload = patrolCycleItemPayload();
    await withStatus(async () => {
      if (patrolCycleItemEditingId.value) await updatePatrolPlanItem(planId, patrolCycleItemEditingId.value, payload);
      else await createPatrolPlanItem(planId, payload);
      closePatrolCycleItemForm();
      patrolPlanDetail.value = await fetchPatrolPlan(planId);
      await refresh();
    });
  }

  async function removePatrolCycleItem(item: PatrolCycleItemRecord): Promise<void> {
    if (!patrolPlanDetail.value) return;
    const confirmed = await requestConfirmation({
      title: "删除周期项",
      message: `确认删除第 ${item.cycleDay} 天「${item.target}」吗？`,
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    const planId = patrolPlanDetail.value.id;
    await withStatus(async () => {
      await deletePatrolPlanItem(planId, item.id);
      patrolPlanDetail.value = await fetchPatrolPlan(planId);
      await refresh();
    });
  }

  function patrolPlanPayload(): PatrolPlanInput {
    return {
      name: patrolPlanForm.name,
      description: patrolPlanForm.description,
      startAt: `${patrolPlanForm.startAt}T00:00:00+08:00`,
      endAt: `${patrolPlanForm.endAt}T23:59:59+08:00`,
      skipWeekends: patrolPlanForm.skipWeekends,
      skipHolidays: patrolPlanForm.skipHolidays
    };
  }

  function patrolCycleItemPayload(): PatrolCycleItemInput {
    return {
      cycleDay: Number(patrolCycleItemForm.cycleDay) || 1,
      timeTag: patrolCycleItemForm.timeTag,
      target: patrolCycleItemForm.target,
      personnel: patrolCycleItemForm.personnel,
      vehicle: patrolCycleItemForm.vehicle,
      other: patrolCycleItemForm.other,
      sortOrder: patrolCycleItemEditingId.value
        ? Number(patrolCycleItemForm.sortOrder) || 0
        : nextCycleItemSortOrder(Number(patrolCycleItemForm.cycleDay) || 1, patrolCycleItemForm.timeTag)
    };
  }

  function nextCycleItemSortOrder(cycleDay: number, timeTag: TimeTag): number {
    const orders = patrolPlanDetail.value?.items
      .filter((item) => item.cycleDay === cycleDay && item.timeTag === timeTag)
      .map((item) => item.sortOrder) ?? [];
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

  return {
    patrolPlanRows,
    patrolPlanDetail,
    patrolPlanDetailOpen,
    patrolCycleItemManagerOpen,
    patrolPlanForm,
    patrolPlanFormOpen,
    patrolPlanEditingId,
    patrolCycleItemForm,
    patrolCycleItemFormOpen,
    patrolCycleItemEditingId,
    loadPatrolPlans,
    selectPatrolPlan,
    openPatrolCycleItemManager,
    closePatrolPlanDetail,
    closePatrolCycleItemManager,
    openPatrolPlanCreate,
    openPatrolPlanEdit,
    closePatrolPlanForm,
    savePatrolPlan,
    togglePatrolPlan,
    removePatrolPlan,
    openPatrolCycleItemCreate,
    openPatrolCycleItemEdit,
    closePatrolCycleItemForm,
    savePatrolCycleItem,
    removePatrolCycleItem
  };
}

function toDateInput(value: string): string {
  return value.slice(0, 10);
}
