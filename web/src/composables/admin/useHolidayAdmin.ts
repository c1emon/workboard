import { computed, reactive, ref } from "vue";
import {
  fetchHolidays,
  importChineseDaysHolidays,
  type ChineseDaysPayload,
  type HolidayRecord
} from "../../api/client";
import type { HolidayAdminContext, HolidayImportSource } from "./types";

const CHINESE_DAYS_DEFAULT_URL = "https://cdn.jsdelivr.net/npm/chinese-days/dist/chinese-days.json";

export function useHolidayAdmin(context: HolidayAdminContext) {
  const { today, statusText, refresh, requestConfirmation } = context;
  const holidayYear = ref(Number(today.slice(0, 4)));
  const holidayRecords = ref<HolidayRecord[]>([]);
  const holidayImportModalOpen = ref(false);
  const holidayImportFile = ref<File | null>(null);
  const holidayRows = computed(() => holidayRecords.value.filter((record) => record.type === "holiday"));
  const adjustedWorkdayRows = computed(() => holidayRecords.value.filter((record) => record.type === "adjusted_workday"));
  const holidayImportForm = reactive({
    source: "remote" as HolidayImportSource,
    url: CHINESE_DAYS_DEFAULT_URL
  });

  async function loadHolidayRows(): Promise<void> {
    holidayRecords.value = await fetchHolidays(holidayYear.value);
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
      await refresh();
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
    holidayYear,
    holidayRows,
    adjustedWorkdayRows,
    holidayImportModalOpen,
    holidayImportForm,
    loadHolidayRows,
    openHolidayImportModal,
    closeHolidayImportModal,
    selectHolidayImportFile,
    submitHolidayImport
  };
}
