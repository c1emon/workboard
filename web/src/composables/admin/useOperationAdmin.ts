import { computed, reactive, ref } from "vue";
import {
  createOperationPlan,
  createTaskItem,
  deleteOperationPlan,
  deleteTaskItem,
  fetchOperationPlan,
  fetchOperationPlans,
  type OperationPlanInput,
  type OperationPlanItemRecord,
  type OperationPlanRecord,
  updateOperationPlan,
  updateOperationPlanEnabled
} from "../../api/client";
import type { OperationAdminContext, OperationItemModalMode, OperationModalMode, RecurrenceType } from "./types";

const OPERATION_DETAIL_LOADING_MIN_MS = 300;

export function useOperationAdmin(context: OperationAdminContext) {
  const { selectedDate, today, withStatus, refresh, requestConfirmation } = context;
  const operationRows = ref<OperationPlanRecord[]>([]);
  const operationDetailItems = ref<OperationPlanItemRecord[]>([]);
  const operationSelectedItemId = ref<string | null>(null);
  const operationShowAll = ref(false);
  const operationModalOpen = ref(false);
  const operationModalMode = ref<OperationModalMode>("create");
  const operationRecordId = ref<string | null>(null);
  const operationItemModalOpen = ref(false);
  const operationItemModalMode = ref<OperationItemModalMode>("edit");
  const operationDetailLoading = ref(false);
  const operationReadOnly = computed(() => operationModalMode.value === "detail");
  const operationModalTitle = computed(() => {
    if (operationModalMode.value === "detail") return "详情计划";
    return `${operationModalMode.value === "edit" ? "修改" : "新增"}计划`;
  });
  const operationItemModalTitle = computed(() => {
    if (operationReadOnly.value) return "子任务详情";
    return operationItemModalMode.value === "create" ? "新增子任务" : "编辑子任务";
  });

  const operationForm = reactive({
    name: "操作",
    description: "操作安排",
    startAt: `${today}T08:00`,
    endAt: `${today}T20:00`,
    recurrenceType: "once" as RecurrenceType,
    recurrenceIntervalMinutes: 1440,
    recurrenceCount: 7,
    skipWeekends: false,
    skipHolidays: false
  });

  const operationItemForm = reactive({
    id: "",
    baseItemId: "",
    offsetHours: 0,
    offsetMinutes: 0,
    durationHours: 1,
    durationMinutes: 60,
    content: "",
    metadataJson: "{}",
    metadataExpanded: false,
    sortOrder: 0
  });

  const operationStoredDurationMinutes = computed(() => {
    const start = new Date(normalizeDateTime(operationForm.startAt)).getTime();
    const end = new Date(normalizeDateTime(operationForm.endAt)).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
    return Math.max(1, Math.floor((end - start) / 60_000));
  });
  const operationCycleDurationMinutes = computed(() => cycleDurationForItems(operationDetailItems.value));
  const operationDurationMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationHasEndAt = computed(() => operationForm.recurrenceType !== "infinite");
  const operationDerivedRecurrenceIntervalMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationDerivedRecurrenceCount = computed(() => recurrenceCountForItems(operationDetailItems.value));
  const operationComputedEndAt = computed(() => computedEndAtForItems(operationDetailItems.value));
  const operationItemBaseOptions = computed(() =>
    operationDetailItems.value
      .filter((item) => item.id !== operationItemForm.id)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes)
  );

  async function loadOperationRows(): Promise<void> {
    operationRows.value = await fetchOperationPlans(selectedDate.value, operationShowAll.value ? "all" : "date");
  }

  function normalizeDateTime(value: string): string {
    return value.length === 16 ? `${value}:00+08:00` : value;
  }

  function toDateTimeLocal(value: string): string {
    return value.slice(0, 16);
  }

  function nonNegativeInteger(value: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function integerValue(value: number): number {
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  function setOperationItemOffset(totalMinutes: number): void {
    const safeTotal = integerValue(totalMinutes);
    operationItemForm.offsetHours = Math.trunc(safeTotal / 60);
    operationItemForm.offsetMinutes = safeTotal - operationItemForm.offsetHours * 60;
  }

  function normalizeOperationItemOffset(): void {
    const totalMinutes = integerValue(Number(operationItemForm.offsetHours)) * 60 + integerValue(Number(operationItemForm.offsetMinutes));
    setOperationItemOffset(totalMinutes);
  }

  function operationItemOffsetTotalMinutes(): number {
    return integerValue(Number(operationItemForm.offsetHours)) * 60 + integerValue(Number(operationItemForm.offsetMinutes));
  }

  function setOperationItemDuration(totalMinutes: number): void {
    const safeTotal = nonNegativeInteger(totalMinutes);
    operationItemForm.durationHours = Math.floor(safeTotal / 60);
    operationItemForm.durationMinutes = safeTotal % 60;
  }

  function normalizeOperationItemDuration(): void {
    const totalMinutes = nonNegativeInteger(Number(operationItemForm.durationHours)) * 60 + nonNegativeInteger(Number(operationItemForm.durationMinutes));
    setOperationItemDuration(totalMinutes);
  }

  function operationItemDurationTotalMinutes(): number {
    return nonNegativeInteger(Number(operationItemForm.durationHours)) * 60 + nonNegativeInteger(Number(operationItemForm.durationMinutes));
  }

  function operationItemBaseEndMinutes(): number {
    const baseItem = operationDetailItems.value.find((item) => item.id === operationItemForm.baseItemId);
    return baseItem ? baseItem.offsetMinutes + baseItem.durationMinutes : 0;
  }

  function operationItemAbsoluteOffsetMinutes(): number {
    return operationItemBaseEndMinutes() + operationItemOffsetTotalMinutes();
  }

  function syncOperationItemMetadataOpen(event: Event): void {
    operationItemForm.metadataExpanded = (event.target as HTMLDetailsElement).open;
  }

  function addMinutesToDateTimeLocal(value: string, minutes: number): string {
    const start = new Date(normalizeDateTime(value)).getTime();
    if (Number.isNaN(start)) return value;
    const shifted = new Date(start + Math.max(1, Math.round(minutes)) * 60_000 + 8 * 60 * 60_000);
    return shifted.toISOString().slice(0, 16);
  }

  function waitForOperationDetailLoadingMinimum(startedAt: number): Promise<void> {
    const elapsed = Date.now() - startedAt;
    const remaining = OPERATION_DETAIL_LOADING_MIN_MS - elapsed;
    if (remaining <= 0) return Promise.resolve();
    return new Promise((resolve) => globalThis.setTimeout(resolve, remaining));
  }

  function cycleDurationForItems(items: OperationPlanItemRecord[]): number {
    const latestItemEnd = items.reduce((latest, item) => Math.max(latest, item.offsetMinutes + item.durationMinutes), 0);
    return Math.max(1, latestItemEnd || operationStoredDurationMinutes.value);
  }

  function recurrenceCountForItems(items: OperationPlanItemRecord[]): number {
    return Math.max(1, Math.ceil(operationStoredDurationMinutes.value / cycleDurationForItems(items)));
  }

  function computedEndAtForItems(items: OperationPlanItemRecord[]): string {
    const cycleDuration = cycleDurationForItems(items);
    const totalDuration = operationForm.recurrenceType === "finite" ? cycleDuration * recurrenceCountForItems(items) : cycleDuration;
    return addMinutesToDateTimeLocal(operationForm.startAt, totalDuration);
  }

  function recurrencePayloadForItems(form: { recurrenceType: RecurrenceType }, items: OperationPlanItemRecord[]) {
    return {
      recurrenceType: form.recurrenceType,
      recurrenceIntervalMinutes: form.recurrenceType === "once" ? null : cycleDurationForItems(items),
      recurrenceCount: form.recurrenceType === "finite" ? recurrenceCountForItems(items) : null
    };
  }

  function operationPayloadForItems(items: OperationPlanItemRecord[], item?: OperationPlanInput["item"]): OperationPlanInput {
    return {
      name: operationForm.name,
      description: operationForm.description,
      startAt: normalizeDateTime(operationForm.startAt),
      endAt: normalizeDateTime(computedEndAtForItems(items)),
      ...recurrencePayloadForItems(operationForm, items),
      skipWeekends: operationForm.skipWeekends,
      skipHolidays: operationForm.skipHolidays,
      ...(item ? { item } : {})
    };
  }

  function parseMetadata(value: string): Record<string, unknown> {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON 必须是对象");
    }
    return parsed as Record<string, unknown>;
  }

  function resetOperationForm(): void {
    operationForm.name = "操作";
    operationForm.description = "操作安排";
    operationForm.startAt = `${selectedDate.value || today}T08:00`;
    operationForm.endAt = `${selectedDate.value || today}T20:00`;
    operationForm.recurrenceType = "once";
    operationForm.recurrenceIntervalMinutes = 1440;
    operationForm.recurrenceCount = 7;
    operationForm.skipWeekends = false;
    operationForm.skipHolidays = false;
    operationDetailItems.value = [];
    operationSelectedItemId.value = null;
    resetOperationItemForm();
  }

  function resetOperationItemForm(): void {
    operationItemModalOpen.value = false;
    operationItemModalMode.value = "edit";
    operationItemForm.id = "";
    operationItemForm.baseItemId = "";
    setOperationItemOffset(0);
    setOperationItemDuration(60);
    operationItemForm.content = "";
    operationItemForm.metadataJson = "{}";
    operationItemForm.metadataExpanded = false;
    operationItemForm.sortOrder = 0;
  }

  async function openOperationModal(record?: OperationPlanRecord, mode?: OperationModalMode): Promise<void> {
    resetOperationForm();
    operationRecordId.value = record?.id ?? null;
    operationModalMode.value = mode ?? (record ? "edit" : "create");
    if (!record) {
      operationModalOpen.value = true;
      return;
    }

    operationDetailLoading.value = true;
    const loadingStartedAt = Date.now();
    await withStatus(async () => {
      let shouldOpenModal = false;
      try {
        const detail = await fetchOperationPlan(record.id);
        const firstItem = detail.items[0];
        operationDetailItems.value = detail.items;
        operationSelectedItemId.value = firstItem?.id ?? null;
        operationForm.name = detail.name;
        operationForm.description = detail.description;
        operationForm.startAt = toDateTimeLocal(detail.startAt);
        operationForm.endAt = toDateTimeLocal(detail.endAt);
        operationForm.recurrenceType = detail.recurrenceType;
        operationForm.recurrenceIntervalMinutes = detail.recurrenceIntervalMinutes ?? 1440;
        operationForm.recurrenceCount = detail.recurrenceCount ?? 7;
        operationForm.skipWeekends = detail.skipWeekends;
        operationForm.skipHolidays = detail.skipHolidays;
        shouldOpenModal = true;
      } finally {
        await waitForOperationDetailLoadingMinimum(loadingStartedAt);
        operationDetailLoading.value = false;
        if (shouldOpenModal) operationModalOpen.value = true;
      }
    });
  }

  function selectOperationItem(item: OperationPlanItemRecord): void {
    operationSelectedItemId.value = item.id;
    operationItemModalMode.value = "edit";
    operationItemForm.id = item.id;
    operationItemForm.baseItemId = "";
    setOperationItemOffset(item.offsetMinutes);
    setOperationItemDuration(item.durationMinutes);
    operationItemForm.content = item.content;
    operationItemForm.metadataJson = JSON.stringify(item.metadata, null, 2);
    operationItemForm.metadataExpanded = false;
    operationItemForm.sortOrder = item.sortOrder;
    operationItemModalOpen.value = true;
  }

  function openOperationItemCreate(): void {
    if (operationReadOnly.value || !operationRecordId.value) return;
    operationSelectedItemId.value = null;
    operationItemModalMode.value = "create";
    operationItemForm.id = "";
    operationItemForm.baseItemId = "";
    setOperationItemOffset(0);
    setOperationItemDuration(60);
    operationItemForm.content = "";
    operationItemForm.metadataJson = "{}";
    operationItemForm.metadataExpanded = false;
    operationItemForm.sortOrder = operationDetailItems.value.length;
    operationItemModalOpen.value = true;
  }

  function closeOperationModal(): void {
    operationModalOpen.value = false;
    operationModalMode.value = "create";
    operationRecordId.value = null;
    operationDetailLoading.value = false;
    operationDetailItems.value = [];
    operationSelectedItemId.value = null;
    resetOperationItemForm();
  }

  function closeOperationItemModal(): void {
    operationItemModalOpen.value = false;
  }

  async function toggleOperation(record: OperationPlanRecord): Promise<void> {
    await withStatus(async () => {
      await updateOperationPlanEnabled(record.id, !record.enabled);
      await refresh();
    });
  }

  async function removeOperation(id: string): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除操作计划",
      message: "确认删除这个操作计划吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deleteOperationPlan(id);
      await refresh();
    });
  }

  async function saveOperation(): Promise<void> {
    if (operationReadOnly.value) return;
    await withStatus(async () => {
      const payload = operationPayloadForItems(operationDetailItems.value);
      if (operationRecordId.value) await updateOperationPlan(operationRecordId.value, payload);
      else await createOperationPlan(payload);
      closeOperationModal();
      await refresh();
    });
  }

  async function saveOperationItem(): Promise<void> {
    if (operationReadOnly.value || !operationRecordId.value) return;
    const recordId = operationRecordId.value;
    await withStatus(async () => {
      const itemMetadata = parseMetadata(operationItemForm.metadataJson);
      const itemPayload = {
        offsetMinutes: operationItemAbsoluteOffsetMinutes(),
        durationMinutes: operationItemDurationTotalMinutes(),
        content: operationItemForm.content,
        metadata: itemMetadata,
        sortOrder: operationItemForm.sortOrder
      };
      if (operationItemModalMode.value === "create") {
        const draftItem = { id: "", ...itemPayload };
        const nextItems = [...operationDetailItems.value, draftItem].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes
        );
        await updateOperationPlan(recordId, operationPayloadForItems(nextItems));
        const created = await createTaskItem({
          containerId: recordId,
          ...itemPayload,
          target: "",
          personnel: "",
          vehicle: "",
          other: ""
        });
        const newItem = { id: created.id, ...itemPayload };
        operationDetailItems.value = nextItems.map((item) => (item.id ? item : newItem));
        closeOperationItemModal();
        await refresh();
        return;
      }

      if (!operationItemForm.id) return;
      const updatedItem = {
        id: operationItemForm.id,
        ...itemPayload
      };
      const nextItems = operationDetailItems.value.map((item) => (item.id === operationItemForm.id ? { ...item, ...updatedItem } : item));
      const payload = operationPayloadForItems(nextItems, updatedItem);
      await updateOperationPlan(recordId, payload);
      operationDetailItems.value = nextItems;
      closeOperationItemModal();
      await refresh();
    });
  }

  async function removeOperationItem(): Promise<void> {
    if (operationReadOnly.value || operationItemModalMode.value !== "edit" || !operationRecordId.value || !operationItemForm.id) return;
    const confirmed = await requestConfirmation({
      title: "删除子任务",
      message: "确认删除这个子任务吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;

    const recordId = operationRecordId.value;
    const itemId = operationItemForm.id;
    await withStatus(async () => {
      await deleteTaskItem(itemId);
      const nextItems = operationDetailItems.value.filter((item) => item.id !== itemId);
      await updateOperationPlan(recordId, operationPayloadForItems(nextItems));
      operationDetailItems.value = nextItems;
      operationSelectedItemId.value = null;
      closeOperationItemModal();
      await refresh();
    });
  }

  return {
    operationRows,
    operationDetailItems,
    operationSelectedItemId,
    operationShowAll,
    operationModalOpen,
    operationModalMode,
    operationRecordId,
    operationItemModalOpen,
    operationItemModalMode,
    operationDetailLoading,
    operationReadOnly,
    operationModalTitle,
    operationItemModalTitle,
    operationForm,
    operationItemForm,
    operationDurationMinutes,
    operationHasEndAt,
    operationDerivedRecurrenceIntervalMinutes,
    operationDerivedRecurrenceCount,
    operationComputedEndAt,
    operationItemBaseOptions,
    loadOperationRows,
    openOperationModal,
    selectOperationItem,
    openOperationItemCreate,
    closeOperationModal,
    closeOperationItemModal,
    toggleOperation,
    removeOperation,
    saveOperation,
    saveOperationItem,
    removeOperationItem,
    normalizeOperationItemOffset,
    normalizeOperationItemDuration,
    syncOperationItemMetadataOpen
  };
}
