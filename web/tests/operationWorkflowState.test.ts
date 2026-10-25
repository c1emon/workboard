// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ref } from "vue";
import { useOperationAdmin } from "../src/composables/admin/useOperationAdmin";
import { usePlanFileExchange } from "../src/composables/admin/usePlanFileExchange";
import { fetchOperationPlans, fetchOperationPlan, fetchOperationBoardSelection, saveOperationBoardSelection, regenerateOperationPlan,
  importOperationPlanItems, PlanWriteError, type OperationPlanDetailRecord } from "../src/api/client";
import { parseOperationDetailExcel } from "../src/utils/planExcel";
vi.mock('../src/api/client',async importOriginal=>({ ...await importOriginal<object>(),
  fetchOperationPlans:vi.fn(), fetchOperationPlan:vi.fn(), fetchOperationBoardSelection:vi.fn(),saveOperationBoardSelection:vi.fn(),regenerateOperationPlan:vi.fn(),importOperationPlanItems:vi.fn()
}));
vi.mock('../src/utils/planExcel',()=>({parseOperationDetailExcel:vi.fn(),parsePatrolDetailExcel:vi.fn(),downloadPlanWorkbook:vi.fn()}));
const detail:OperationPlanDetailRecord={id:'p',name:'计划 P',description:'说明',startAt:'2030-10-25T08:00:00+08:00',endAt:'2030-10-27T18:00:00+08:00',recurrenceType:'infinite',recurrenceIntervalMinutes:240,recurrenceCount:null,skipWeekends:false,skipHolidays:true,enabled:true,childTaskCount:2,firstItemContent:'A',items:[
  {id:'a',offsetMinutes:0,durationMinutes:60,sortOrder:0,content:'A',extData:{}}, {id:'b',offsetMinutes:180,durationMinutes:60,sortOrder:1,content:'B',extData:{}}
]};
function deferred<T>() { let resolve!:(v:T)=>void; const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; }
function model() { return useOperationAdmin({selectedDate:ref('2030-10-25'),today:'2030-10-25',withStatus:async action=>{await action();},refresh:vi.fn().mockResolvedValue(undefined),requestConfirmation:vi.fn()}); }
beforeEach(()=>{
  vi.clearAllMocks();vi.mocked(fetchOperationPlans).mockResolvedValue([detail]);vi.mocked(fetchOperationPlan).mockResolvedValue(detail);
  vi.mocked(fetchOperationBoardSelection).mockResolvedValue({planId:'p',name:'计划 P',enabled:true,exists:true});
});
describe('operation workflow state',()=>{
  it('keeps the saved selection independently of filtered rows and on failed save',async()=>{
    const admin=model(); vi.mocked(fetchOperationPlans).mockResolvedValue([]);
    await admin.loadOperationRows(); expect(admin.boardSelection.value?.name).toBe('计划 P');expect(admin.operationRows.value).toEqual([]);
    vi.mocked(saveOperationBoardSelection).mockRejectedValue(new PlanWriteError('拒绝',true));
    await admin.selectBoardPlan('q'); expect(admin.boardSelection.value?.planId).toBe('p');expect(admin.boardSelectionMessage.value).toContain('切换失败');
  });
  it('does not let stale reads overwrite a newly saved selection',async()=>{
    const admin=model(); await admin.loadOperationRows();
    const old=deferred<Awaited<ReturnType<typeof fetchOperationBoardSelection>>>();vi.mocked(fetchOperationBoardSelection).mockReturnValueOnce(old.promise);
    const loading=admin.loadOperationRows();vi.mocked(saveOperationBoardSelection).mockResolvedValue({planId:'q',name:'计划 Q',enabled:false,exists:true});
    await admin.selectBoardPlan('q'); old.resolve({planId:'p',name:'计划 P',enabled:true,exists:true}); await loading;
    expect(admin.boardSelection.value?.planId).toBe('q');expect(admin.boardSelection.value?.enabled).toBe(false);
  });
  it('requires recurring child choice, retains invalid cutoff and changes once to cycle zero',async()=>{
    const admin=model();await admin.openOperationRefresh();expect(admin.operationRefreshForm.templateId).toBe('');
    await admin.selectGenerationPlan('p');expect(admin.generationValidation.value).toBe('请选择起始子任务');
    admin.operationRefreshForm.startItemId='b';admin.operationRefreshForm.startAt='2030-10-25T10:30';admin.operationRefreshForm.cutoffAt='2030-10-25T09:00';
    expect(admin.generationValidation.value).toContain('截止时间');expect(admin.operationRefreshForm.cutoffAt).toBe('2030-10-25T09:00');
    vi.mocked(fetchOperationPlan).mockResolvedValue({...detail,recurrenceType:'once'});await admin.selectGenerationPlan('p');
    expect(admin.operationRefreshForm.startItemId).toBe('');expect(admin.generationValidation.value).toBe('');
  });
  it('ignores old target loads after switching or closing',async()=>{
    const admin=model();await admin.openOperationRefresh();const old=deferred<OperationPlanDetailRecord>();vi.mocked(fetchOperationPlan).mockReturnValueOnce(old.promise);
    const reading=admin.selectGenerationPlan('p'); await admin.selectGenerationPlan('q');old.resolve({...detail,name:'过期计划'});await reading;
    expect(admin.generationPlan.value?.name).toBe('计划 P');
    const next=deferred<OperationPlanDetailRecord>();vi.mocked(fetchOperationPlan).mockReturnValueOnce(next.promise);
    const closing=admin.selectGenerationPlan('p');admin.closeOperationRefresh();next.resolve(detail);await closing;expect(admin.generationPlan.value).toBeNull();
  });
  it('prevents duplicate writes and closing while pending; shows actual zero insertions',async()=>{
    const admin=model();await admin.openOperationRefresh(detail);admin.operationRefreshForm.startItemId='b';admin.confirmOperationGeneration();
    const request=deferred<{removed:number;inserted:number;skipped:number}>();vi.mocked(regenerateOperationPlan).mockReturnValueOnce(request.promise);
    const writing=admin.refreshOperationInstances();await admin.refreshOperationInstances();admin.closeOperationRefresh();expect(admin.operationRefreshOpen.value).toBe(true);
    expect(regenerateOperationPlan).toHaveBeenCalledTimes(1);request.resolve({removed:7,inserted:0,skipped:1});await writing;
    expect(admin.operationGenerationSummary.value).toContain('清理 7 条，新增 0 条');expect(admin.operationRefreshOpen.value).toBe(false);
  });
  it.each([true,false])('preserves form and distinguishes confirmed failure=%s from unknown outcomes',async(confirmed)=>{
    const admin=model();await admin.openOperationRefresh(detail);admin.operationRefreshForm.startItemId='b';admin.confirmOperationGeneration();
    vi.mocked(regenerateOperationPlan).mockRejectedValueOnce(confirmed?new PlanWriteError('回滚',true):new TypeError('断网'));
    await admin.refreshOperationInstances();expect(admin.operationRefreshOpen.value).toBe(true);expect(admin.operationRefreshForm.startItemId).toBe('b');
    expect(admin.generationError.value).toContain(confirmed?'原安排已保留':'结果未确认');expect(regenerateOperationPlan).toHaveBeenCalledTimes(1);
  });
});
describe('shared file import state',()=>{
  const items=[{content:'A',offsetMinutes:0,durationMinutes:60,sortOrder:0,extData:{}}];
  it('invalidates old previews on reselect, including the same file',async()=>{
    const files=usePlanFileExchange(vi.fn());files.openImport({kind:'operation',id:'p',name:'P',count:2});
    const old=deferred<typeof items>();vi.mocked(parseOperationDetailExcel).mockReturnValueOnce(old.promise).mockResolvedValueOnce(items);
    const file=new File(['x'],'plan.xlsx');const first=files.selectImportFile(file);await files.selectImportFile(file);old.resolve([{...items[0],content:'过期'}]);await first;
    expect(files.importItems.value).toEqual(items);
    vi.mocked(parseOperationDetailExcel).mockRejectedValueOnce(new Error('第 8 行错误'));await files.selectImportFile(file);
    expect(files.importItems.value).toEqual([]);expect(files.importError.value).toContain('第 8 行');await files.submitImport();expect(importOperationPlanItems).not.toHaveBeenCalled();
  });
  it('keeps validated input after rollback and blocks duplicate submit and close',async()=>{
    const files=usePlanFileExchange(vi.fn());files.openImport({kind:'operation',id:'p',name:'P',count:2});vi.mocked(parseOperationDetailExcel).mockResolvedValue(items);
    await files.selectImportFile(new File(['x'],'plan.xlsx'));vi.mocked(importOperationPlanItems).mockRejectedValueOnce(new PlanWriteError('失败',true));await files.submitImport();
    expect(files.importItems.value).toEqual(items);expect(files.importError.value).toContain('原明细已保留');
    const request=deferred<{imported:number}>();vi.mocked(importOperationPlanItems).mockReturnValueOnce(request.promise);
    const writing=files.submitImport();await files.submitImport();files.closeImport();expect(files.importTarget.value?.id).toBe('p');
    request.resolve({imported:1});await writing;expect(files.importTarget.value).toBeNull();expect(files.fileSummary.value).toBe('已覆盖导入 1 项；已生成实例未修改');
  });
});
