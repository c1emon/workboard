import { ref } from "vue";
import { fetchOperationPlan, fetchPatrolPlan, importOperationPlanItems, replacePatrolPlanItems, PlanWriteError,
  type OperationPlanItemInput, type PatrolCycleItemImportInput } from "../../api/client";
import { downloadPlanWorkbook, parseOperationDetailExcel, parsePatrolDetailExcel } from "../../utils/planExcel";

type DetailInput = OperationPlanItemInput[] | PatrolCycleItemImportInput["items"];
export interface PlanImportTarget { kind: "operation" | "patrol"; id: string; name: string; count: number }

export function usePlanFileExchange(refresh: () => Promise<void>) {
  const importTarget = ref<PlanImportTarget | null>(null);
  const importFileName = ref("");
  const importItems = ref<DetailInput>([]);
  const importError = ref("");
  const importBusy = ref(false);
  const importReading = ref(false);
  const fileSummary = ref("");
  const exportingId = ref<string | null>(null);
  let readVersion = 0;

  function openImport(target: PlanImportTarget) {
    if (importBusy.value) return;
    ++readVersion;
    importTarget.value = target;
    importItems.value = [];
    importFileName.value = "";
    importError.value = "";
    importReading.value = false;
  }
  function closeImport() {
    if (importBusy.value) return;
    ++readVersion;
    importTarget.value = null;
    importItems.value = [];
  }
  async function selectImportFile(file: File) {
    if (!importTarget.value || importBusy.value) return;
    const version = ++readVersion;
    const kind = importTarget.value.kind;
    importItems.value = [];
    importError.value = "";
    importFileName.value = file.name;
    importReading.value = true;
    try {
      const items = kind === "operation" ? await parseOperationDetailExcel(file) : await parsePatrolDetailExcel(file);
      if (version === readVersion && importTarget.value) importItems.value = items;
    } catch (error) {
      if (version === readVersion) importError.value = error instanceof Error ? error.message : "文件校验失败";
    } finally {
      if (version === readVersion) importReading.value = false;
    }
  }
  async function submitImport() {
    const target = importTarget.value;
    if (!target || !importItems.value.length || importBusy.value || importReading.value) return;
    importBusy.value = true;
    importError.value = "";
    try {
      const result = target.kind === "operation" ? await importOperationPlanItems(target.id, importItems.value as OperationPlanItemInput[])
        : await replacePatrolPlanItems(target.id, { mode: "replace", items: importItems.value as PatrolCycleItemImportInput["items"] });
      fileSummary.value = `已覆盖导入 ${result.imported} 项；已生成实例未修改`;
      importTarget.value = null;
      ++readVersion;
      await refresh();
    } catch (error) {
      importError.value = error instanceof PlanWriteError && error.confirmedFailure
        ? `导入失败，原明细已保留：${error.message}` : "导入结果未确认，请刷新后检查";
    } finally { importBusy.value = false; }
  }
  async function exportPlan(kind: "operation" | "patrol", id: string) {
    if (exportingId.value) return;
    exportingId.value = id;
    fileSummary.value = "";
    try {
      const plan = kind === "operation" ? await fetchOperationPlan(id) : await fetchPatrolPlan(id);
      await downloadPlanWorkbook(kind, plan);
      fileSummary.value = "已生成导出文件";
    } catch (error) { fileSummary.value = `导出失败：${error instanceof Error ? error.message : "请重试"}`; }
    finally { exportingId.value = null; }
  }
  return { importTarget, importFileName, importItems, importError, importBusy, importReading, fileSummary, exportingId,
    openImport, closeImport, selectImportFile, submitImport, exportPlan };
}
