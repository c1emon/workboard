import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { toChinaOffsetDateTime } from "../domain/dateTime.js";
import { extDataString, extDataTimeTag, parseExtDataJson } from "../domain/taskInstances.js";
import { timeRangeForDateTag } from "../domain/timeTags.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";
import { validateAdminPayload } from "./validation.js";

type TimeTag = "全天" | "上午" | "下午";

const timeTagSchema = z.enum(["全天", "上午", "下午"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid datetime"
});
const resourceIdSchema = z.string().min(1).max(64);

const permitInputSchema = z.object({
  date: dateSchema,
  timeTag: timeTagSchema,
  target: z.string().default(""),
  task: z.string().min(1),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default("")
});

const otherInputSchema = z.object({
  date: dateSchema,
  timeTag: timeTagSchema,
  task: z.string().min(1),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default("")
});

const leaveInputSchema = z.object({
  date: dateSchema,
  name: z.string().min(1)
});

const holidayInputSchema = z.object({
  date: dateSchema,
  name: z.string().default("")
});
const holidayYearQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100)
});
const chineseDaysPayloadSchema = z.object({
  holidays: z.record(dateSchema, z.string()),
  workdays: z.record(dateSchema, z.string()),
  inLieuDays: z.record(dateSchema, z.string()).default({})
});

const templateItemInputSchema = z.object({
  containerId: resourceIdSchema,
  offsetMinutes: z.number().int(),
  durationMinutes: z.number().int(),
  content: z.string().default(""),
  timeTag: timeTagSchema.optional(),
  target: z.string().default(""),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default(""),
  extData: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().default(0)
});

const idParamSchema = z.object({ id: resourceIdSchema });
const arrangementListQuerySchema = z.object({
  date: dateSchema.optional(),
  scope: z.enum(["date", "all"]).default("date")
});
const enabledInputSchema = z.object({ enabled: z.boolean() });
const operationPlanListQuerySchema = z.object({
  date: dateSchema.optional(),
  scope: z.enum(["date", "all"]).default("date")
});
const operationItemInputSchema = templateItemInputSchema.omit({
  containerId: true,
  timeTag: true,
  target: true,
  personnel: true,
  vehicle: true,
  other: true
}).extend({ id: resourceIdSchema.optional() });
const operationPlanInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema.nullable().optional(),
    recurrenceType: z.enum(["once", "finite", "infinite"]),
    recurrenceIntervalMinutes: z.number().int().positive().nullable().optional(),
    recurrenceCount: z.number().int().positive().nullable().optional(),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(false),
    item: operationItemInputSchema.optional()
  })
  .superRefine(validateRecurrenceFields);

interface RecurrenceFieldsInput {
  startAt: string;
  endAt?: string | null;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
}

function validateRecurrenceFields(input: RecurrenceFieldsInput, ctx: z.RefinementCtx): void {
  if (input.recurrenceType === "finite" && !input.endAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "endAt is required for finite recurrence"
    });
  }

  if (input.endAt && new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "endAt must be after startAt"
    });
  }

  if (
    (input.recurrenceType === "finite" || input.recurrenceType === "infinite") &&
    (input.recurrenceIntervalMinutes ?? 0) <= 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurrenceIntervalMinutes"],
      message: "recurrenceIntervalMinutes must be positive"
    });
  }

}
interface OperationPlanDurationRow {
  start_at: string;
  end_at: string;
}

interface ArrangementTaskAdminRow {
  id: string;
  item_id?: string;
  date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
}

interface OperationPlanAdminRow {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  recurrence_type: "once" | "finite" | "infinite";
  recurrence_interval_minutes: number | null;
  recurrence_count: number | null;
  skip_weekends: number;
  skip_holidays: number;
  enabled: number;
  child_task_count: number;
  first_item_content: string | null;
}

interface OperationItemAdminRow {
  id: string;
  offset_minutes: number;
  duration_minutes: number;
  content: string;
  ext_data_json: string;
  sort_order: number;
}

interface LeavePersonAdminRow {
  id: string;
  date: string;
  name: string;
  enabled: number;
}

interface IdRow {
  id: string;
}

interface HolidayAdminRow {
  id: string;
  date: string;
  name: string;
  type: "holiday" | "adjusted_workday";
}

function mapOperationPlanRow(row: OperationPlanAdminRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    recurrenceType: row.recurrence_type,
    recurrenceIntervalMinutes: row.recurrence_interval_minutes,
    recurrenceCount: row.recurrence_count,
    skipWeekends: row.skip_weekends === 1,
    skipHolidays: row.skip_holidays === 1,
    enabled: row.enabled === 1,
    childTaskCount: row.child_task_count,
    firstItemContent: row.first_item_content ?? ""
  };
}

function mapOperationItemRow(row: OperationItemAdminRow) {
  return {
    id: row.id,
    offsetMinutes: row.offset_minutes,
    durationMinutes: row.duration_minutes,
    content: row.content,
    extData: parseExtDataJson(row.ext_data_json),
    sortOrder: row.sort_order
  };
}

function validateOperationItem(input: z.infer<typeof operationPlanInputSchema>) {
  if (!input.item) return { ok: true } as const;
  return validateOperationItemTiming(input.item);
}

function insertOperationItem(db: AppDatabase, templateId: string, input: z.infer<typeof operationItemInputSchema>): string {
  const id = nanoid();
  db.prepare(
    `insert into task_template_items
     (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    templateId,
    input.offsetMinutes,
    input.durationMinutes,
    input.content,
    JSON.stringify(input.extData),
    input.sortOrder
  );
  return id;
}

function updateOperationItem(db: AppDatabase, templateId: string, itemId: string, input: z.infer<typeof operationItemInputSchema>) {
  return db
    .prepare(
      `update task_template_items
       set offset_minutes = ?, duration_minutes = ?, content = ?, ext_data_json = ?, sort_order = ?
       where id = ? and template_id = ?`
    )
    .run(
      input.offsetMinutes,
      input.durationMinutes,
      input.content,
      JSON.stringify(input.extData),
      input.sortOrder,
      itemId,
      templateId
    );
}

function operationPlanDuration(db: AppDatabase, id: string): OperationPlanDurationRow | undefined {
  return db
    .prepare<[string], OperationPlanDurationRow>("select start_at, end_at from task_templates where id = ? and type = 'operation'")
    .get(id);
}

function operationCycleDuration(db: AppDatabase, id: string): number {
  const row = db
    .prepare<[string], { cycle_duration: number | null }>(
      `select max(offset_minutes + duration_minutes) as cycle_duration
       from task_template_items
       where template_id = ?`
    )
    .get(id);
  return row?.cycle_duration ?? 0;
}

function refreshOperationPlanDerivedRecurrence(db: AppDatabase, id: string): void {
  const plan = db
    .prepare<[string], { start_at: string; end_at: string; recurrence_type: "once" | "finite" | "infinite" }>(
      `select start_at, end_at, recurrence_type
       from task_templates
       where id = ? and type = 'operation'`
    )
    .get(id);
  if (!plan) return;

  const cycleDuration = operationCycleDuration(db, id);
  const recurrenceIntervalMinutes = plan.recurrence_type === "once" || cycleDuration <= 0 ? null : cycleDuration;
  const recurrenceCount =
    plan.recurrence_type === "finite" && cycleDuration > 0
      ? Math.ceil((new Date(plan.end_at).getTime() - new Date(plan.start_at).getTime()) / 60_000 / cycleDuration)
      : null;

  db.prepare(
    `update task_templates
     set recurrence_interval_minutes = ?, recurrence_count = ?, updated_at = ?
     where id = ? and type = 'operation'`
  ).run(recurrenceIntervalMinutes, recurrenceCount && recurrenceCount > 0 ? recurrenceCount : null, new Date().toISOString(), id);
}

function validateOperationPlanItem(db: AppDatabase, planId: string, item: z.infer<typeof operationItemInputSchema>) {
  const parent = operationPlanDuration(db, planId);
  if (!parent) {
    return { ok: false, statusCode: 404, message: "Not found" } as const;
  }

  const itemValidation = validateOperationItemTiming(item);
  if (!itemValidation.ok) {
    return { ok: false, statusCode: 400, message: itemValidation.message } as const;
  }

  return { ok: true } as const;
}

function validateOperationItemTiming(item: Pick<z.infer<typeof operationItemInputSchema>, "offsetMinutes" | "durationMinutes">) {
  if (item.offsetMinutes < 0) return { ok: false, message: "offset must be non-negative" } as const;
  if (item.durationMinutes <= 0) return { ok: false, message: "duration must be positive" } as const;
  return { ok: true } as const;
}

function listArrangementTaskRows(
  db: AppDatabase,
  type: "permit" | "other",
  query: z.infer<typeof arrangementListQuerySchema>
): ArrangementTaskAdminRow[] {
  const rows = db
    .prepare<[string], ArrangementTaskAdminRow>(
      `select id, occurrence_date as date, start_at, end_at, content, ext_data_json, status
       from task_instances
       where type = ?
         and source_type = 'manual'
         and template_id is null
         and source_template_item_id is null
         and generation_key is null
       order by start_at, end_at, id`
    )
    .all(type);

  if (query.scope === "all") return rows.reverse();

  const date = query.date as string;
  const window = {
    start: new Date(`${date}T00:00:00+08:00`),
    end: new Date(`${date}T23:59:59.999+08:00`)
  };

  return rows
    .filter((row) => overlapsDateWindow(row.start_at, row.end_at, window))
    .map((row) => ({ ...row, date }));
}

function parseArrangementExtData(raw: string): Record<string, unknown> {
  return parseExtDataJson(raw);
}

function overlapsDateWindow(startAt: string, endAt: string, window: { start: Date; end: Date }): boolean {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  return Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= window.end.getTime() && endMs >= window.start.getTime();
}

function arrangementExtData(input: {
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  extData: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...input.extData,
    timeTag: input.timeTag,
    target: input.target,
    personnel: input.personnel,
    vehicle: input.vehicle,
    other: input.other
  };
}

function mapPermitArrangementTaskRow(row: ArrangementTaskAdminRow) {
  const extData = parseArrangementExtData(row.ext_data_json);
  return {
    id: row.id,
    date: row.date,
    timeTag: extDataTimeTag(extData),
    startAt: row.start_at,
    endAt: row.end_at,
    target: extDataString(extData, "target"),
    task: row.content,
    personnel: extDataString(extData, "personnel"),
    vehicle: extDataString(extData, "vehicle"),
    other: extDataString(extData, "other"),
    enabled: row.status !== "cancelled"
  };
}

function mapOtherArrangementTaskRow(row: ArrangementTaskAdminRow) {
  const extData = parseArrangementExtData(row.ext_data_json);
  return {
    id: row.id,
    date: row.date,
    timeTag: extDataTimeTag(extData),
    startAt: row.start_at,
    endAt: row.end_at,
    task: extDataString(extData, "target") || row.content,
    personnel: extDataString(extData, "personnel"),
    vehicle: extDataString(extData, "vehicle"),
    other: extDataString(extData, "other"),
    enabled: row.status !== "cancelled"
  };
}

function createManualArrangementInstance(
  db: AppDatabase,
  input: {
    type: "permit" | "other";
    date: string;
    timeTag: "全天" | "上午" | "下午";
    content: string;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    extData: Record<string, unknown>;
  }
): { id: string } {
  const id = nanoid();
  const now = new Date().toISOString();
  const range = timeRangeForDateTag(input.date, input.timeTag);
  const startAt = toChinaOffsetDateTime(range.startAt);
  const endAt = toChinaOffsetDateTime(range.endAt);

  db.prepare(
    `insert into task_instances
     (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
      start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
     values (?, ?, null, null, 'manual', null, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(
    id,
    input.type,
    input.date,
    startAt,
    endAt,
    input.content,
    JSON.stringify(arrangementExtData(input)),
    now,
    now
  );

  return { id };
}

function updateManualArrangementInstance(
  db: AppDatabase,
  id: string,
  input: {
    type: "permit" | "other";
    date: string;
    timeTag: "全天" | "上午" | "下午";
    content: string;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    extData: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  const range = timeRangeForDateTag(input.date, input.timeTag);
  const startAt = toChinaOffsetDateTime(range.startAt);
  const endAt = toChinaOffsetDateTime(range.endAt);
  return db
    .prepare(
      `update task_instances
       set occurrence_date = ?, start_at = ?, end_at = ?, content = ?, ext_data_json = ?, updated_at = ?
       where id = ? and type = ?
         and source_type = 'manual'
         and template_id is null
         and source_template_item_id is null
         and generation_key is null`
    )
    .run(input.date, startAt, endAt, input.content, JSON.stringify(arrangementExtData(input)), now, id, input.type);
}

function updateArrangementEnabled(db: AppDatabase, id: string, type: "permit" | "other", enabled: boolean) {
  return db
    .prepare(
      `update task_instances
       set status = case
         when ? = 0 then 'cancelled'
         when status = 'cancelled' then 'pending'
         else status
       end,
       updated_at = ?
       where id = ? and type = ?
         and source_type = 'manual'
         and template_id is null
         and source_template_item_id is null
         and generation_key is null`
    )
    .run(enabled ? 1 : 0, new Date().toISOString(), id, type);
}

function chineseDaysName(value: string): string {
  const [, chineseName] = value.split(",");
  return chineseName?.trim() || value.trim();
}

function hasDuplicateLeavePerson(db: AppDatabase, date: string, name: string, excludeId?: string): boolean {
  const row = excludeId
    ? db
        .prepare<[string, string, string], IdRow>("select id from leave_people where date = ? and name = ? and id <> ?")
        .get(date, name, excludeId)
    : db.prepare<[string, string], IdRow>("select id from leave_people where date = ? and name = ?").get(date, name);
  return row !== undefined;
}

function validateArrangementListQuery(query: unknown) {
  const validation = validateAdminPayload(arrangementListQuerySchema, query);
  if (!validation.success) return validation;
  if (validation.data.scope === "date" && !validation.data.date) {
    return {
      success: false,
      error: {
        error: "Invalid admin payload",
        issues: [{ code: z.ZodIssueCode.custom, path: ["date"], message: "Required when scope is date" }]
      }
    } as const;
  }
  return validation;
}

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/permit-arrangements", async (request, reply) => {
    const validation = validateArrangementListQuery(request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = listArrangementTaskRows(db, "permit", validation.data);

    return rows.map((row) => ({
      ...mapPermitArrangementTaskRow(row)
    }));
  });

  app.post("/api/admin/permit-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(permitInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const { id } = createManualArrangementInstance(db, {
      type: "permit",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.target,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      extData: {}
    });
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/permit-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(permitInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const result = updateManualArrangementInstance(db, params.data.id, {
      type: "permit",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.target,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      extData: {}
    });
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id };
  });

  app.patch("/api/admin/permit-arrangements/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = updateArrangementEnabled(db, params.data.id, "permit", validation.data.enabled);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/permit-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db
      .prepare(
        `delete from task_instances
         where id = ? and type = 'permit'
           and source_type = 'manual'
           and template_id is null
           and source_template_item_id is null
           and generation_key is null`
      )
      .run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/other-arrangements", async (request, reply) => {
    const validation = validateArrangementListQuery(request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = listArrangementTaskRows(db, "other", validation.data);

    return rows.map((row) => ({
      ...mapOtherArrangementTaskRow(row)
    }));
  });

  app.post("/api/admin/other-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(otherInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const { id } = createManualArrangementInstance(db, {
      type: "other",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.task,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      extData: {}
    });
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/other-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(otherInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const result = updateManualArrangementInstance(db, params.data.id, {
      type: "other",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.task,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      extData: {}
    });
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id };
  });

  app.patch("/api/admin/other-arrangements/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = updateArrangementEnabled(db, params.data.id, "other", validation.data.enabled);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/other-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db
      .prepare(
        `delete from task_instances
         where id = ? and type = 'other'
           and source_type = 'manual'
           and template_id is null
           and source_template_item_id is null
           and generation_key is null`
      )
      .run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/leave-people", async (request, reply) => {
    const validation = validateArrangementListQuery(request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows =
      validation.data.scope === "all"
        ? db
            .prepare<[], LeavePersonAdminRow>(
              `select id, date, name, enabled
               from leave_people
               order by date desc, sort_order, name`
            )
            .all()
        : db
            .prepare<[string], LeavePersonAdminRow>(
              `select id, date, name, enabled
               from leave_people
               where date = ?
               order by sort_order, name`
            )
            .all(validation.data.date as string);

    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      enabled: row.enabled === 1
    }));
  });

  app.post("/api/admin/leave-people", async (request, reply) => {
    const validation = validateAdminPayload(leaveInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();
    if (hasDuplicateLeavePerson(db, input.date, input.name)) {
      return reply.code(409).send({ error: "Duplicate leave person" });
    }

    db.prepare("insert into leave_people (id, date, name) values (?, ?, ?)").run(id, input.date, input.name);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/leave-people/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(leaveInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    if (hasDuplicateLeavePerson(db, input.date, input.name, params.data.id)) {
      return reply.code(409).send({ error: "Duplicate leave person" });
    }

    const result = db.prepare("update leave_people set date = ?, name = ? where id = ?").run(input.date, input.name, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id };
  });

  app.patch("/api/admin/leave-people/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = db.prepare("update leave_people set enabled = ? where id = ?").run(validation.data.enabled ? 1 : 0, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/leave-people/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from leave_people where id = ?").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/holidays", async (request, reply) => {
    const validation = validateAdminPayload(holidayYearQuerySchema, request.query);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const yearPrefix = `${validation.data.year}-`;
    const rows = db
      .prepare<[string], HolidayAdminRow>(
        `select id, date, name, type
         from holidays
         where date like ?
         order by date, type`
      )
      .all(`${yearPrefix}%`);

    return rows;
  });

  app.post("/api/admin/holidays/import", async (request, reply) => {
    const validation = validateAdminPayload(chineseDaysPayloadSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const importHolidays = db.transaction(() => {
      db.prepare("delete from holidays").run();
      const insert = db.prepare("insert into holidays (id, date, name, type) values (?, ?, ?, ?)");
      let holidayCount = 0;
      let adjustedWorkdayCount = 0;
      const holidaysByDate = new Map<string, string>(Object.entries(input.holidays));

      for (const [date, name] of Object.entries(input.inLieuDays)) {
        if (!holidaysByDate.has(date)) holidaysByDate.set(date, name);
      }

      for (const [date, name] of [...holidaysByDate.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        insert.run(nanoid(), date, chineseDaysName(name), "holiday");
        holidayCount += 1;
      }

      for (const [date, name] of Object.entries(input.workdays).sort(([left], [right]) => left.localeCompare(right))) {
        insert.run(nanoid(), date, chineseDaysName(name), "adjusted_workday");
        adjustedWorkdayCount += 1;
      }

      return {
        imported: holidayCount + adjustedWorkdayCount,
        holidays: holidayCount,
        adjustedWorkdays: adjustedWorkdayCount
      };
    });

    const result = importHolidays();
    boardEvents.publish();
    return result;
  });

  app.post("/api/admin/holidays", async (request, reply) => {
    const validation = validateAdminPayload(holidayInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();

    db.prepare("insert into holidays (id, date, name, type) values (?, ?, ?, 'holiday')").run(id, input.date, input.name);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.get("/api/admin/operation-plans", async (request, reply) => {
    const validation = validateAdminPayload(operationPlanListQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);
    if (validation.data.scope === "date" && !validation.data.date) {
      return reply.code(400).send({
        error: "Invalid admin payload",
        issues: [{ path: ["date"], message: "Required when scope is date" }]
      });
    }

    const baseSql = `select c.id, c.name, c.description, c.start_at, c.end_at, c.recurrence_type,
              c.recurrence_interval_minutes, c.recurrence_count, c.skip_weekends, c.skip_holidays, c.enabled,
              count(i.id) as child_task_count,
              (
                select first.content
                from task_template_items first
                where first.template_id = c.id
                order by first.sort_order, first.offset_minutes
                limit 1
              ) as first_item_content
       from task_templates c
       left join task_template_items i on i.template_id = c.id
       where c.type = 'operation'`;
    const sql =
      validation.data.scope === "all"
        ? `${baseSql}
           group by c.id
           order by c.start_at desc, c.name`
	        : `${baseSql}
	           and julianday(c.start_at) <= julianday(?)
	           and (
	             c.recurrence_type = 'infinite'
	             or (
	               c.recurrence_type = 'once'
	               and julianday(c.start_at) + coalesce((
	                 select max(child.offset_minutes + child.duration_minutes)
	                 from task_template_items child
	                 where child.template_id = c.id
	               ), 0) / 1440.0 >= julianday(?)
	             )
	             or (
	               c.recurrence_type = 'finite'
	               and julianday(c.end_at) >= julianday(?)
	             )
	           )
	           group by c.id
	           order by c.start_at, c.name`;

    const rows =
      validation.data.scope === "all"
        ? db.prepare<[], OperationPlanAdminRow>(sql).all()
        : db
            .prepare<[string, string, string], OperationPlanAdminRow>(sql)
            .all(
              `${validation.data.date}T23:59:59+08:00`,
              `${validation.data.date}T00:00:00+08:00`,
              `${validation.data.date}T00:00:00+08:00`
            );

    return rows.map(mapOperationPlanRow);
  });

  app.get("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const row = db
      .prepare<[string], OperationPlanAdminRow>(
        `select c.id, c.name, c.description, c.start_at, c.end_at, c.recurrence_type,
                c.recurrence_interval_minutes, c.recurrence_count, c.skip_weekends, c.skip_holidays, c.enabled,
                count(i.id) as child_task_count,
                (
                  select first.content
                  from task_template_items first
                  where first.template_id = c.id
                  order by first.sort_order, first.offset_minutes
                  limit 1
                ) as first_item_content
         from task_templates c
         left join task_template_items i on i.template_id = c.id
         where c.id = ? and c.type = 'operation'
         group by c.id`
      )
      .get(params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });

    const items = db
      .prepare<[string], OperationItemAdminRow>(
        `select id, offset_minutes, duration_minutes, content, ext_data_json, sort_order
         from task_template_items
         where template_id = ?
         order by sort_order, offset_minutes`
      )
      .all(params.data.id);

    return { ...mapOperationPlanRow(row), items: items.map(mapOperationItemRow) };
  });

  app.post("/api/admin/operation-plans", async (request, reply) => {
    const validation = validateAdminPayload(operationPlanInputSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const itemValidation = validateOperationItem(input);
    if (!itemValidation.ok) {
      return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    }

    const id = nanoid();
    const now = new Date().toISOString();
    const storedEndAt = input.endAt ?? input.startAt;
    db.prepare(
      `insert into task_templates
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json, created_at, updated_at)
       values (?, 'operation', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '{}', ?, ?)`
    ).run(
      id,
      input.name,
      input.description,
      input.startAt,
      storedEndAt,
      input.recurrenceType,
      input.recurrenceIntervalMinutes ?? null,
      input.recurrenceCount ?? null,
      input.skipWeekends ? 1 : 0,
      input.skipHolidays ? 1 : 0,
      now,
      now
    );
    if (input.item) insertOperationItem(db, id, input.item);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(operationPlanInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const itemValidation = validateOperationItem(input);
    if (!itemValidation.ok) {
      return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    }
    const existingPlan = operationPlanDuration(db, params.data.id);
    if (!existingPlan) return reply.code(404).send({ error: "Not found" });
    if (input.item?.id) {
      const existingItem = db
        .prepare<[string, string], { id: string }>("select id from task_template_items where id = ? and template_id = ?")
        .get(input.item.id, params.data.id);
      if (!existingItem) return reply.code(404).send({ error: "Not found" });
    }

    const now = new Date().toISOString();
    const storedEndAt = input.endAt ?? input.startAt;
    const result = db
      .prepare(
        `update task_templates
         set name = ?, description = ?, start_at = ?, end_at = ?, recurrence_type = ?,
             recurrence_interval_minutes = ?, recurrence_count = ?, skip_weekends = ?, skip_holidays = ?, updated_at = ?
         where id = ? and type = 'operation'`
      )
      .run(
        input.name,
        input.description,
        input.startAt,
        storedEndAt,
        input.recurrenceType,
        input.recurrenceIntervalMinutes ?? null,
        input.recurrenceCount ?? null,
        input.skipWeekends ? 1 : 0,
        input.skipHolidays ? 1 : 0,
        now,
        params.data.id
      );
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });

    if (input.item) {
      if (input.item.id) {
        const itemResult = updateOperationItem(db, params.data.id, input.item.id, input.item);
        if (itemResult.changes === 0) return reply.code(404).send({ error: "Not found" });
      } else {
        insertOperationItem(db, params.data.id, input.item);
      }
      refreshOperationPlanDerivedRecurrence(db, params.data.id);
    }
    boardEvents.publish();

    return { id: params.data.id };
  });

  app.patch("/api/admin/operation-plans/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = db
      .prepare("update task_templates set enabled = ?, updated_at = ? where id = ? and type = 'operation'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_templates where id = ? and type = 'operation'").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.post("/api/admin/operation-plans/:id/items", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(operationItemInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const itemValidation = validateOperationPlanItem(db, params.data.id, validation.data);
    if (!itemValidation.ok) {
      if (itemValidation.statusCode === 404) return reply.code(404).send({ error: itemValidation.message });
      return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    }

    const id = insertOperationItem(db, params.data.id, validation.data);
    refreshOperationPlanDerivedRecurrence(db, params.data.id);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/operation-plans/:id/items/:itemId", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema.extend({ itemId: resourceIdSchema }), request.params);
    const validation = validateAdminPayload(operationItemInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const itemValidation = validateOperationPlanItem(db, params.data.id, validation.data);
    if (!itemValidation.ok) {
      if (itemValidation.statusCode === 404) return reply.code(404).send({ error: itemValidation.message });
      return reply.code(400).send({ error: "Invalid admin payload", message: itemValidation.message });
    }

    const result = updateOperationItem(db, params.data.id, params.data.itemId, validation.data);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    refreshOperationPlanDerivedRecurrence(db, params.data.id);
    boardEvents.publish();

    return { id: params.data.itemId };
  });

  app.delete("/api/admin/operation-plans/:id/items/:itemId", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema.extend({ itemId: resourceIdSchema }), request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const plan = operationPlanDuration(db, params.data.id);
    if (!plan) return reply.code(404).send({ error: "Not found" });

    const result = db.prepare("delete from task_template_items where id = ? and template_id = ?").run(params.data.itemId, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    refreshOperationPlanDerivedRecurrence(db, params.data.id);
    boardEvents.publish();

    return reply.code(204).send();
  });

}
