import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from '../web/node_modules/xlsx/xlsx.mjs';
const api='http://127.0.0.1:4100/api/admin';

async function seed(request:any,name:string,recurrenceType='infinite') {
  const start=new Date(Date.now()+8*3600_000).toISOString().slice(0,10)+'T08:00:00+08:00';
  const response=await request.post(`${api}/operation-plans`,{data:{name,description:'端到端测试',startAt:start,endAt:null,recurrenceType,recurrenceIntervalMinutes:240,skipWeekends:false,skipHolidays:false}});
  expect(response.ok()).toBeTruthy();const {id}=await response.json();
  for(const [i,content] of ['A 操作','B 操作'].entries()) {
    const item=await request.post(`${api}/operation-plans/${id}/items`,{data:{content,offsetMinutes:i*180,durationMinutes:60,sortOrder:i,extData:{zone:'北区'}}});
    expect(item.ok()).toBeTruthy();
  }
  return id;
}

test('single-plan generation, keyboard confirmation, global selection and complete XLSX exchange',async({page,request,context})=>{
  const id=await seed(request,'流程验收计划');
  await page.setViewportSize({width:1440,height:1000});await page.goto('/admin');
  await page.locator('.section-nav button',{hasText:'操作'}).click();
  await page.getByRole('tab',{name:'操作计划',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'流程验收计划'});
  await row.getByRole('button',{name:'流程验收计划 更多操作'}).focus();await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem',{name:'重新生成实例'})).toBeFocused();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog).toContainText('流程验收计划');
  await dialog.locator('select[name="generationStartItem"]').selectOption({label:'2. B 操作 · 时长 60 分钟'});
  const date=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
  await dialog.locator('[name="generationStartAt"]').fill(`${date}T10:30`);
  await dialog.locator('[name="generationCutoffAt"]').fill(`${date}T11:00`);
  await dialog.getByRole('button',{name:'下一步'}).click();
  await expect(dialog.getByRole('button',{name:'返回修改'})).toBeFocused();await expect(dialog).toContainText('包括本次生成范围之外的旧安排');
  await dialog.getByRole('button',{name:'确认替换并生成'}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('新增 1 条');
  await row.getByRole('radio').check();await expect(page.locator('.selection-summary')).toContainText('流程验收计划');
  const board=await context.newPage();await board.goto('/board');
  // Snapshot filtering is independent of whether the current timeline window includes 10:30 today.
  const snapshot=await request.get('http://127.0.0.1:4100/api/board');
  expect((await snapshot.json()).operation.items.every((item:any)=>item.content==='B 操作')).toBe(true);
  await row.getByRole('button',{name:'流程验收计划 更多操作'}).click();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('menuitem',{name:'导出计划 XLSX'}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/^操作计划-流程验收计划-\d{8}\.xlsx$/);
  const book=XLSX.read(readFileSync((await download.path())!), {type:'buffer'});expect(book.SheetNames).toEqual(['计划信息','子任务']);
  expect(XLSX.utils.sheet_to_json(book.Sheets['子任务'])).toHaveLength(2);
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([['任务内容','开始偏移（分钟）','持续时间（分钟）','zone'],['导入的新操作',0,90,'南区']]),'子任务');
  await row.getByRole('button',{name:'流程验收计划 更多操作'}).click();await page.getByRole('menuitem',{name:'导入子任务'}).click();
  await dialog.locator('input[type="file"]').setInputFiles({name:'replacement.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(workbook,{type:'buffer',bookType:'xlsx'})});
  await expect(dialog).toContainText('校验通过：共 1 项');await expect(dialog).toContainText('覆盖当前全部 2 项');
  await dialog.getByRole('button',{name:'确认覆盖'}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText('已覆盖导入 1 项；已生成实例未修改')).toBeVisible();
  const saved=await request.get(`${api}/operation-plans/${id}`);expect((await saved.json()).items[0].content).toBe('导入的新操作');
  const instances=await request.get(`${api}/task-instances?scope=all&type=operation`);expect((await instances.json()).find((item:any)=>item.templateId===id).content).toBe('B 操作');
  await request.patch(`${api}/operation-plans/${id}/enabled`,{data:{enabled:false}});await expect(board.getByText('无可展示计划')).toBeVisible();
  await board.close();
});

test('menus and workflow dialogs fit desktop, breakpoint and narrow screens with keyboard focus restoration',async({page,request})=>{
  await seed(request,'窄屏验收计划','once');
  await page.goto('/admin');await page.locator('.section-nav button',{hasText:'操作'}).click();
  await page.getByRole('tab',{name:'操作计划',exact:true}).click();
  for(const width of [1440,900,375]) {
    await page.setViewportSize({width,height:800});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const trigger=page.getByRole('button',{name:'窄屏验收计划 更多操作'});await trigger.scrollIntoViewIfNeeded();await trigger.click();
    const menu=page.getByRole('menu');const box=await menu.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Enter');const dialog=page.getByRole('dialog');await expect(dialog).toContainText('周期零点（整轮开始）');await expect(dialog.locator('[name="generationStartItem"]')).toHaveCount(0);
    const bounds=await dialog.boundingBox();expect(bounds!.width).toBeLessThanOrEqual(Math.min(640,width-36));expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(800);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
  }
});

test('patrol imports use one active preview dialog and refresh the saved detail before export',async({page,request})=>{
  const date=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
  const response=await request.post(`${api}/patrol-plans`,{data:{name:'巡视文件验收',description:'周期项交换',startAt:date+'T00:00:00+08:00',recurrenceType:'infinite'}});
  expect(response.ok()).toBeTruthy();const {id}=await response.json();
  await request.post(`${api}/patrol-plans/${id}/items`,{data:{cycleDay:1,timeTag:'上午',target:'原目标',personnel:'甲',vehicle:'',other:'',sortOrder:0}});
  await page.goto('/admin');await page.locator('.section-nav button',{hasText:'巡视'}).click();await page.getByRole('tab',{name:'巡视模板'}).click();
  const row=page.getByRole('row').filter({hasText:'巡视文件验收'});await row.getByRole('button',{name:'周期项管理'}).click();
  const manager=page.locator('.patrol-item-manager-modal');await manager.getByRole('button',{name:'导入周期项',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'导入巡视周期项'});await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'取消'})).toBeFocused();
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['周期第几天','时间','目标','人员','车辆','其他'],[3,'下午','新目标','乙','车','备注']]),'周期项');
  await dialog.locator('input[type="file"]').setInputFiles({name:'patrol.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})});
  await expect(dialog).toContainText('校验通过：共 1 项');await dialog.getByRole('button',{name:'确认覆盖'}).click();await expect(dialog).toHaveCount(0);
  await expect(manager.getByRole('cell',{name:'新目标'})).toBeVisible();await expect(manager.getByRole('status')).toHaveText('已覆盖导入 1 项；已生成实例未修改');
  const downloadPromise=page.waitForEvent('download');await manager.getByRole('button',{name:'导出计划 XLSX'}).click();const download=await downloadPromise;
  const exported=XLSX.read(readFileSync((await download.path())!),{type:'buffer'});expect(exported.SheetNames).toEqual(['计划信息','周期项']);
  expect(XLSX.utils.sheet_to_json(exported.Sheets['周期项'])).toMatchObject([{目标:'新目标',周期第几天:3}]);
});

test('operation and patrol tabs keep task types and show-all filters separate',async({page,request})=>{
  const date=new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
  for(const [type,content] of [['operation','TAB 操作专属实例'],['patrol','TAB 巡视专属实例']]){
    const result=await request.post(`${api}/task-instances`,{data:{type,content,startAt:date+'T10:30:00+08:00',endAt:date+'T11:45:00+08:00',extData:{personnel:'测试'}}});expect(result.ok()).toBeTruthy();
  }
  await page.goto('/admin');await page.locator('.section-nav button',{hasText:'操作'}).click();
  await expect(page.getByRole('tab',{name:'任务实例',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tab',{name:'操作计划',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'TAB 操作专属实例',exact:true})).toBeVisible();
  await expect(page.getByRole('cell',{name:'TAB 巡视专属实例',exact:true})).toHaveCount(0);
  await expect(page.getByRole('columnheader',{name:'开始时间（北京时间）'})).toBeVisible();
  await page.getByRole('checkbox',{name:'显示全部'}).check();
  await page.getByRole('tab',{name:'操作计划',exact:true}).click();await expect(page.getByRole('checkbox',{name:'显示全部'})).not.toBeChecked();
  await page.getByRole('tab',{name:'任务实例',exact:true}).click();await expect(page.getByRole('checkbox',{name:'显示全部'})).toBeChecked();
  await page.getByRole('button',{name:'重新生成实例',exact:true}).click();await expect(page.getByRole('dialog',{name:'重新生成实例'})).toContainText('操作计划');await page.keyboard.press('Escape');
  await page.locator('.section-nav button',{hasText:'巡视'}).click();await expect(page.getByRole('tab',{name:'巡视模板',exact:true})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'显示全部'})).not.toBeChecked();
  await expect(page.getByRole('cell',{name:'TAB 巡视专属实例',exact:true})).toBeVisible();await expect(page.getByRole('cell',{name:'TAB 操作专属实例',exact:true})).toHaveCount(0);
});

test('switching a child start reference recalculates the offset and preserves the stored position',async({page,request})=>{
  const id=await seed(request,'基准换算验收');
  const original=await (await request.get(`${api}/operation-plans/${id}`)).json();
  const a=original.items.find((item:any)=>item.content==='A 操作');const b=original.items.find((item:any)=>item.content==='B 操作');
  for(const [item,offsetMinutes,durationMinutes] of [[a,0,1440],[b,1440,510]] as const){
    const result=await request.put(`${api}/operation-plans/${id}/items/${item.id}`,{data:{...item,offsetMinutes,durationMinutes}});expect(result.ok()).toBeTruthy();
  }
  await page.goto('/admin');await page.locator('.section-nav button',{hasText:'操作'}).click();await page.getByRole('tab',{name:'操作计划',exact:true}).click();
  await page.getByRole('row').filter({hasText:'基准换算验收'}).getByRole('button',{name:'修改',exact:true}).click();
  await page.locator('.operation-modal .vis-item-content').filter({hasText:'B 操作'}).click();
  const dialog=page.locator('.operation-item-modal');await expect(dialog).toBeVisible();
  await expect(dialog.locator('[name="operationItemOffsetHours"]')).toHaveValue('24');
  await dialog.locator('[name="operationItemBaseItem"]').selectOption(a.id);
  await expect(dialog.locator('[name="operationItemOffsetHours"]')).toHaveValue('0');await expect(dialog.locator('[name="operationItemOffsetMinutes"]')).toHaveValue('0');
  await dialog.locator('[name="operationItemBaseItem"]').selectOption('');await expect(dialog.locator('[name="operationItemOffsetHours"]')).toHaveValue('24');
  await dialog.locator('[name="operationItemBaseItem"]').selectOption(a.id);
  await dialog.getByRole('button',{name:'保存',exact:true}).click();await expect(dialog).toHaveCount(0);
  const saved=await (await request.get(`${api}/operation-plans/${id}`)).json();
  expect(saved.items.find((item:any)=>item.id===b.id)).toMatchObject({offsetMinutes:1440,durationMinutes:510,extData:{zone:'北区'}});
});
