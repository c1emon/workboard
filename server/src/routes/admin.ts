import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { validateTaskItem } from "../domain/taskExpansion.js";
import { durationMinutesForRange, timeRangeForDateTag } from "../domain/timeTags.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

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

const patrolArrangementInputSchema = z.object({
  date: dateSchema,
  timeTag: timeTagSchema,
  target: z.string().min(1),
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

const taskContainerInputSchema = z
  .object({
    type: z.enum(["operation", "permit", "patrol", "other"]),
    name: z.string().min(1),
    description: z.string().default(""),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    recurrenceType: z.enum(["once", "finite", "infinite"]),
    recurrenceIntervalMinutes: z.number().int().positive().nullable().optional(),
    recurrenceCount: z.number().int().positive().nullable().optional(),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(false)
  })
  .superRefine(validateRecurrenceFields);

const taskItemInputSchema = z.object({
  containerId: resourceIdSchema,
  offsetMinutes: z.number().int(),
  durationMinutes: z.number().int(),
  content: z.string().default(""),
  timeTag: timeTagSchema.optional(),
  target: z.string().default(""),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default(""),
  metadata: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().default(0)
});

const idParamSchema = z.object({ id: resourceIdSchema });
const dateQuerySchema = z.object({ date: dateSchema });
const arrangementListQuerySchema = z.object({
  date: dateSchema.optional(),
  scope: z.enum(["date", "all"]).default("date")
});
const enabledInputSchema = z.object({ enabled: z.boolean() });
const operationPlanListQuerySchema = z.object({
  date: dateSchema.optional(),
  scope: z.enum(["date", "all"]).default("date")
});
const operationItemInputSchema = taskItemInputSchema.omit({
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
    endAt: dateTimeSchema,
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
  endAt: string;
  recurrenceType: "once" | "finite" | "infinite";
  recurrenceIntervalMinutes?: number | null;
  recurrenceCount?: number | null;
}

function validateRecurrenceFields(input: RecurrenceFieldsInput, ctx: z.RefinementCtx): void {
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
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

  if (input.recurrenceType === "finite" && (input.recurrenceCount ?? 0) <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurrenceCount"],
      message: "recurrenceCount must be positive"
    });
  }
}
interface TaskContainerDurationRow {
  start_at: string;
  end_at: string;
}

interface ArrangementTaskAdminRow {
  id: string;
  item_id: string;
  date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  enabled: number;
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

interface PatrolArrangementAdminRow {
  id: string;
  item_id: string;
  date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  enabled: number;
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

function validateAdminPayload<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown
): { success: true; data: z.infer<TSchema> } | { success: false; error: { error: string; issues: z.ZodIssue[] } } {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      error: {
        error: "Invalid admin payload",
        issues: result.error.issues
      }
    };
  }

  return { success: true, data: result.data };
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
    metadata: JSON.parse(row.ext_data_json) as Record<string, unknown>,
    sortOrder: row.sort_order
  };
}

function validateOperationItem(input: z.infer<typeof operationPlanInputSchema>) {
  if (!input.item) return { ok: true } as const;
  const parentDurationMinutes = Math.floor((new Date(input.endAt).getTime() - new Date(input.startAt).getTime()) / 60_000);
  return validateTaskItem(parentDurationMinutes, input.item);
}

function insertOperationItem(db: AppDatabase, containerId: string, input: z.infer<typeof operationItemInputSchema>): string {
  const id = nanoid();
  db.prepare(
    `insert into task_items
     (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
     values (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    containerId,
    input.offsetMinutes,
    input.durationMinutes,
    input.content,
    JSON.stringify(input.metadata),
    input.sortOrder
  );
  return id;
}

function listArrangementTaskRows(
  db: AppDatabase,
  type: "permit" | "patrol" | "other",
  query: z.infer<typeof arrangementListQuerySchema>
): ArrangementTaskAdminRow[] {
  return query.scope === "all"
    ? db
        .prepare<[string], ArrangementTaskAdminRow>(
          `select c.id, i.id as item_id, substr(c.start_at, 1, 10) as date, c.start_at, c.end_at,
                  i.content, i.ext_data_json, c.enabled
           from task_containers c
           join task_items i on i.container_id = c.id
           where c.type = ?
           order by c.start_at desc, i.sort_order, i.offset_minutes`
        )
        .all(type)
    : db
        .prepare<[string, string, string, string], ArrangementTaskAdminRow>(
          `select c.id, i.id as item_id, ? as date, c.start_at, c.end_at,
                  i.content, i.ext_data_json, c.enabled
           from task_containers c
           join task_items i on i.container_id = c.id
           where c.type = ?
             and c.start_at <= ?
             and c.end_at >= ?
           order by c.start_at, i.sort_order, i.offset_minutes`
        )
        .all(query.date as string, type, `${query.date as string}T23:59:59+08:00`, `${query.date as string}T00:00:00+08:00`);
}

function parseArrangementMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function metadataTimeTag(metadata: Record<string, unknown>): TimeTag {
  const value = metadata.timeTag;
  return value === "上午" || value === "下午" || value === "全天" ? value : "全天";
}

function arrangementMetadata(input: {
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  metadata: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...input.metadata,
    timeTag: input.timeTag,
    target: input.target,
    personnel: input.personnel,
    vehicle: input.vehicle,
    other: input.other
  };
}

function mapPermitArrangementTaskRow(row: ArrangementTaskAdminRow) {
  const metadata = parseArrangementMetadata(row.ext_data_json);
  return {
    id: row.id,
    date: row.date,
    timeTag: metadataTimeTag(metadata),
    startAt: row.start_at,
    endAt: row.end_at,
    target: metadataString(metadata, "target"),
    task: row.content,
    personnel: metadataString(metadata, "personnel"),
    vehicle: metadataString(metadata, "vehicle"),
    other: metadataString(metadata, "other"),
    enabled: row.enabled === 1
  };
}

function mapOtherArrangementTaskRow(row: ArrangementTaskAdminRow) {
  const metadata = parseArrangementMetadata(row.ext_data_json);
  return {
    id: row.id,
    date: row.date,
    timeTag: metadataTimeTag(metadata),
    startAt: row.start_at,
    endAt: row.end_at,
    task: metadataString(metadata, "target") || row.content,
    personnel: metadataString(metadata, "personnel"),
    vehicle: metadataString(metadata, "vehicle"),
    other: metadataString(metadata, "other"),
    enabled: row.enabled === 1
  };
}

function mapPatrolArrangementTaskRow(row: ArrangementTaskAdminRow) {
  const metadata = parseArrangementMetadata(row.ext_data_json);
  return {
    id: row.id,
    itemId: row.item_id,
    date: row.date,
    timeTag: metadataTimeTag(metadata),
    startAt: row.start_at,
    endAt: row.end_at,
    target: metadataString(metadata, "target") || row.content,
    personnel: metadataString(metadata, "personnel"),
    vehicle: metadataString(metadata, "vehicle"),
    other: metadataString(metadata, "other"),
    enabled: row.enabled === 1
  };
}

function createSingleItemArrangement(
  db: AppDatabase,
  input: {
    type: "permit" | "patrol" | "other";
    name: string;
    description: string;
    date: string;
    timeTag: "全天" | "上午" | "下午";
    content: string;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    metadata: Record<string, unknown>;
  }
): { id: string; itemId: string } {
  const id = nanoid();
  const itemId = nanoid();
  const now = new Date().toISOString();
  const { startAt, endAt } = timeRangeForDateTag(input.date, input.timeTag);
  const durationMinutes = durationMinutesForRange(startAt, endAt);

  db.transaction(() => {
    db.prepare(
      `insert into task_containers
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'once', null, null, 0, 0, 1, ?, ?)`
    ).run(id, input.type, input.name, input.description, startAt, endAt, now, now);
    db.prepare(
      `insert into task_items
       (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
       values (?, ?, 0, ?, ?, ?, 0)`
    ).run(
      itemId,
      id,
      durationMinutes,
      input.content,
      JSON.stringify(arrangementMetadata(input))
    );
  })();

  return { id, itemId };
}

function updateSingleItemArrangement(
  db: AppDatabase,
  id: string,
  input: {
    type: "permit" | "patrol" | "other";
    date: string;
    timeTag: "全天" | "上午" | "下午";
    content: string;
    target: string;
    personnel: string;
    vehicle: string;
    other: string;
    metadata: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  const { startAt, endAt } = timeRangeForDateTag(input.date, input.timeTag);
  const durationMinutes = durationMinutesForRange(startAt, endAt);
  return db.transaction(() => {
    const result = db
      .prepare("update task_containers set start_at = ?, end_at = ?, updated_at = ? where id = ? and type = ?")
      .run(startAt, endAt, now, id, input.type);
    if (result.changes === 0) return result;

    db.prepare(
      `update task_items
       set offset_minutes = 0, duration_minutes = ?, content = ?, ext_data_json = ?
       where container_id = ?`
    ).run(
      durationMinutes,
      input.content,
      JSON.stringify(arrangementMetadata(input)),
      id
    );
    return result;
  })();
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
    const { id } = createSingleItemArrangement(db, {
      type: "permit",
      name: "许可",
      description: "许可安排",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.target,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      metadata: {}
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
    const result = updateSingleItemArrangement(db, params.data.id, {
      type: "permit",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.target,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      metadata: {}
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

    const result = db
      .prepare("update task_containers set enabled = ?, updated_at = ? where id = ? and type = 'permit'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/permit-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_containers where id = ? and type = 'permit'").run(params.data.id);
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
    const { id } = createSingleItemArrangement(db, {
      type: "other",
      name: "其他",
      description: "其他安排",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.task,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      metadata: {}
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
    const result = updateSingleItemArrangement(db, params.data.id, {
      type: "other",
      date: input.date,
      timeTag: input.timeTag,
      content: input.task,
      target: input.task,
      personnel: input.personnel,
      vehicle: input.vehicle,
      other: input.other,
      metadata: {}
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

    const result = db
      .prepare("update task_containers set enabled = ?, updated_at = ? where id = ? and type = 'other'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/other-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_containers where id = ? and type = 'other'").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/patrol-arrangements", async (request, reply) => {
    const validation = validateArrangementListQuery(request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = listArrangementTaskRows(db, "patrol", validation.data);

    return rows.map(mapPatrolArrangementTaskRow);
  });

  app.post("/api/admin/patrol-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(patrolArrangementInputSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const id = nanoid();
    const itemId = nanoid();
    const now = new Date().toISOString();
    const { startAt, endAt } = timeRangeForDateTag(input.date, input.timeTag);
    const durationMinutes = durationMinutesForRange(startAt, endAt);

    db.transaction(() => {
      db.prepare(
        `insert into task_containers
         (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
          recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
         values (?, 'patrol', '巡视', '巡视安排', ?, ?, 'once', null, null, 0, 0, 1, ?, ?)`
      ).run(id, startAt, endAt, now, now);
      db.prepare(
        `insert into task_items
         (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
         values (?, ?, 0, ?, ?, ?, 0)`
      ).run(
        itemId,
        id,
        durationMinutes,
        input.target,
        JSON.stringify(
          arrangementMetadata({
            timeTag: input.timeTag,
            target: input.target,
            personnel: input.personnel,
            vehicle: input.vehicle,
            other: input.other,
            metadata: {}
          })
        )
      );
    })();
    boardEvents.publish();

    return reply.code(201).send({ id, itemId });
  });

  app.put("/api/admin/patrol-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(patrolArrangementInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const now = new Date().toISOString();
    const { startAt, endAt } = timeRangeForDateTag(input.date, input.timeTag);
    const durationMinutes = durationMinutesForRange(startAt, endAt);
    const containerResult = db.transaction(() => {
      const result = db
        .prepare("update task_containers set start_at = ?, end_at = ?, updated_at = ? where id = ? and type = 'patrol'")
        .run(startAt, endAt, now, params.data.id);
      if (result.changes === 0) return result;

      db.prepare(
        `update task_items
         set offset_minutes = 0, duration_minutes = ?, content = ?, ext_data_json = ?
         where container_id = ?`
      ).run(
        durationMinutes,
        input.target,
        JSON.stringify(
          arrangementMetadata({
            timeTag: input.timeTag,
            target: input.target,
            personnel: input.personnel,
            vehicle: input.vehicle,
            other: input.other,
            metadata: {}
          })
        ),
        params.data.id
      );
      return result;
    })();
    if (containerResult.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id };
  });

  app.patch("/api/admin/patrol-arrangements/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = db
      .prepare("update task_containers set enabled = ?, updated_at = ? where id = ? and type = 'patrol'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/patrol-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_containers where id = ? and type = 'patrol'").run(params.data.id);
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

      for (const [date, name] of Object.entries(input.holidays).sort(([left], [right]) => left.localeCompare(right))) {
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
                from task_items first
                where first.container_id = c.id
                order by first.sort_order, first.offset_minutes
                limit 1
              ) as first_item_content
       from task_containers c
       left join task_items i on i.container_id = c.id
       where c.type = 'operation'`;
    const sql =
      validation.data.scope === "all"
        ? `${baseSql}
           group by c.id
           order by c.start_at desc, c.name`
        : `${baseSql}
           and c.start_at <= ?
           and c.end_at >= ?
           group by c.id
           order by c.start_at, c.name`;

    const rows =
      validation.data.scope === "all"
        ? db.prepare<[], OperationPlanAdminRow>(sql).all()
        : db
            .prepare<[string, string], OperationPlanAdminRow>(sql)
            .all(`${validation.data.date}T23:59:59+08:00`, `${validation.data.date}T00:00:00+08:00`);

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
                  from task_items first
                  where first.container_id = c.id
                  order by first.sort_order, first.offset_minutes
                  limit 1
                ) as first_item_content
         from task_containers c
         left join task_items i on i.container_id = c.id
         where c.id = ? and c.type = 'operation'
         group by c.id`
      )
      .get(params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });

    const items = db
      .prepare<[string], OperationItemAdminRow>(
        `select id, offset_minutes, duration_minutes, content, ext_data_json, sort_order
         from task_items
         where container_id = ?
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
    db.prepare(
      `insert into task_containers
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, 'operation', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      id,
      input.name,
      input.description,
      input.startAt,
      input.endAt,
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

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `update task_containers
         set name = ?, description = ?, start_at = ?, end_at = ?, recurrence_type = ?,
             recurrence_interval_minutes = ?, recurrence_count = ?, skip_weekends = ?, skip_holidays = ?, updated_at = ?
         where id = ? and type = 'operation'`
      )
      .run(
        input.name,
        input.description,
        input.startAt,
        input.endAt,
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
      const existingItem = input.item.id
        ? db
            .prepare<[string, string], { id: string }>("select id from task_items where id = ? and container_id = ?")
            .get(input.item.id, params.data.id)
        : db
            .prepare<[string], { id: string }>(
              `select id
         from task_items
         where container_id = ?
         order by sort_order, offset_minutes
         limit 1`
            )
            .get(params.data.id);
      if (existingItem) {
        db.prepare(
          `update task_items
         set offset_minutes = ?, duration_minutes = ?, content = ?, ext_data_json = ?, sort_order = ?
         where id = ?`
        ).run(
          input.item.offsetMinutes,
          input.item.durationMinutes,
          input.item.content,
          JSON.stringify(input.item.metadata),
          input.item.sortOrder,
          existingItem.id
        );
      } else {
        insertOperationItem(db, params.data.id, input.item);
      }
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
      .prepare("update task_containers set enabled = ?, updated_at = ? where id = ? and type = 'operation'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/operation-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_containers where id = ? and type = 'operation'").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.post("/api/admin/task-containers", async (request, reply) => {
    const validation = validateAdminPayload(taskContainerInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();
    const now = new Date().toISOString();

    db.prepare(
      `insert into task_containers
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      id,
      input.type,
      input.name,
      input.description,
      input.startAt,
      input.endAt,
      input.recurrenceType,
      input.recurrenceIntervalMinutes ?? null,
      input.recurrenceCount ?? null,
      input.skipWeekends ? 1 : 0,
      input.skipHolidays ? 1 : 0,
      now,
      now
    );
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.post("/api/admin/task-items", async (request, reply) => {
    const validation = validateAdminPayload(taskItemInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const parent = db
      .prepare<[string], TaskContainerDurationRow>("select start_at, end_at from task_containers where id = ? and enabled = 1")
      .get(input.containerId);
    if (!parent) {
      return reply.code(400).send({
        error: "Invalid admin payload",
        message: "parent task container not found"
      });
    }

    const parentDurationMinutes = Math.floor((new Date(parent.end_at).getTime() - new Date(parent.start_at).getTime()) / 60_000);
    const itemValidation = validateTaskItem(parentDurationMinutes, input);
    if (!itemValidation.ok) {
      return reply.code(400).send({
        error: "Invalid admin payload",
        message: itemValidation.message
      });
    }

    const id = nanoid();
    db.prepare(
      `insert into task_items
       (id, container_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
       values (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.containerId,
      input.offsetMinutes,
      input.durationMinutes,
      input.content,
      JSON.stringify(
        arrangementMetadata({
          timeTag: input.timeTag ?? "全天",
          target: input.target,
          personnel: input.personnel,
          vehicle: input.vehicle,
          other: input.other,
          metadata: input.metadata
        })
      ),
      input.sortOrder
    );
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.delete("/api/admin/task-items/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_items where id = ?").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });
}
