import { computed, onMounted, ref, watch } from "vue";
import { useArrangementAdmin } from "./useArrangementAdmin";
import { useConfirmation } from "./useConfirmation";
import { useHolidayAdmin } from "./useHolidayAdmin";
import { useOperationAdmin } from "./useOperationAdmin";
import type { AdminSection, SectionKey } from "./types";

const sections: AdminSection[] = [
  { key: "operation", label: "操作", description: "主任务与时间段子任务" },
  { key: "permit", label: "许可", description: "许可事项与执行区域" },
  { key: "patrol", label: "巡视", description: "目标、人员、车辆与备注" },
  { key: "other", label: "其他", description: "临时任务与协同事项" },
  { key: "leave", label: "休假", description: "休假人员名单" },
  { key: "holiday", label: "节假日", description: "跳过规则基础数据" }
];

export function useAdminViewModel() {
  const today = toChinaDate();
  const yesterday = toChinaDate(new Date(Date.now() - 24 * 60 * 60_000));
  const activeKey = ref<SectionKey>("operation");
  const selectedDate = ref(today);
  const statusText = ref("待保存");
  const activeSection = computed(() => sections.find((section) => section.key === activeKey.value) ?? sections[0]);
  const confirmationModel = useConfirmation();

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
      await withStatus(operationAdmin.loadOperationRows);
    } else if (activeKey.value === "permit") {
      await withStatus(arrangementAdmin.loadPermitRows);
    } else if (activeKey.value === "patrol") {
      await withStatus(arrangementAdmin.loadPatrolRows);
    } else if (activeKey.value === "other") {
      await withStatus(arrangementAdmin.loadOtherRows);
    } else if (activeKey.value === "leave") {
      await withStatus(arrangementAdmin.loadLeaveRows);
    } else {
      await withStatus(holidayAdmin.loadHolidayRows);
    }
  }

  const sharedContext = {
    selectedDate,
    today,
    withStatus,
    refresh: loadActiveList,
    requestConfirmation: confirmationModel.requestConfirmation
  };
  const arrangementAdmin = useArrangementAdmin({
    ...sharedContext,
    activeSection
  });
  const operationAdmin = useOperationAdmin(sharedContext);
  const holidayAdmin = useHolidayAdmin({
    today,
    statusText,
    refresh: loadActiveList,
    requestConfirmation: confirmationModel.requestConfirmation
  });

  onMounted(loadActiveList);
  watch(
    [
      activeKey,
      selectedDate,
      operationAdmin.operationShowAll,
      arrangementAdmin.permitShowAll,
      arrangementAdmin.patrolShowAll,
      arrangementAdmin.otherShowAll,
      arrangementAdmin.leaveShowAll
    ],
    loadActiveList
  );
  watch(holidayAdmin.holidayYear, () => {
    if (activeKey.value === "holiday") void loadActiveList();
  });

  function jumpToToday(): void {
    selectedDate.value = today;
  }

  function jumpToYesterday(): void {
    selectedDate.value = shiftDate(selectedDate.value || today, -1);
  }

  return {
    sections,
    today,
    yesterday,
    activeKey,
    selectedDate,
    statusText,
    activeSection,
    ...arrangementAdmin,
    ...operationAdmin,
    ...holidayAdmin,
    confirmation: confirmationModel.confirmation,
    confirmConfirmation: confirmationModel.confirmConfirmation,
    cancelConfirmation: confirmationModel.cancelConfirmation,
    jumpToToday,
    jumpToYesterday
  };
}

function toChinaDate(date = new Date()): string {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
