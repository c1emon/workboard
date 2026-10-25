import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTestDatabase } from "../src/db/database.js";
import { regenerateOperationInstances } from "../src/domain/taskInstanceGeneration.js";
import { getOperationBoardSelection, setOperationBoardSelection } from "../src/domain/operationBoardSelection.js";
import { getBoardSnapshot } from "../src/domain/boardSnapshot.js";
import { createBoardEventBroadcaster } from "../src/routes/boardEvents.js";

function fixture(recurrence = 'infinite') {
  const db = createTestDatabase();
  db.prepare(`insert into task_templates (id,type,name,start_at,end_at,recurrence_type,created_at,updated_at)
    values ('p','operation','计划 P','2030-10-25T08:00:00+08:00','2030-10-30T18:00:00+08:00',?,'now','now')`).run(recurrence);
  const insert = db.prepare(`insert into task_template_items (id,template_id,offset_minutes,duration_minutes,content,sort_order) values (?,'p',?,?,?,?)`);
  insert.run('a', 0, 240, 'A', 0); // A overlaps B, but must be omitted in the first partial cycle.
  insert.run('b', 120, 90, 'B', 1);
  insert.run('c', 330, 30, 'C', 2); // Two-hour gap after B, six-hour cycle.
  return db;
}
function rows(db: ReturnType<typeof fixture>) { return db.prepare('select * from task_instances order by start_at,id').all() as any[]; }
const start = '2030-10-25T10:30:00+08:00';
afterEach(() => vi.useRealTimers());

describe('operation schedule replacement', () => {
  it.each(['finite', 'infinite'])('anchors %s at B, preserves gaps and duration, excludes earlier overlapping children', (type) => {
    const db = fixture(type);
    const before = db.prepare('select * from task_templates').all();
    const itemsBefore = db.prepare('select * from task_template_items').all();
    const result = regenerateOperationInstances(db, 'p', { startAt: start, cutoffAt: '2030-10-25T18:30:00+08:00', startItemId: 'b' });
    expect(result).toEqual({ removed: 0, inserted: 4, skipped: 0 });
    expect(rows(db).map(row => [row.content, row.start_at.slice(11,16)])).toEqual([['B','10:30'],['C','14:00'],['A','14:30'],['B','16:30'],['C','20:00']].slice(0,4));
    expect(db.prepare('select * from task_templates').all()).toEqual(before);
    expect(db.prepare('select * from task_template_items').all()).toEqual(itemsBefore);
    db.close();
  });
  it('supports dense cycles from a selected child without a manual zero point', () => {
    const db=fixture();
    db.prepare("update task_template_items set offset_minutes=0,duration_minutes=60 where id='a'").run();
    db.prepare("update task_template_items set offset_minutes=60,duration_minutes=60 where id='b'").run();
    db.prepare("update task_template_items set offset_minutes=120,duration_minutes=60 where id='c'").run();
    regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-25T13:31:00+08:00',startItemId:'b'});
    expect(rows(db).map(row=>[row.content,row.start_at.slice(11,16)])).toEqual([['B','10:30'],['C','11:30'],['A','12:30'],['B','13:30']]);
    db.close();
  });
  it('uses an exclusive cutoff but retains the full duration', () => {
    const db = fixture();
    expect(regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-25T11:00:00+08:00',startItemId:'b'}).inserted).toBe(1);
    expect(rows(db)[0].end_at).toBe('2030-10-25T12:00:00.000+08:00');
    regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-25T14:00:00+08:00',startItemId:'b'});
    expect(rows(db).map(row=>row.content)).toEqual(['B']);
    db.close();
  });
  it('generates once from cycle zero and rejects child selection', () => {
    const db=fixture('once');
    expect(()=>regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-26T00:00:00+08:00',startItemId:'b'})).toThrow('周期零点');
    expect(regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-26T00:00:00+08:00'}).inserted).toBe(3);
    expect(rows(db)[0].start_at).toBe('2030-10-25T10:30:00.000+08:00');
    db.close();
  });
  it('removes future generated pending work outside the new range, preserves all protected work and deduplicates', () => {
    const db=fixture();
    const input={startAt:start,cutoffAt:'2030-10-28T00:00:00+08:00',startItemId:'b'};
    regenerateOperationInstances(db,'p',input);
    const original=rows(db);
    const statuses=['in_progress','done','cancelled','pending','pending'];
    original.slice(0,5).forEach((row,i)=>db.prepare('update task_instances set status=?,source_type=? where id=?').run(statuses[i],i===3?'manual':i===4?'override':'generated',row.id));
    const protectedRows=rows(db).filter(row=>row.status!=='pending'||row.source_type!=='generated');
    const beforeCount=rows(db).length;
    const result=regenerateOperationInstances(db,'p',{...input,cutoffAt:'2030-10-25T11:00:00+08:00'});
    expect(result).toEqual({removed:beforeCount-5,inserted:0,skipped:1});
    expect(rows(db)).toEqual(protectedRows);
    db.close();
  });
  it('keeps pending instances that have already started and rolls back deletion on insert failure', () => {
    const db=fixture();
    const input={startAt:start,cutoffAt:'2030-10-26T00:00:00+08:00',startItemId:'b'};
    regenerateOperationInstances(db,'p',input);
    const before=rows(db);
    const result=regenerateOperationInstances(db,'p',{...input,cutoffAt:'2030-10-25T11:00:00+08:00'},new Date('2030-10-25T10:45:00+08:00'));
    expect(result.skipped).toBe(1);
    expect(rows(db)[0]).toEqual(before[0]);
    const remaining=rows(db);
    db.exec(`create trigger fail_insert before insert on task_instances begin select raise(abort,'test failure'); end;`);
    expect(()=>regenerateOperationInstances(db,'p',input)).toThrow('test failure');
    expect(rows(db)).toEqual(remaining);
    db.close();
  });
  it('retains occurrence-based holiday and adjusted-workday rules', () => {
    const db=fixture();
    db.prepare('update task_templates set skip_weekends=1,skip_holidays=1').run();
    db.prepare("insert into holidays values ('h','2030-10-26','休','holiday')").run();
    const input={startAt:'2030-10-26T10:30:00+08:00',cutoffAt:'2030-10-26T11:00:00+08:00',startItemId:'b'};
    expect(regenerateOperationInstances(db,'p',input).inserted).toBe(0);
    db.prepare("update holidays set type='adjusted_workday'").run();
    expect(regenerateOperationInstances(db,'p',input).inserted).toBe(1);
    db.close();
  });
});

describe('operation workflow routes and selection', () => {
  it('initializes by full list order, persists empty/missing selection and filters disabled plans', async () => {
    const db=fixture();
    db.prepare(`insert into task_templates select 'q',type,'计划 Q',description,'2031-01-01T00:00:00+08:00',end_at,recurrence_type,recurrence_interval_minutes,recurrence_count,skip_weekends,skip_holidays,enabled,ext_data_json,created_at,updated_at from task_templates where id='p'`).run();
    expect(getOperationBoardSelection(db).planId).toBe('q');
    setOperationBoardSelection(db,'p');
    regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-25T11:00:00+08:00',startItemId:'b'});
    expect(getBoardSnapshot(db,new Date(start)).operation.items).toHaveLength(1);
    db.prepare('update task_templates set enabled=0 where id=?').run('p');
    expect(getOperationBoardSelection(db)).toMatchObject({planId:'p',enabled:false});
    expect(getBoardSnapshot(db,new Date(start)).operation.items).toEqual([]);
    db.prepare("delete from task_templates where id='p'").run();
    expect(getOperationBoardSelection(db)).toMatchObject({planId:'p',exists:false});
    db.close();
  });
  it('does not reinitialize a saved empty selection', () => {
    const db=createTestDatabase();
    expect(getOperationBoardSelection(db).planId).toBeNull();
    db.prepare("insert into board_settings values ('test','value')").run();
    expect(getOperationBoardSelection(db).planId).toBeNull();
    db.close();
  });
  it('notifies multiple boards after saving selection, without changing enablement', async () => {
    const db=fixture(); const events=createBoardEventBroadcaster(); const output1:string[]=[], output2:string[]=[];
    for(const output of [output1,output2]) events.register({writeHead:()=>{},write:(chunk:string)=>{output.push(chunk);}});
    const app=createApp(db,{boardEvents:events});
    db.prepare('update task_templates set enabled=0').run();
    const response=await app.inject({method:'PUT',url:'/api/admin/operation-board-selection',payload:{planId:'p'}});
    expect(response.json()).toMatchObject({planId:'p',enabled:false});
    expect(output1).toHaveLength(2); expect(output2).toEqual(output1);
    const app2=createApp(db); expect((await app2.inject('/api/admin/operation-board-selection')).json().planId).toBe('p');
    await app.close();await app2.close();db.close();
  });
  it('validates all imported rows, replaces only details and rolls back failed writes', async () => {
    const db=fixture();const app=createApp(db);
    regenerateOperationInstances(db,'p',{startAt:start,cutoffAt:'2030-10-25T11:00:00+08:00',startItemId:'b'});
    const planBefore=db.prepare('select * from task_templates').all(); const instancesBefore=rows(db);
    const item={content:'新子任务',offsetMinutes:30,durationMinutes:45,sortOrder:0,extData:{zone:'A',enabled:true}};
    expect((await app.inject({method:'POST',url:'/api/admin/operation-plans/p/items/import',payload:{mode:'replace',items:[item,{...item,durationMinutes:0}]}})).statusCode).toBe(400);
    expect(db.prepare('select count(*) as n from task_template_items').get()).toEqual({n:3});
    db.exec(`create trigger fail_item before insert on task_template_items begin select raise(abort,'test failure'); end;`);
    const fail=await app.inject({method:'POST',url:'/api/admin/operation-plans/p/items/import',payload:{mode:'replace',items:[item]}});
    expect(fail.json().rolledBack).toBe(true);
    expect(db.prepare('select count(*) as n from task_template_items').get()).toEqual({n:3});
    db.exec('drop trigger fail_item');
    expect((await app.inject({method:'POST',url:'/api/admin/operation-plans/p/items/import',payload:{mode:'replace',items:[item]}})).json()).toEqual({imported:1});
    expect(db.prepare('select * from task_templates').all()).toEqual(planBefore);
    expect(rows(db)).toEqual(instancesBefore.map(row=>({...row,source_template_item_id:null})));
    await app.close();db.close();
  });
});
