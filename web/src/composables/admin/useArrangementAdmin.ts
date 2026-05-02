import { computed, reactive, ref } from "vue";
import {
  createLeavePerson,
  createOtherArrangement,
  createPatrolArrangement,
  createPermit,
  deleteLeavePerson,
  deleteOtherArrangement,
  deletePatrolArrangement,
  deletePermitArrangement,
  fetchLeavePeople,
  fetchOtherArrangements,
  fetchPatrolArrangements,
  fetchPermitArrangements,
  type LeavePersonRecord,
  type OtherArrangementRecord,
  type PatrolArrangementRecord,
  type PermitArrangementRecord,
  updateLeavePerson,
  updateOtherArrangement,
  updateOtherArrangementEnabled,
  updatePatrolArrangement,
  updatePatrolArrangementEnabled,
  updatePermitArrangement,
  updatePermitArrangementEnabled
} from "../../api/client";
import type { TimeTag } from "../../api/types";
import type { ArrangementAdminContext, ModalKind } from "./types";

export function useArrangementAdmin(context: ArrangementAdminContext) {
  const { activeSection, selectedDate, today, withStatus, refresh, requestConfirmation } = context;
  const permitRows = ref<PermitArrangementRecord[]>([]);
  const patrolRows = ref<PatrolArrangementRecord[]>([]);
  const otherRows = ref<OtherArrangementRecord[]>([]);
  const leaveRows = ref<LeavePersonRecord[]>([]);
  const permitShowAll = ref(false);
  const patrolShowAll = ref(false);
  const otherShowAll = ref(false);
  const leaveShowAll = ref(false);
  const modalKind = ref<ModalKind | null>(null);
  const modalRecordId = ref<string | null>(null);
  const modalTitle = computed(() => `${modalRecordId.value ? "修改" : "新增"}${activeSection.value.label}`);
  const modalForm = reactive({
    date: today,
    timeTag: "上午" as TimeTag,
    primary: "",
    personnel: "",
    secondary: "",
    other: ""
  });

  async function loadPermitRows(): Promise<void> {
    permitRows.value = await fetchPermitArrangements(selectedDate.value, permitShowAll.value ? "all" : "date");
  }

  async function loadPatrolRows(): Promise<void> {
    patrolRows.value = await fetchPatrolArrangements(selectedDate.value, patrolShowAll.value ? "all" : "date");
  }

  async function loadOtherRows(): Promise<void> {
    otherRows.value = await fetchOtherArrangements(selectedDate.value, otherShowAll.value ? "all" : "date");
  }

  async function loadLeaveRows(): Promise<void> {
    leaveRows.value = await fetchLeavePeople(selectedDate.value, leaveShowAll.value ? "all" : "date");
  }

  function resetModal(kind: ModalKind, recordId: string | null): void {
    modalKind.value = kind;
    modalRecordId.value = recordId;
    modalForm.date = selectedDate.value || today;
    modalForm.timeTag = "上午";
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

  function closeModal(): void {
    modalKind.value = null;
    modalRecordId.value = null;
  }

  async function saveModal(): Promise<void> {
    if (!modalKind.value) return;
    if (modalKind.value === "leave" && hasDuplicateLeavePerson(modalForm.date, modalForm.primary, modalRecordId.value ?? undefined)) {
      await requestConfirmation({
        title: "人员重复",
        message: `${modalForm.date} 已存在休假人员「${modalForm.primary.trim()}」，不会重复添加。`,
        confirmLabel: "知道了"
      });
      return;
    }
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
      await refresh();
    });
  }

  async function togglePermit(record: PermitArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updatePermitArrangementEnabled(record.id, !record.enabled);
      await refresh();
    });
  }

  async function togglePatrol(record: PatrolArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updatePatrolArrangementEnabled(record.id, !record.enabled);
      await refresh();
    });
  }

  async function toggleOther(record: OtherArrangementRecord): Promise<void> {
    await withStatus(async () => {
      await updateOtherArrangementEnabled(record.id, !record.enabled);
      await refresh();
    });
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
      await refresh();
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
      await refresh();
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
      await refresh();
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
      await refresh();
    });
  }

  function hasDuplicateLeavePerson(date: string, name: string, excludeId?: string): boolean {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    return leaveRows.value.some((record) => record.date === date && record.name.trim() === normalizedName && record.id !== excludeId);
  }

  return {
    permitRows,
    patrolRows,
    otherRows,
    leaveRows,
    permitShowAll,
    patrolShowAll,
    otherShowAll,
    leaveShowAll,
    modalKind,
    modalTitle,
    modalForm,
    loadPermitRows,
    loadPatrolRows,
    loadOtherRows,
    loadLeaveRows,
    openPermitModal,
    openPatrolModal,
    openOtherModal,
    openLeaveModal,
    closeModal,
    saveModal,
    togglePermit,
    togglePatrol,
    toggleOther,
    removePermit,
    removePatrol,
    removeOther,
    removeLeave
  };
}
