import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { validateTaskItem } from "../domain/taskExpansion.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

const timeTagSchema = z.enum(["全天", "上午", "下午"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid datetime"
});

const permitInputSchema = z.object({
  date: dateSchema,
  timeTag: timeTagSchema,
  permit: z.string().min(1),
  personnel: z.string().default(""),
  area: z.string().default(""),
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
    type: z.enum(["operation", "patrol"]),
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
  .superRefine((input, ctx) => {
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
  });

const taskItemInputSchema = z.object({
  containerId: z.string().min(1),
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

const idParamSchema = z.object({ id: z.string().min(1) });
const dateQuerySchema = z.object({ date: dateSchema });
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
}).extend({ id: z.string().min(1).optional() });
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
  .superRefine((input, ctx) => {
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
  });
interface TaskContainerDurationRow {
  start_at: string;
  end_at: string;
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
  metadata_json: string;
  sort_order: number;
}

interface PermitArrangementAdminRow {
  id: string;
  date: string;
  time_tag: "全天" | "上午" | "下午";
  permit: string;
  personnel: string;
  area: string;
  other: string;
  enabled: number;
}

interface OtherArrangementAdminRow {
  id: string;
  date: string;
  time_tag: "全天" | "上午" | "下午";
  task: string;
  personnel: string;
  vehicle: string;
  other: string;
  enabled: number;
}

interface PatrolArrangementAdminRow {
  id: string;
  item_id: string;
  time_tag: "全天" | "上午" | "下午" | null;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
  enabled: number;
}

interface LeavePersonAdminRow {
  id: string;
  date: string;
  name: string;
  enabled: number;
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
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
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
     (id, container_id, offset_minutes, duration_minutes, content, time_tag, target, personnel, vehicle, other,
      metadata_json, sort_order)
     values (?, ?, ?, ?, ?, null, '', '', '', '', ?, ?)`
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

function chineseDaysName(value: string): string {
  const [, chineseName] = value.split(",");
  return chineseName?.trim() || value.trim();
}

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/permit-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(dateQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = db
      .prepare<[string], PermitArrangementAdminRow>(
        `select id, date, time_tag, permit, personnel, area, other, enabled
         from permit_arrangements
         where date = ?
         order by sort_order, time_tag, permit`
      )
      .all(validation.data.date);

    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      timeTag: row.time_tag,
      permit: row.permit,
      personnel: row.personnel,
      area: row.area,
      other: row.other,
      enabled: row.enabled === 1
    }));
  });

  app.post("/api/admin/permit-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(permitInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();

    db.prepare(
      "insert into permit_arrangements (id, date, time_tag, permit, personnel, area, other) values (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, input.date, input.timeTag, input.permit, input.personnel, input.area, input.other);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/permit-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(permitInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const result = db
      .prepare("update permit_arrangements set date = ?, time_tag = ?, permit = ?, personnel = ?, area = ?, other = ? where id = ?")
      .run(input.date, input.timeTag, input.permit, input.personnel, input.area, input.other, params.data.id);
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
      .prepare("update permit_arrangements set enabled = ? where id = ?")
      .run(validation.data.enabled ? 1 : 0, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/permit-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from permit_arrangements where id = ?").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/other-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(dateQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = db
      .prepare<[string], OtherArrangementAdminRow>(
        `select id, date, time_tag, task, personnel, vehicle, other, enabled
         from other_arrangements
         where date = ?
         order by sort_order, time_tag, task`
      )
      .all(validation.data.date);

    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      timeTag: row.time_tag,
      task: row.task,
      personnel: row.personnel,
      vehicle: row.vehicle,
      other: row.other,
      enabled: row.enabled === 1
    }));
  });

  app.post("/api/admin/other-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(otherInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();

    db.prepare(
      "insert into other_arrangements (id, date, time_tag, task, personnel, vehicle, other) values (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, input.date, input.timeTag, input.task, input.personnel, input.vehicle, input.other);
    boardEvents.publish();

    return reply.code(201).send({ id });
  });

  app.put("/api/admin/other-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(otherInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const result = db
      .prepare("update other_arrangements set date = ?, time_tag = ?, task = ?, personnel = ?, vehicle = ?, other = ? where id = ?")
      .run(input.date, input.timeTag, input.task, input.personnel, input.vehicle, input.other, params.data.id);
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
      .prepare("update other_arrangements set enabled = ? where id = ?")
      .run(validation.data.enabled ? 1 : 0, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/other-arrangements/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from other_arrangements where id = ?").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.get("/api/admin/patrol-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(dateQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = db
      .prepare<[string, string], PatrolArrangementAdminRow>(
        `select c.id, i.id as item_id, i.time_tag, i.target, i.personnel, i.vehicle, i.other, c.enabled
         from task_containers c
         join task_items i on i.container_id = c.id
         where c.type = 'patrol'
           and c.start_at <= ?
           and c.end_at >= ?
         order by c.start_at, i.sort_order, i.offset_minutes`
      )
      .all(`${validation.data.date}T23:59:59+08:00`, `${validation.data.date}T00:00:00+08:00`);

    return rows.map((row) => ({
      id: row.id,
      itemId: row.item_id,
      date: validation.data.date,
      timeTag: row.time_tag ?? "全天",
      target: row.target,
      personnel: row.personnel,
      vehicle: row.vehicle,
      other: row.other,
      enabled: row.enabled === 1
    }));
  });

  app.post("/api/admin/patrol-arrangements", async (request, reply) => {
    const validation = validateAdminPayload(patrolArrangementInputSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const input = validation.data;
    const id = nanoid();
    const itemId = nanoid();
    const now = new Date().toISOString();

    db.prepare(
      `insert into task_containers
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, created_at, updated_at)
       values (?, 'patrol', '巡视', '巡视安排', ?, ?, 'once', null, null, 0, 0, 1, ?, ?)`
    ).run(id, `${input.date}T00:00:00+08:00`, `${input.date}T23:59:59+08:00`, now, now);
    db.prepare(
      `insert into task_items
       (id, container_id, offset_minutes, duration_minutes, content, time_tag, target, personnel, vehicle, other,
        metadata_json, sort_order)
       values (?, ?, 0, 1439, ?, ?, ?, ?, ?, ?, '{}', 0)`
    ).run(itemId, id, input.target, input.timeTag, input.target, input.personnel, input.vehicle, input.other);
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
    const containerResult = db
      .prepare("update task_containers set start_at = ?, end_at = ?, updated_at = ? where id = ? and type = 'patrol'")
      .run(`${input.date}T00:00:00+08:00`, `${input.date}T23:59:59+08:00`, now, params.data.id);
    if (containerResult.changes === 0) return reply.code(404).send({ error: "Not found" });

    db.prepare(
      "update task_items set content = ?, time_tag = ?, target = ?, personnel = ?, vehicle = ?, other = ? where container_id = ?"
    ).run(input.target, input.timeTag, input.target, input.personnel, input.vehicle, input.other, params.data.id);
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
    const validation = validateAdminPayload(dateQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const rows = db
      .prepare<[string], LeavePersonAdminRow>(
        `select id, date, name, enabled
         from leave_people
         where date = ?
         order by sort_order, name`
      )
      .all(validation.data.date);

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
        `select id, offset_minutes, duration_minutes, content, metadata_json, sort_order
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
         set offset_minutes = ?, duration_minutes = ?, content = ?, metadata_json = ?, sort_order = ?
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
       (id, container_id, offset_minutes, duration_minutes, content, time_tag, target, personnel, vehicle, other,
        metadata_json, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.containerId,
      input.offsetMinutes,
      input.durationMinutes,
      input.content,
      input.timeTag ?? null,
      input.target,
      input.personnel,
      input.vehicle,
      input.other,
      JSON.stringify(input.metadata),
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
