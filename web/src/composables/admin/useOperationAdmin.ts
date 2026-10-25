import { computed, reactive, ref, watch } from "vue";
import {
	  createOperationPlan,
	  deleteOperationPlan,
	  deleteOperationPlanItem,
  fetchOperationPlan,
  fetchOperationPlans,
  fetchOperationBoardSelection, saveOperationBoardSelection, regenerateOperationPlan, PlanWriteError,
  type OperationBoardSelection, type OperationPlanDetailRecord,
  type OperationPlanInput,
  type OperationPlanItemRecord,
  type OperationPlanRecord,
  updateOperationPlan,
  updateOperationPlanEnabled
} from "../../api/client";
import type { OperationAdminContext, OperationItemModalMode, OperationModalMode, RecurrenceType } from "./types";

const OPERATION_DETAIL_LOADING_MIN_MS = 300;

export interface OperationRefreshForm {
  templateId: string;
  startItemId: string;
  startAt: string;
  cutoffAt: string;
}

export function useOperationAdmin(context: OperationAdminContext) {
  const { selectedDate, today, withStatus, refresh, requestConfirmation } = context;
  const operationRows = ref<OperationPlanRecord[]>([]);
  const operationDetailItems = ref<OperationPlanItemRecord[]>([]);
  const operationSelectedItemId = ref<string | null>(null);
  const operationShowAll = ref(false);
  const operationRefreshOpen = ref(false);
  const generationPlans = ref<OperationPlanRecord[]>([]);
  const generationPlan = ref<OperationPlanDetailRecord | null>(null);
  const generationLocked = ref(false);
  const generationLoading = ref(false);
  const generationBusy = ref(false);
  const generationStep = ref<'form' | 'confirm'>('form');
  const generationError = ref('');
  const boardSelection = ref<OperationBoardSelection | null>(null);
  const boardSelectionLoading = ref(true);
  const boardSelectionSavingId = ref<string | null>(null);
  const boardSelectionMessage = ref('');
  const operationWriteBusy = ref(false);
  let listVersion = 0, generationVersion = 0, detailVersion = 0;
  async function withOperationWrite(action: () => Promise<void>) {
    if (operationWriteBusy.value || generationBusy.value) return;
    operationWriteBusy.value = true;
    try { await withStatus(action); } finally { operationWriteBusy.value = false; }
  }
  const operationGenerationSummary = ref("");
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

  const operationRefreshForm = reactive<OperationRefreshForm>({
    templateId: "",
    startItemId: "",
    startAt: `${selectedDate.value}T08:00`,
    cutoffAt: ""
  });

  const operationItemForm = reactive({
    id: "",
    baseItemId: "",
    offsetHours: 0,
    offsetMinutes: 0,
    durationHours: 1,
    durationMinutes: 60,
    content: "",
    extData: {} as Record<string, unknown>,
    sortOrder: 0
  });

  const operationFiniteWindowMinutes = computed(() => {
    const start = new Date(normalizeDateTime(operationForm.startAt)).getTime();
    const end = new Date(normalizeDateTime(operationForm.endAt)).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
    return Math.max(1, Math.floor((end - start) / 60_000));
  });
  const operationCycleDurationMinutes = computed(() => cycleDurationForItems(operationDetailItems.value));
  const operationDurationMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationHasEndAt = computed(() => operationForm.recurrenceType === "finite");
  const operationDerivedRecurrenceIntervalMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationDerivedRecurrenceCount = computed(() => recurrenceCountForItems(operationDetailItems.value));
  const operationComputedEndAt = computed(() => computedEndAtForItems(operationDetailItems.value));
  const operationItemBaseOptions = computed(() =>
    operationDetailItems.value
      .filter((item) => item.id !== operationItemForm.id)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes)
  );

  watch(selectedDate, (date) => {
    if (!operationRefreshOpen.value) resetOperationRefreshForm(date);
  });

  async function loadOperationRows(): Promise<void> {
    const version = ++listVersion;
    const [rows, selection] = await Promise.all([
      fetchOperationPlans(selectedDate.value, operationShowAll.value ? 'all' : 'date'), fetchOperationBoardSelection().catch(error => {
        if (version === listVersion) { boardSelectionMessage.value = '读取大屏选择失败：' + (error instanceof Error ? error.message : '请重试'); boardSelectionLoading.value = false; }
        return null;
      })
    ]);
    if (version !== listVersion) return;
    operationRows.value = rows;
    if (!boardSelectionSavingId.value && selection) boardSelection.value = selection;
    boardSelectionLoading.value = false;
  }

  async function selectBoardPlan(planId: string) {
    if (boardSelectionSavingId.value || boardSelectionLoading.value) return;
    ++listVersion;
    boardSelectionSavingId.value = planId;
    boardSelectionMessage.value = '';
    try {
      const selection = await saveOperationBoardSelection(planId);
      boardSelection.value = selection;
      boardSelectionMessage.value = '已切换为「' + selection.name + '」，已通知大屏刷新';
    } catch (error) {
      if (error instanceof PlanWriteError && error.confirmedFailure) boardSelectionMessage.value = '切换失败：' + error.message;
      else {
        boardSelectionMessage.value = '切换结果未确认，请刷新查看';
        try { boardSelection.value = await fetchOperationBoardSelection(); } catch { /* Keep the saved selection visible. */ }
      }
    } finally { boardSelectionSavingId.value = null; }
  }

  async function openOperationRefresh(record?: OperationPlanRecord): Promise<void> {
    if (operationWriteBusy.value || generationBusy.value) return;
    resetOperationRefreshForm(selectedDate.value || today);
    generationLocked.value = !!record;
    generationPlan.value = null;
    generationPlans.value = [];
    generationStep.value = 'form';
    generationError.value = '';
    operationGenerationSummary.value = '';
    operationRefreshOpen.value = true;
    generationLoading.value = true;
    const version = ++generationVersion;
    try {
      const plans = await fetchOperationPlans(selectedDate.value, 'all');
      if (version !== generationVersion || !operationRefreshOpen.value) return;
      generationPlans.value = plans;
      if (record) { operationRefreshForm.templateId = record.id; await selectGenerationPlan(record.id); }
    } catch (error) {
      if (version === generationVersion) generationError.value = error instanceof Error ? error.message : '读取计划失败';
    } finally { if (version === generationVersion) generationLoading.value = false; }
  }

  async function selectGenerationPlan(id: string) {
    if (generationBusy.value) return;
    const version = ++generationVersion;
    operationRefreshForm.templateId = id;
    operationRefreshForm.startItemId = '';
    generationPlan.value = null;
    generationError.value = '';
    generationStep.value = 'form';
    if (!id) { generationLoading.value = false; return; }
    generationLoading.value = true;
    try {
      const plan = await fetchOperationPlan(id);
      if (version !== generationVersion || !operationRefreshOpen.value) return;
      generationPlan.value = plan;
      operationRefreshForm.startAt = `${selectedDate.value || today}T08:00`;
      const start = operationRefreshForm.startAt;
      if (plan.recurrenceType === 'once') operationRefreshForm.cutoffAt = addMinutesToDateTimeLocal(start, Math.max(1, ...plan.items.map((item) => item.offsetMinutes + item.durationMinutes)));
      else if (plan.recurrenceType === 'finite') operationRefreshForm.cutoffAt = Date.parse(plan.endAt) > Date.parse(normalizeDateTime(start)) ? plan.endAt.slice(0, 16) : '';
      else operationRefreshForm.cutoffAt = addMinutesToDateTimeLocal(start.slice(0, 10) + 'T00:00', 1440);
    } catch (error) { if (version === generationVersion) generationError.value = error instanceof Error ? error.message : '读取计划失败'; }
    finally { if (version === generationVersion) generationLoading.value = false; }
  }

  function closeOperationRefresh(): void {
    if (generationBusy.value) return;
    ++generationVersion;
    operationRefreshOpen.value = false;
    generationLoading.value = false;
  }

  const generationValidation = computed(() => {
    const plan = generationPlan.value;
    if (!plan) return '请选择计划';
    if (!plan.enabled) return '计划已禁用，请先启用';
    if (!plan.items.length) return '请先添加子任务';
    if (plan.recurrenceType !== 'once' && !operationRefreshForm.startItemId) return '请选择起始子任务';
    if (!operationRefreshForm.startAt) return '请填写开始时间';
    if (!operationRefreshForm.cutoffAt || Date.parse(normalizeDateTime(operationRefreshForm.cutoffAt)) <= Date.parse(normalizeDateTime(operationRefreshForm.startAt))) return '生成截止时间必须晚于开始时间';
    return '';
  });

  function confirmOperationGeneration() {
    if (!generationValidation.value && !generationLoading.value) { generationError.value = ''; generationStep.value = 'confirm'; }
  }

  async function refreshOperationInstances(): Promise<void> {
    const plan = generationPlan.value;
    if (!plan || generationBusy.value || generationValidation.value || generationStep.value !== 'confirm') return;
    generationBusy.value = true;
    generationError.value = '';
    try {
      const result = await regenerateOperationPlan(plan.id, { startAt: normalizeDateTime(operationRefreshForm.startAt), cutoffAt: normalizeDateTime(operationRefreshForm.cutoffAt),
        ...(plan.recurrenceType !== 'once' ? { startItemId: operationRefreshForm.startItemId } : {}) });
      operationGenerationSummary.value = '已重新生成「' + plan.name + '」：清理 ' + result.removed + ' 条，新增 ' + result.inserted + ' 条，跳过 ' + result.skipped + ' 条'
        + (result.inserted === 0 ? '；所选时间范围未产生可生成任务' : '');
      operationRefreshOpen.value = false;
      await refresh();
    } catch (error) {
      generationError.value = error instanceof PlanWriteError && error.confirmedFailure ? '生成失败，原安排已保留：' + error.message : '生成结果未确认，请刷新后检查';
    } finally { generationBusy.value = false; }
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
    return Math.max(1, latestItemEnd || operationFiniteWindowMinutes.value);
  }

  function recurrenceCountForItems(items: OperationPlanItemRecord[]): number {
    return Math.max(1, Math.ceil(operationFiniteWindowMinutes.value / cycleDurationForItems(items)));
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
      endAt: operationForm.recurrenceType === "finite" ? normalizeDateTime(operationForm.endAt) : null,
      ...recurrencePayloadForItems(operationForm, items),
      skipWeekends: operationForm.skipWeekends,
      skipHolidays: operationForm.skipHolidays,
      ...(item ? { item } : {})
    };
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

  function resetOperationRefreshForm(date: string): void {
    Object.assign(operationRefreshForm, { templateId: '', startItemId: '', startAt: date + 'T08:00', cutoffAt: '' });
  }

  function resetOperationItemForm(): void {
    operationItemModalOpen.value = false;
    operationItemModalMode.value = "edit";
    operationItemForm.id = "";
    operationItemForm.baseItemId = "";
    setOperationItemOffset(0);
    setOperationItemDuration(60);
    operationItemForm.content = "";
    operationItemForm.extData = {};
    operationItemForm.sortOrder = 0;
  }

  async function openOperationModal(record?: OperationPlanRecord, mode?: OperationModalMode): Promise<void> {
    if (operationWriteBusy.value || generationBusy.value) return;
    const version = ++detailVersion;
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
        if (version !== detailVersion) return;
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
        if (version === detailVersion) {
          operationDetailLoading.value = false;
          if (shouldOpenModal) operationModalOpen.value = true;
        }
      }
    });
  }

  function selectOperationItem(item: OperationPlanItemRecord): void {
    if (operationWriteBusy.value) return;
    operationSelectedItemId.value = item.id;
    operationItemModalMode.value = "edit";
    operationItemForm.id = item.id;
    operationItemForm.baseItemId = "";
    setOperationItemOffset(item.offsetMinutes);
    setOperationItemDuration(item.durationMinutes);
    operationItemForm.content = item.content;
    operationItemForm.extData = { ...item.extData };
    operationItemForm.sortOrder = item.sortOrder;
    operationItemModalOpen.value = true;
  }

  function openOperationItemCreate(): void {
    if (operationWriteBusy.value || operationReadOnly.value || !operationRecordId.value) return;
    operationSelectedItemId.value = null;
    operationItemModalMode.value = "create";
    operationItemForm.id = "";
    operationItemForm.baseItemId = "";
    setOperationItemOffset(0);
    setOperationItemDuration(60);
    operationItemForm.content = "";
    operationItemForm.extData = {};
    operationItemForm.sortOrder = operationDetailItems.value.length;
    operationItemModalOpen.value = true;
  }

  function closeOperationModal(force = false): void {
    if (operationWriteBusy.value && !force) return;
    ++detailVersion;
    operationModalOpen.value = false;
    operationModalMode.value = "create";
    operationRecordId.value = null;
    operationDetailLoading.value = false;
    operationDetailItems.value = [];
    operationSelectedItemId.value = null;
    resetOperationItemForm();
  }

  function closeOperationItemModal(force = false): void {
    if (operationWriteBusy.value && !force) return;
    operationItemModalOpen.value = false;
  }

  async function toggleOperation(record: OperationPlanRecord): Promise<void> {
    await withOperationWrite(async () => {
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
    await withOperationWrite(async () => {
      await deleteOperationPlan(id);
      await refresh();
    });
  }

  async function saveOperation(): Promise<void> {
    if (operationReadOnly.value) return;
    await withOperationWrite(async () => {
      const payload = operationPayloadForItems(operationDetailItems.value);
      if (operationRecordId.value) await updateOperationPlan(operationRecordId.value, payload);
      else await createOperationPlan(payload);
      closeOperationModal(true);
      await refresh();
    });
  }

  async function saveOperationItem(): Promise<void> {
    if (operationReadOnly.value || !operationRecordId.value) return;
    const recordId = operationRecordId.value;
    await withOperationWrite(async () => {
      const itemPayload = {
        offsetMinutes: operationItemAbsoluteOffsetMinutes(),
        durationMinutes: operationItemDurationTotalMinutes(),
        content: operationItemForm.content,
        extData: { ...operationItemForm.extData },
        sortOrder: operationItemForm.sortOrder
      };
      if (operationItemModalMode.value === "create") {
        const existingItemIds = new Set(operationDetailItems.value.map((item) => item.id));
        const draftItem = { id: "", ...itemPayload };
        const nextItems = [...operationDetailItems.value, draftItem].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes
        );
        await updateOperationPlan(recordId, operationPayloadForItems(nextItems, itemPayload));
        const detail = await fetchOperationPlan(recordId);
        operationDetailItems.value = detail.items;
        const createdItem = detail.items.find((item) => !existingItemIds.has(item.id));
        operationSelectedItemId.value = createdItem?.id ?? null;
        closeOperationItemModal(true);
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
      closeOperationItemModal(true);
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
    await withOperationWrite(async () => {
	      await deleteOperationPlanItem(recordId, itemId);
      const nextItems = operationDetailItems.value.filter((item) => item.id !== itemId);
      operationDetailItems.value = nextItems;
      operationSelectedItemId.value = null;
      closeOperationItemModal(true);
      await refresh();
    });
  }

  return {
    generationPlans, generationPlan, generationLocked, generationLoading, generationBusy, generationStep, generationError, generationValidation,
    selectGenerationPlan, confirmOperationGeneration, boardSelection, boardSelectionLoading, boardSelectionSavingId, boardSelectionMessage, selectBoardPlan, operationWriteBusy,
    operationRows,
    operationDetailItems,
    operationSelectedItemId,
    operationShowAll,
    operationRefreshForm,
    operationRefreshOpen,
    operationGenerationSummary,
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
    openOperationRefresh,
    closeOperationRefresh,
    refreshOperationInstances,
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
    normalizeOperationItemDuration
  };
}
