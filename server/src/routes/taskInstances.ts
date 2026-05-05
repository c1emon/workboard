import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { toChinaDate, toChinaOffsetDateTime } from "../domain/dateTime.js";
import { generateTaskInstances } from "../domain/taskInstanceGeneration.js";
import { parseExtDataJson, taskInstanceStatuses } from "../domain/taskInstances.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";
import { validateAdminPayload } from "./validation.js";

const taskInstanceTypes = ["operation", "permit", "patrol", "other"] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid datetime"
});
const resourceIdSchema = z.string().min(1).max(64);
const typeSchema = z.enum(taskInstanceTypes);
const statusSchema = z.enum(taskInstanceStatuses);
const extDataSchema = z.record(z.unknown());

const listQuerySchema = z.object({
  date: dateSchema.optional(),
  type: typeSchema.optional(),
  scope: z.enum(["date", "all"]).default("date")
});

const instanceInputSchema = z
  .object({
    type: typeSchema,
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    content: z.string().default(""),
    extData: extDataSchema.default({})
  })
  .superRefine(validateDateTimeRange);

const statusInputSchema = z.object({
  status: statusSchema
});

const generateInputSchema = z
  .object({
    windowStartDate: dateSchema,
    windowEndDate: dateSchema,
    types: z.array(typeSchema).optional(),
    templateIds: z.array(resourceIdSchema).optional(),
    refreshPending: z.boolean().optional()
  })
  .superRefine((input, ctx) => {
    if (input.windowStartDate > input.windowEndDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["windowEndDate"],
        message: "windowEndDate must be on or after windowStartDate"
      });
    }
  });

const idParamSchema = z.object({ id: resourceIdSchema });

interface TaskInstanceRow {
  id: string;
  type: "operation" | "permit" | "patrol" | "other";
  template_id: string | null;
  source_template_item_id: string | null;
  source_type: "generated" | "manual" | "override";
  generation_key: string | null;
  occurrence_date: string;
  start_at: string;
  end_at: string;
  content: string;
  ext_data_json: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  generated_at: string;
  updated_at: string;
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

export function registerTaskInstanceRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/task-instances", async (request, reply) => {
    const validation = validateAdminPayload(listQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);
    if (validation.data.scope === "date" && !validation.data.date) {
      return reply.code(400).send({
        error: "Invalid admin payload",
        issues: [{ code: z.ZodIssueCode.custom, path: ["date"], message: "Required when scope is date" }]
      });
    }

    const dayStart = `${validation.data.date}T00:00:00+08:00`;
    const dayEnd = `${validation.data.date}T23:59:59.999+08:00`;
    const rows = validation.data.type
      ? validation.data.scope === "all"
        ? db
          .prepare<[string], TaskInstanceRow>(
                 `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
                         start_at, end_at, content, ext_data_json, status, generated_at, updated_at
                    from task_instances
                   where type = ?
                   order by start_at desc, content, id`
          )
          .all(validation.data.type)
        : db
          .prepare<[string, string, string], TaskInstanceRow>(
	             `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
	                     start_at, end_at, content, ext_data_json, status, generated_at, updated_at
	              from task_instances
	             where type = ? and start_at <= ? and end_at >= ?
	             order by start_at, content, id`
          )
          .all(validation.data.type, dayEnd, dayStart)
      : validation.data.scope === "all"
        ? db
          .prepare<[], TaskInstanceRow>(
                 `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
                         start_at, end_at, content, ext_data_json, status, generated_at, updated_at
                    from task_instances
                   order by start_at desc, content, id`
          )
          .all()
        : db
          .prepare<[string, string], TaskInstanceRow>(
	             `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
	                     start_at, end_at, content, ext_data_json, status, generated_at, updated_at
	              from task_instances
	             where start_at <= ? and end_at >= ?
	             order by start_at, content, id`
          )
          .all(dayEnd, dayStart);

    return rows.map(mapTaskInstanceRow);
  });

  app.post("/api/admin/task-instances", async (request, reply) => {
    const validation = validateAdminPayload(instanceInputSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const id = nanoid();
    const now = new Date().toISOString();
    const startAt = toChinaOffsetDateTime(validation.data.startAt);
    const endAt = toChinaOffsetDateTime(validation.data.endAt);
    db.prepare(
      `insert into task_instances
       (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
        start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values (?, ?, null, null, 'manual', null, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      id,
      validation.data.type,
      toChinaDate(startAt),
      startAt,
      endAt,
      validation.data.content,
      JSON.stringify(validation.data.extData),
      now,
      now
    );
    boardEvents.publish();

    const row = getTaskInstance(db, id);
    return reply.code(201).send(row ? mapTaskInstanceRow(row) : { id });
  });

  app.put("/api/admin/task-instances/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(instanceInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const row = getTaskInstance(db, params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });
    if (row.source_type !== "manual" || row.status !== "pending") {
      return reply.code(409).send({ error: "Task instance is not editable" });
    }

    const now = new Date().toISOString();
    const startAt = toChinaOffsetDateTime(validation.data.startAt);
    const endAt = toChinaOffsetDateTime(validation.data.endAt);
    db.prepare(
      `update task_instances
       set type = ?, occurrence_date = ?, start_at = ?, end_at = ?, content = ?, ext_data_json = ?, updated_at = ?
       where id = ?`
    ).run(
      validation.data.type,
      toChinaDate(startAt),
      startAt,
      endAt,
      validation.data.content,
      JSON.stringify(validation.data.extData),
      now,
      params.data.id
    );
    boardEvents.publish();

    const updatedRow = getTaskInstance(db, params.data.id);
    return updatedRow ? mapTaskInstanceRow(updatedRow) : reply.code(404).send({ error: "Not found" });
  });

  app.patch("/api/admin/task-instances/:id/status", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    const validation = validateAdminPayload(statusInputSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!validation.success) return reply.code(400).send(validation.error);

    const row = getTaskInstance(db, params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });

    db.prepare("update task_instances set status = ?, updated_at = ? where id = ?").run(
      validation.data.status,
      new Date().toISOString(),
      params.data.id
    );
    boardEvents.publish();

    const updatedRow = getTaskInstance(db, params.data.id);
    return updatedRow ? mapTaskInstanceRow(updatedRow) : reply.code(404).send({ error: "Not found" });
  });

  app.delete("/api/admin/task-instances/:id", async (request, reply) => {
    const params = validateAdminPayload(idParamSchema, request.params);
    if (!params.success) return reply.code(400).send(params.error);

    const row = getTaskInstance(db, params.data.id);
    if (!row) return reply.code(404).send({ error: "Not found" });

    db.prepare("delete from task_instances where id = ?").run(params.data.id);
    boardEvents.publish();

    return reply.code(204).send();
  });

  app.post("/api/admin/task-instances/generate", async (request, reply) => {
    const validation = validateAdminPayload(generateInputSchema, request.body);
    if (!validation.success) return reply.code(400).send(validation.error);

    const result = generateTaskInstances(db, validation.data);
    boardEvents.publish();
    return result;
  });
}

function getTaskInstance(db: AppDatabase, id: string): TaskInstanceRow | undefined {
  return db
    .prepare<[string], TaskInstanceRow>(
      `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
              start_at, end_at, content, ext_data_json, status, generated_at, updated_at
       from task_instances
       where id = ?`
    )
    .get(id);
}

function mapTaskInstanceRow(row: TaskInstanceRow) {
  return {
    id: row.id,
    type: row.type,
    templateId: row.template_id,
    sourceTemplateItemId: row.source_template_item_id,
    sourceType: row.source_type,
    generationKey: row.generation_key,
    occurrenceDate: row.occurrence_date,
    startAt: row.start_at,
    endAt: row.end_at,
    content: row.content,
    extData: parseExtDataJson(row.ext_data_json),
    status: row.status,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at
  };
}
