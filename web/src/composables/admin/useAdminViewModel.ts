import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  createLeavePerson,
  createOperationPlan,
  createOtherArrangement,
  createPatrolArrangement,
  createPermit,
  createTaskItem,
  deleteLeavePerson,
  deleteOperationPlan,
  deleteOtherArrangement,
  deletePatrolArrangement,
  deletePermitArrangement,
  deleteTaskItem,
  fetchHolidays,
  fetchLeavePeople,
  fetchOperationPlan,
  fetchOperationPlans,
  fetchOtherArrangements,
  fetchPatrolArrangements,
  fetchPermitArrangements,
  importChineseDaysHolidays,
  type ChineseDaysPayload,
  type HolidayRecord,
  type LeavePersonRecord,
  type OperationPlanInput,
  type OperationPlanItemRecord,
  type OperationPlanRecord,
  type OtherArrangementRecord,
  type PatrolArrangementRecord,
  type PermitArrangementRecord,
  updateLeavePerson,
  updateOperationPlan,
  updateOperationPlanEnabled,
  updateOtherArrangement,
  updateOtherArrangementEnabled,
  updatePatrolArrangement,
  updatePatrolArrangementEnabled,
  updatePermitArrangement,
  updatePermitArrangementEnabled
} from "../../api/client";
import type { TimeTag } from "../../api/types";

export function useAdminViewModel() {
  type SectionKey = "operation" | "permit" | "patrol" | "other" | "leave" | "holiday";
  type RecurrenceType = "once" | "finite" | "infinite";
  type ModalKind = "permit" | "patrol" | "other" | "leave";
  type OperationModalMode = "create" | "edit" | "detail";
  type OperationItemModalMode = "create" | "edit";
  type HolidayImportSource = "remote" | "local";
  type ConfirmationRequest = {
    title: string;
    message: string;
    detail?: string;
    confirmLabel: string;
  };
  type ConfirmationState = ConfirmationRequest & {
    resolve: (confirmed: boolean) => void;
  };

  const sections: Array<{ key: SectionKey; label: string; description: string }> = [
    { key: "operation", label: "操作", description: "主任务与时间段子任务" },
    { key: "permit", label: "许可", description: "许可事项与执行区域" },
    { key: "patrol", label: "巡视", description: "目标、人员、车辆与备注" },
    { key: "other", label: "其他", description: "临时任务与协同事项" },
    { key: "leave", label: "休假", description: "休假人员名单" },
    { key: "holiday", label: "节假日", description: "跳过规则基础数据" }
  ];

  const today = toChinaDate();
  const yesterday = toChinaDate(new Date(Date.now() - 24 * 60 * 60_000));
  const OPERATION_DETAIL_LOADING_MIN_MS = 300;
  const CHINESE_DAYS_DEFAULT_URL = "https://cdn.jsdelivr.net/npm/chinese-days/dist/chinese-days.json";
  const activeKey = ref<SectionKey>("operation");
  const selectedDate = ref(today);
  const statusText = ref("待保存");
  const permitRows = ref<PermitArrangementRecord[]>([]);
  const patrolRows = ref<PatrolArrangementRecord[]>([]);
  const otherRows = ref<OtherArrangementRecord[]>([]);
  const leaveRows = ref<LeavePersonRecord[]>([]);
  const operationRows = ref<OperationPlanRecord[]>([]);
  const operationDetailItems = ref<OperationPlanItemRecord[]>([]);
  const operationSelectedItemId = ref<string | null>(null);
  const operationShowAll = ref(false);
  const holidayYear = ref(Number(today.slice(0, 4)));
  const holidayRecords = ref<HolidayRecord[]>([]);
  const holidayImportModalOpen = ref(false);
  const holidayImportFile = ref<File | null>(null);
  const modalKind = ref<ModalKind | null>(null);
  const modalRecordId = ref<string | null>(null);
  const operationModalOpen = ref(false);
  const operationModalMode = ref<OperationModalMode>("create");
  const operationRecordId = ref<string | null>(null);
  const operationItemModalOpen = ref(false);
  const operationItemModalMode = ref<OperationItemModalMode>("edit");
  const operationDetailLoading = ref(false);
  const confirmation = ref<ConfirmationState | null>(null);
  const activeSection = computed(() => sections.find((section) => section.key === activeKey.value) ?? sections[0]);
  const modalTitle = computed(() => `${modalRecordId.value ? "修改" : "新增"}${activeSection.value.label}`);
  const operationReadOnly = computed(() => operationModalMode.value === "detail");
  const operationModalTitle = computed(() => {
    if (operationModalMode.value === "detail") return "详情计划";
    return `${operationModalMode.value === "edit" ? "修改" : "新增"}计划`;
  });
  const operationItemModalTitle = computed(() => {
    if (operationReadOnly.value) return "子任务详情";
    return operationItemModalMode.value === "create" ? "新增子任务" : "编辑子任务";
  });
  const operationStoredDurationMinutes = computed(() => {
    const start = new Date(normalizeDateTime(operationForm.startAt)).getTime();
    const end = new Date(normalizeDateTime(operationForm.endAt)).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
    return Math.max(1, Math.floor((end - start) / 60_000));
  });
  const operationCycleDurationMinutes = computed(() => {
    return cycleDurationForItems(operationDetailItems.value);
  });
  const operationDurationMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationHasEndAt = computed(() => operationForm.recurrenceType !== "infinite");
  const operationDerivedRecurrenceIntervalMinutes = computed(() => operationCycleDurationMinutes.value);
  const operationDerivedRecurrenceCount = computed(() => recurrenceCountForItems(operationDetailItems.value));
  const operationComputedEndAt = computed(() => computedEndAtForItems(operationDetailItems.value));
  const holidayRows = computed(() => holidayRecords.value.filter((record) => record.type === "holiday"));
  const adjustedWorkdayRows = computed(() => holidayRecords.value.filter((record) => record.type === "adjusted_workday"));

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

  const operationItemBaseOptions = computed(() =>
    operationDetailItems.value
      .filter((item) => item.id !== operationItemForm.id)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.offsetMinutes - b.offsetMinutes)
  );

  const holidayImportForm = reactive({
    source: "remote" as HolidayImportSource,
    url: CHINESE_DAYS_DEFAULT_URL
  });

  const modalForm = reactive({
    date: today,
    timeTag: "全天" as TimeTag,
    primary: "",
    personnel: "",
    secondary: "",
    other: ""
  });

  onMounted(loadActiveList);
  watch([activeKey, selectedDate, operationShowAll], loadActiveList);
  watch(holidayYear, () => {
    if (activeKey.value === "holiday") void loadActiveList();
  });

  function toChinaDate(date = new Date()): string {
    const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
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

  async function withStatus(action: () => Promise<void>): Promise<void> {
    statusText.value = "同步中";
    try {
      await action();
      statusText.value = "已同步";
    } catch (error) {
      statusText.value = error instanceof Error ? error.message : "操作失败";
    }
  }

  async function loadActiveList(): Promise<void> {
    if (activeKey.value === "operation") {
      await withStatus(async () => {
        operationRows.value = await fetchOperationPlans(selectedDate.value, operationShowAll.value ? "all" : "date");
      });
    } else if (activeKey.value === "permit") {
      await withStatus(async () => {
        permitRows.value = await fetchPermitArrangements(selectedDate.value);
      });
    } else if (activeKey.value === "patrol") {
      await withStatus(async () => {
        patrolRows.value = await fetchPatrolArrangements(selectedDate.value);
      });
    } else if (activeKey.value === "other") {
      await withStatus(async () => {
        otherRows.value = await fetchOtherArrangements(selectedDate.value);
      });
    } else if (activeKey.value === "leave") {
      await withStatus(async () => {
        leaveRows.value = await fetchLeavePeople(selectedDate.value);
      });
    } else if (activeKey.value === "holiday") {
      await withStatus(async () => {
        holidayRecords.value = await fetchHolidays(holidayYear.value);
      });
    }
  }

  function jumpToToday(): void {
    selectedDate.value = today;
  }

  function jumpToYesterday(): void {
    selectedDate.value = shiftDate(selectedDate.value || today, -1);
  }

  function shiftDate(value: string, days: number): string {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function resetModal(kind: ModalKind, recordId: string | null): void {
    modalKind.value = kind;
    modalRecordId.value = recordId;
    modalForm.date = selectedDate.value || today;
    modalForm.timeTag = "全天";
    modalForm.primary = "";
    modalForm.personnel = "";
    modalForm.secondary = "";
    modalForm.other = "";
  }

  function openPermitModal(record?: PermitArrangementRecord): void {
    resetModal("permit", record?.id ?? null);
    if (record) {
      modalForm.date = record.date;
      modalForm.timeTag = record.timeTag;
      modalForm.primary = record.permit;
      modalForm.personnel = record.personnel;
      modalForm.secondary = record.area;
      modalForm.other = record.other;
    }
  }

  function openPatrolModal(record?: PatrolArrangementRecord): void {
    resetModal("patrol", record?.id ?? null);
    if (record) {
      modalForm.date = record.date;
      modalForm.timeTag = record.timeTag;
      modalForm.primary = record.target;
      modalForm.personnel = record.personnel;
      modalForm.secondary = record.vehicle;
      modalForm.other = record.other;
    }
  }

  function openOtherModal(record?: OtherArrangementRecord): void {
    resetModal("other", record?.id ?? null);
    if (record) {
      modalForm.date = record.date;
      modalForm.timeTag = record.timeTag;
      modalForm.primary = record.task;
      modalForm.personnel = record.personnel;
      modalForm.secondary = record.vehicle;
      modalForm.other = record.other;
    }
  }

  function openLeaveModal(record?: LeavePersonRecord): void {
    resetModal("leave", record?.id ?? null);
    if (record) {
      modalForm.date = record.date;
      modalForm.primary = record.name;
    }
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

  function closeModal(): void {
    modalKind.value = null;
    modalRecordId.value = null;
  }

  function openHolidayImportModal(): void {
    holidayImportForm.source = "remote";
    holidayImportForm.url = CHINESE_DAYS_DEFAULT_URL;
    holidayImportFile.value = null;
    holidayImportModalOpen.value = true;
  }

  function closeHolidayImportModal(): void {
    holidayImportModalOpen.value = false;
    holidayImportFile.value = null;
  }

  function selectHolidayImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    holidayImportFile.value = input.files?.[0] ?? null;
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

  async function saveModal(): Promise<void> {
    if (!modalKind.value) return;
    await withStatus(async () => {
      if (modalKind.value === "permit") {
        const payload = {
          date: modalForm.date,
          timeTag: modalForm.timeTag,
          permit: modalForm.primary,
          personnel: modalForm.personnel,
          area: modalForm.secondary,
          other: modalForm.other
        };
        if (modalRecordId.value) await updatePermitArrangement(modalRecordId.value, payload);
        else await createPermit(payload);
      } else if (modalKind.value === "patrol") {
        const payload = {
          date: modalForm.date,
          timeTag: modalForm.timeTag,
          target: modalForm.primary,
          personnel: modalForm.personnel,
          vehicle: modalForm.secondary,
          other: modalForm.other
        };
        if (modalRecordId.value) await updatePatrolArrangement(modalRecordId.value, payload);
        else await createPatrolArrangement(payload);
      } else if (modalKind.value === "leave") {
        const payload = {
          date: modalForm.date,
          name: modalForm.primary
        };
        if (modalRecordId.value) await updateLeavePerson(modalRecordId.value, payload);
        else await createLeavePerson(payload);
      } else {
        const payload = {
          date: modalForm.date,
          timeTag: modalForm.timeTag,
          task: modalForm.primary,
          personnel: modalForm.personnel,
          vehicle: modalForm.secondary,
          other: modalForm.other
        };
        if (modalRecordId.value) await updateOtherArrangement(modalRecordId.value, payload);
        else await createOtherArrangement(payload);
      }
      closeModal();
      selectedDate.value = modalForm.date;
      await loadActiveList();
    });
  }

  async function togglePermit(record: PermitArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updatePermitArrangementEnabled(record.id, !record.enabled);
      await loadActiveList();
    });
  }

  async function togglePatrol(record: PatrolArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updatePatrolArrangementEnabled(record.id, !record.enabled);
      await loadActiveList();
    });
  }

  async function toggleOther(record: OtherArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updateOtherArrangementEnabled(record.id, !record.enabled);
      await loadActiveList();
    });
  }

  async function toggleOperation(record: OperationPlanRecord): Promise<void> {
    await withStatus(async () => {
      await updateOperationPlanEnabled(record.id, !record.enabled);
      await loadActiveList();
    });
  }

  function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
    confirmation.value?.resolve(false);
    return new Promise((resolve) => {
      confirmation.value = { ...request, resolve };
    });
  }

  function settleConfirmation(confirmed: boolean): void {
    const current = confirmation.value;
    confirmation.value = null;
    current?.resolve(confirmed);
  }

  function confirmConfirmation(): void {
    settleConfirmation(true);
  }

  function cancelConfirmation(): void {
    settleConfirmation(false);
  }

  async function removePermit(id: string): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除许可",
      message: "确认删除这条许可吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deletePermitArrangement(id);
      await loadActiveList();
    });
  }

  async function removePatrol(id: string): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除巡视",
      message: "确认删除这条巡视吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deletePatrolArrangement(id);
      await loadActiveList();
    });
  }

  async function removeOther(id: string): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除其他事项",
      message: "确认删除这条其他事项吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deleteOtherArrangement(id);
      await loadActiveList();
    });
  }

  async function removeLeave(id: string): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "删除休假",
      message: "确认删除这条休假吗？",
      confirmLabel: "删除"
    });
    if (!confirmed) return;
    await withStatus(async () => {
      await deleteLeavePerson(id);
      await loadActiveList();
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
      await loadActiveList();
    });
  }

  async function saveOperation(): Promise<void> {
    if (operationReadOnly.value) return;
    await withStatus(async () => {
      const payload = operationPayloadForItems(operationDetailItems.value);
      if (operationRecordId.value) await updateOperationPlan(operationRecordId.value, payload);
      else await createOperationPlan(payload);
      closeOperationModal();
      await loadActiveList();
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
        await loadActiveList();
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
      await loadActiveList();
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
      await loadActiveList();
    });
  }

  async function submitHolidayImport(): Promise<void> {
    const confirmed = await requestConfirmation({
      title: "覆盖节假日数据",
      message: "导入会清空并覆盖全部历史节假日数据。",
      detail: "当前系统内所有节假日数据都会被删除并替换为 chinese-days 数据。",
      confirmLabel: "确认导入"
    });
    if (!confirmed) return;

    statusText.value = "同步中";
    try {
      const payload =
        holidayImportForm.source === "remote" ? await loadHolidayImportRemotePayload() : await loadHolidayImportLocalPayload();
      const result = await importChineseDaysHolidays(payload);
      await loadActiveList();
      closeHolidayImportModal();
      statusText.value = `已导入 ${result.imported} 条`;
    } catch (error) {
      statusText.value = error instanceof Error ? error.message : "导入失败";
    }
  }

  async function loadHolidayImportRemotePayload(): Promise<ChineseDaysPayload> {
    const response = await fetch(holidayImportForm.url);
    if (!response.ok) throw new Error(`节假日数据下载失败: ${response.status}`);
    return normalizeChineseDaysPayload((await response.json()) as Partial<ChineseDaysPayload>);
  }

  async function loadHolidayImportLocalPayload(): Promise<ChineseDaysPayload> {
    if (!holidayImportFile.value) throw new Error("请选择本地 JSON 文件");
    const raw = await readHolidayImportFile(holidayImportFile.value);
    return normalizeChineseDaysPayload(JSON.parse(raw) as Partial<ChineseDaysPayload>);
  }

  function normalizeChineseDaysPayload(payload: Partial<ChineseDaysPayload>): ChineseDaysPayload {
    return {
      holidays: payload.holidays ?? {},
      workdays: payload.workdays ?? {},
      inLieuDays: payload.inLieuDays ?? {}
    };
  }

  function readHolidayImportFile(file: File): Promise<string> {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
      reader.addEventListener("error", () => reject(new Error("本地 JSON 文件读取失败")));
      reader.readAsText(file);
    });
  }

  return {
    sections,
    today,
    yesterday,
    activeKey,
    selectedDate,
    statusText,
    permitRows,
    patrolRows,
    otherRows,
    leaveRows,
    operationRows,
    operationDetailItems,
    operationSelectedItemId,
    operationShowAll,
    holidayYear,
    holidayImportModalOpen,
    modalKind,
    operationModalOpen,
    operationModalMode,
    operationRecordId,
    operationItemModalOpen,
    operationItemModalMode,
    operationDetailLoading,
    confirmation,
    activeSection,
    modalTitle,
    operationReadOnly,
    operationModalTitle,
    operationItemModalTitle,
    operationDurationMinutes,
    operationHasEndAt,
    operationDerivedRecurrenceIntervalMinutes,
    operationDerivedRecurrenceCount,
    operationComputedEndAt,
    holidayRows,
    adjustedWorkdayRows,
    operationForm,
    operationItemForm,
    operationItemBaseOptions,
    holidayImportForm,
    modalForm,
    jumpToToday,
    jumpToYesterday,
    openPermitModal,
    openPatrolModal,
    openOtherModal,
    openLeaveModal,
    openOperationModal,
    selectOperationItem,
    openOperationItemCreate,
    closeModal,
    openHolidayImportModal,
    closeHolidayImportModal,
    selectHolidayImportFile,
    closeOperationModal,
    closeOperationItemModal,
    saveModal,
    togglePermit,
    togglePatrol,
    toggleOther,
    toggleOperation,
    confirmConfirmation,
    cancelConfirmation,
    removePermit,
    removePatrol,
    removeOther,
    removeLeave,
    removeOperation,
    saveOperation,
    saveOperationItem,
    removeOperationItem,
    submitHolidayImport,
    normalizeOperationItemOffset,
    normalizeOperationItemDuration,
    syncOperationItemMetadataOpen
  };
}
