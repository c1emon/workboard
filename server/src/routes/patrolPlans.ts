import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

type TimeTag = "全天" | "上午" | "下午";

const timeTagSchema = z.enum(["全天", "上午", "下午"]);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid datetime"
});
const resourceIdSchema = z.string().min(1).max(64);

const planCreateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    cycleLength: z.number().int().min(1).default(90),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(true),
    enabled: z.boolean().default(true)
  })
  .superRefine(validateDateTimeRange);

const planUpdateSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().default(""),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    cycleLength: z.number().int().min(1),
    skipWeekends: z.boolean().default(false),
    skipHolidays: z.boolean().default(true),
    enabled: z.boolean().optional()
  })
  .superRefine(validateDateTimeRange);

const itemInputSchema = z.object({
  cycleDay: z.number().int().min(1),
  timeTag: timeTagSchema,
  target: z.string().min(1),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default(""),
  sortOrder: z.number().int().default(0),
  content: z.string().optional()
});

const enabledInputSchema = z.object({ enabled: z.boolean() });
const idParamSchema = z.object({ id: resourceIdSchema });
const itemParamSchema = z.object({ id: resourceIdSchema, itemId: resourceIdSchema });

interface PatrolPlanRow {
  id: string;
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  skip_weekends: number;
  skip_holidays: number;
  enabled: number;
  ext_data_json: string;
}

interface PatrolItemRow {
  id: string;
  template_id: string;
  content: string;
  ext_data_json: string;
  sort_order: number;
}

interface PatrolItemMetadata {
  cycleDay: number;
  timeTag: TimeTag;
  target: string;
  personnel: string;
  vehicle: string;
  other: string;
}

function validateDateTimeRange(input: { startAt: string; endAt: string }, ctx: z.RefinementCtx): void {
  if (new Date(input.endAt).getTime() <= new Date(input.startAt).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "endAt must be after startAt"
    });
  }
}

function validateAdminPayload<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): { success: true; data: z.infer<TSchema> } | { success: false; error: { error: string; issues: z.ZodIssue[] } } {
  const result = schema.safeParse(value);
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

export function registerPatrolPlanRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/patrol-plans", async () => {
    const rows = db
      .prepare<[], PatrolPlanRow>(
        `select id, name, description, start_at, end_at, skip_weekends, skip_holidays, enabled, ext_data_json
         from task_templates
         where type = 'patrol'
         order by start_at desc, name, id`
      )
      .all();

    return rows.map(mapPlanRow);
  });

  app.get("/api/admin/patrol-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const row = getPlan(db, params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });

    return {
      ...mapPlanRow(row),
      items: listPlanItems(db, row.id).map(mapItemRow).sort(compareCycleItems)
    };
  });

  app.post("/api/admin/patrol-plans", async (request, reply) => {
    const validation = validateAdminPayload(planCreateSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const id = nanoid();
    const now = new Date().toISOString();
    db.prepare(
      `insert into task_templates
       (id, type, name, description, start_at, end_at, recurrence_type, recurrence_interval_minutes,
        recurrence_count, skip_weekends, skip_holidays, enabled, ext_data_json, created_at, updated_at)
       values (?, 'patrol', ?, ?, ?, ?, 'infinite', 1440, null, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      validation.data.name,
      validation.data.description,
      validation.data.startAt,
      validation.data.endAt,
      validation.data.skipWeekends ? 1 : 0,
      validation.data.skipHolidays ? 1 : 0,
      validation.data.enabled ? 1 : 0,
      JSON.stringify({ cycleLength: validation.data.cycleLength }),
      now,
      now
    );
    boardEvents.publish();

    const row = getPlan(db, id);
    return reply.code(201).send(row ? mapPlanRow(row) : { id });
  });

  app.put("/api/admin/patrol-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(planUpdateSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const current = getPlan(db, params.data.id);
    if (!current) return reply.code(404).send({ error: "Not found" });

    const maxCycleDay = maxItemCycleDay(db, params.data.id);
    if (maxCycleDay > validation.data.cycleLength) {
      return reply.code(400).send({
        error: "Invalid admin payload",
        issues: [{ code: z.ZodIssueCode.custom, path: ["cycleLength"], message: "cycleLength is less than existing cycle items" }]
      });
    }

    const now = new Date().toISOString();
    db.prepare(
      `update task_templates
       set name = ?, description = ?, start_at = ?, end_at = ?, skip_weekends = ?, skip_holidays = ?,
           enabled = ?, ext_data_json = ?, updated_at = ?
       where id = ? and type = 'patrol'`
    ).run(
      validation.data.name,
      validation.data.description,
      validation.data.startAt,
      validation.data.endAt,
      validation.data.skipWeekends ? 1 : 0,
      validation.data.skipHolidays ? 1 : 0,
      validation.data.enabled ?? current.enabled === 1 ? 1 : 0,
      JSON.stringify({ cycleLength: validation.data.cycleLength }),
      now,
      params.data.id
    );
    boardEvents.publish();

    const row = getPlan(db, params.data.id);
    return row ? mapPlanRow(row) : reply.code(404).send({ error: "Not found" });
  });

  app.patch("/api/admin/patrol-plans/:id/enabled", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(enabledInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = db
      .prepare("update task_templates set enabled = ?, updated_at = ? where id = ? and type = 'patrol'")
      .run(validation.data.enabled ? 1 : 0, new Date().toISOString(), params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return { id: params.data.id, enabled: validation.data.enabled };
  });

  app.delete("/api/admin/patrol-plans/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const result = db.prepare("delete from task_templates where id = ? and type = 'patrol'").run(params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.post("/api/admin/patrol-plans/:id/items", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(itemInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const plan = getPlan(db, params.data.id);
    if (!plan) return reply.code(404).send({ error: "Not found" });
    const cycleLength = cycleLengthFromPlan(plan);
    const cycleValidation = validateCycleDay(validation.data.cycleDay, cycleLength);
    if (!cycleValidation.success) return reply.code(400).send(cycleValidation.error);
    if (hasDuplicateCycleItem(db, params.data.id, validation.data.cycleDay, validation.data.sortOrder)) {
      return reply.code(409).send({ error: "Duplicate patrol cycle item" });
    }

    const id = nanoid();
    db.prepare(
      `insert into task_template_items
       (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order)
       values (?, ?, 0, 0, ?, ?, ?)`
    ).run(id, params.data.id, validation.data.content ?? validation.data.target, JSON.stringify(itemMetadata(validation.data)), validation.data.sortOrder);
    boardEvents.publish();

    const row = getItem(db, params.data.id, id);
    return reply.code(201).send(row ? mapItemRow(row) : { id });
  });

  app.put("/api/admin/patrol-plans/:id/items/:itemId", async (request, reply) => {
    const params = validateAdminPayload(itemParamSchema, request.params);
    const validation = validateAdminPayload(itemInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const plan = getPlan(db, params.data.id);
    if (!plan) return reply.code(404).send({ error: "Not found" });
    const existing = getItem(db, params.data.id, params.data.itemId);
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const cycleValidation = validateCycleDay(validation.data.cycleDay, cycleLengthFromPlan(plan));
    if (!cycleValidation.success) return reply.code(400).send(cycleValidation.error);
    if (hasDuplicateCycleItem(db, params.data.id, validation.data.cycleDay, validation.data.sortOrder, params.data.itemId)) {
      return reply.code(409).send({ error: "Duplicate patrol cycle item" });
    }

    db.prepare(
      `update task_template_items
       set content = ?, ext_data_json = ?, sort_order = ?
       where id = ? and template_id = ?`
    ).run(
      validation.data.content ?? validation.data.target,
      JSON.stringify(itemMetadata(validation.data)),
      validation.data.sortOrder,
      params.data.itemId,
      params.data.id
    );
    boardEvents.publish();

    const row = getItem(db, params.data.id, params.data.itemId);
    return row ? mapItemRow(row) : reply.code(404).send({ error: "Not found" });
  });

  app.delete("/api/admin/patrol-plans/:id/items/:itemId", async (request, reply) => {
    const params = validateAdminPayload(itemParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const plan = getPlan(db, params.data.id);
    if (!plan) return reply.code(404).send({ error: "Not found" });

    const result = db.prepare("delete from task_template_items where id = ? and template_id = ?").run(params.data.itemId, params.data.id);
    if (result.changes === 0) return reply.code(404).send({ error: "Not found" });
    boardEvents.publish();

    return reply.code(204).send();
  });
}

function getPlan(db: AppDatabase, id: string): PatrolPlanRow | undefined {
  return db
    .prepare<[string], PatrolPlanRow>(
      `select id, name, description, start_at, end_at, skip_weekends, skip_holidays, enabled, ext_data_json
       from task_templates
       where id = ? and type = 'patrol'`
    )
    .get(id);
}

function listPlanItems(db: AppDatabase, planId: string): PatrolItemRow[] {
  return db
    .prepare<[string], PatrolItemRow>(
      `select id, template_id, content, ext_data_json, sort_order
       from task_template_items
       where template_id = ?`
    )
    .all(planId);
}

function getItem(db: AppDatabase, planId: string, itemId: string): PatrolItemRow | undefined {
  return db
    .prepare<[string, string], PatrolItemRow>(
      `select id, template_id, content, ext_data_json, sort_order
       from task_template_items
       where template_id = ? and id = ?`
    )
    .get(planId, itemId);
}

function mapPlanRow(row: PatrolPlanRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    cycleLength: cycleLengthFromPlan(row),
    skipWeekends: row.skip_weekends === 1,
    skipHolidays: row.skip_holidays === 1,
    enabled: row.enabled === 1
  };
}

function mapItemRow(row: PatrolItemRow) {
  const metadata = parseItemMetadata(row.ext_data_json);
  return {
    id: row.id,
    templateId: row.template_id,
    cycleDay: metadata.cycleDay,
    timeTag: metadata.timeTag,
    target: metadata.target,
    personnel: metadata.personnel,
    vehicle: metadata.vehicle,
    other: metadata.other,
    content: row.content,
    sortOrder: row.sort_order
  };
}

function compareCycleItems(left: ReturnType<typeof mapItemRow>, right: ReturnType<typeof mapItemRow>): number {
  return left.cycleDay - right.cycleDay || left.sortOrder - right.sortOrder || left.id.localeCompare(right.id);
}

function cycleLengthFromPlan(row: Pick<PatrolPlanRow, "ext_data_json">): number {
  const metadata = parseObject(row.ext_data_json);
  const value = metadata.cycleLength;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 90;
}

function parseItemMetadata(raw: string): PatrolItemMetadata {
  const metadata = parseObject(raw);
  return {
    cycleDay: positiveInteger(metadata.cycleDay, 1),
    timeTag: metadata.timeTag === "上午" || metadata.timeTag === "下午" || metadata.timeTag === "全天" ? metadata.timeTag : "全天",
    target: stringValue(metadata.target),
    personnel: stringValue(metadata.personnel),
    vehicle: stringValue(metadata.vehicle),
    other: stringValue(metadata.other)
  };
}

function parseObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function itemMetadata(input: z.infer<typeof itemInputSchema>): PatrolItemMetadata {
  return {
    cycleDay: input.cycleDay,
    timeTag: input.timeTag,
    target: input.target,
    personnel: input.personnel,
    vehicle: input.vehicle,
    other: input.other
  };
}

function validateCycleDay(
  cycleDay: number,
  cycleLength: number
): { success: true } | { success: false; error: { error: string; issues: z.ZodIssue[] } } {
  if (cycleDay <= cycleLength) return { success: true };
  return {
    success: false,
    error: {
      error: "Invalid admin payload",
      issues: [{ code: z.ZodIssueCode.custom, path: ["cycleDay"], message: "cycleDay must be within plan cycleLength" }]
    }
  };
}

function hasDuplicateCycleItem(db: AppDatabase, planId: string, cycleDay: number, sortOrder: number, excludeItemId?: string): boolean {
  return listPlanItems(db, planId).some((row) => {
    if (excludeItemId && row.id === excludeItemId) return false;
    const metadata = parseItemMetadata(row.ext_data_json);
    return metadata.cycleDay === cycleDay && row.sort_order === sortOrder;
  });
}

function maxItemCycleDay(db: AppDatabase, planId: string): number {
  return listPlanItems(db, planId).reduce((max, row) => Math.max(max, parseItemMetadata(row.ext_data_json).cycleDay), 0);
}
