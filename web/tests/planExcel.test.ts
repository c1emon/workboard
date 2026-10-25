// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createPlanWorkbook, parseOperationDetailExcel, parsePatrolDetailExcel } from "../src/utils/planExcel";
import type { OperationPlanDetailRecord, PatrolPlanDetail } from "../src/api/client";
const headers=['任务内容','开始偏移（分钟）','持续时间（分钟）'];
function file(rows: unknown[][], sheet='子任务', info=false) {
  const book=XLSX.utils.book_new();
  if(info) XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['字段','值'],['计划名称','不能覆盖']]),'计划信息');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),sheet);
  return new File([XLSX.write(book,{type:'array',bookType:'xlsx'})],'plan.xlsx');
}
const plan:OperationPlanDetailRecord={id:'p',name:'计划 P',description:'说明',startAt:'2030-10-25T08:00:00+08:00',endAt:'2030-10-25T12:00:00+08:00',recurrenceType:'once',recurrenceIntervalMinutes:null,recurrenceCount:null,skipWeekends:false,skipHolidays:false,enabled:false,childTaskCount:2,firstItemContent:'A',items:[
  {id:'a',content:'=1+1',offsetMinutes:0,durationMinutes:60,sortOrder:0,extData:{zone:'A','任务内容':42,enabled:true,nested:{x:1}}},
  {id:'b',content:'B',offsetMinutes:180,durationMinutes:60,sortOrder:1,extData:{remark:'说明','扩展：任务内容':'另值'}}
]};
describe('plan XLSX exchange',()=>{
  it('maps reordered headers, orders by sequence and preserves scalar extensions',async()=>{
    const result=await parseOperationDetailExcel(file([['持续时间（分钟）','序号','任务内容','开始偏移（分钟）','zone','enabled'],[60,2,'B',180,'A',true],[120,1,'A',0,'B',false]],'子任务',true));
    expect(result).toEqual([
      {content:'A',offsetMinutes:0,durationMinutes:120,sortOrder:1,extData:{zone:'B',enabled:false}},
      {content:'B',offsetMinutes:180,durationMinutes:60,sortOrder:2,extData:{zone:'A',enabled:true}}
    ]);
  });
  it('validates rows beyond the bounded preview and reports original row numbers',async()=>{
    const rows:unknown[][]=[headers,...Array.from({length:5},()=>['A',0,60]),[],['bad',-1,30]];
    await expect(parseOperationDetailExcel(file(rows))).rejects.toThrow('工作表「子任务」第 8 行 开始偏移（分钟）');
  });
  it.each([
    [['任务内容','持续时间（分钟）'],['A',60]],
    [[...headers,'zone','zone'],['A',0,60,'A','B']],
    [[...headers,'序号'],['A',0,60,1],['B',60,60,1]],
    [headers],
    [headers,['A',0,0]],
    [headers,['A',true,60]]
  ])('rejects invalid workbook without yielding partial data',async(...rows)=>{
    await expect(parseOperationDetailExcel(file(rows))).rejects.toThrow();
  });
  it('does not guess a plan information sheet as details',async()=>{
    await expect(parseOperationDetailExcel(file([['字段','值']],'计划信息'))).rejects.toThrow('明细工作表');
  });
  it('exports exactly one complete definition, stable unique extension columns and plain text formulas',async()=>{
    const book=await createPlanWorkbook('operation',plan);
    const read=XLSX.read(XLSX.write(book,{type:'array',bookType:'xlsx'}),{type:'array'});
    expect(read.SheetNames).toEqual(['计划信息','子任务']);
    const rows=XLSX.utils.sheet_to_json<unknown[]>(read.Sheets['子任务'],{header:1,defval:''});
    expect(rows[0].slice(0,4)).toEqual(['序号',...headers]);
    expect(new Set(rows[0]).size).toBe(rows[0].length);
    expect(rows).toHaveLength(3);
    expect(read.Sheets['子任务'].B2).toMatchObject({t:'s',v:'=1+1'});
    expect(read.Sheets['子任务'].B2.f).toBeUndefined();
    const col=(name:string)=>rows[0].indexOf(name);
    expect(rows[1][col('enabled')]).toBe(true);
    expect(rows[1][col('nested')]).toBe('{"x":1}');
    expect(rows[2][col('zone')]).toBe('');
    expect(rows[1][col('扩展：任务内容')]).toBe(42);
  });
  it('exports empty or disabled plans with headers and info',async()=>{
    const book=await createPlanWorkbook('operation',{...plan,items:[]});
    expect(XLSX.utils.sheet_to_json(book.Sheets['子任务'],{header:1})).toEqual([['序号',...headers]]);
    expect(XLSX.utils.sheet_to_json(book.Sheets['计划信息'],{header:1})).toContainEqual(['启用状态','已禁用']);
  });
  it('exports patrol business fields once and appends custom extensions',async()=>{
    const patrol:PatrolPlanDetail={...plan,recurrenceType:'infinite',cycleLength:3,items:[{id:'i',templateId:'p',cycleDay:3,timeTag:'上午',target:'站 A',personnel:'张三',vehicle:'车',other:'备注',content:'站 A',sortOrder:0,extData:{cycleDay:3,target:'站 A',zone:'北区',remark:'注意'}}]};
    const book=await createPlanWorkbook('patrol',patrol);
    const rows=XLSX.utils.sheet_to_json<unknown[]>(book.Sheets['周期项'],{header:1});
    expect(rows).toEqual([['周期第几天','时间','目标','人员','车辆','其他','remark','zone'],[3,'上午','站 A','张三','车','备注','注意','北区']]);
    const buffer=XLSX.write(book,{type:'array',bookType:'xlsx'});
    await expect(parsePatrolDetailExcel(new File([buffer],'patrol.xlsx'))).resolves.toMatchObject([{target:'站 A',cycleDay:3}]);
  });
});
