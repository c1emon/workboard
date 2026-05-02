import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { generateTaskInstances } from "../domain/taskInstanceGeneration.js";
import { parseTaskInstanceMetadata, taskInstanceStatuses } from "../domain/taskInstances.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

const taskInstanceTypes = ["operation", "permit", "patrol", "other"] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid datetime"
});
const resourceIdSchema = z.string().min(1).max(64);
const typeSchema = z.enum(taskInstanceTypes);
const statusSchema = z.enum(taskInstanceStatuses);
const metadataSchema = z.record(z.unknown());

const listQuerySchema = z.object({
  date: dateSchema,
  type: typeSchema.optional()
});

const instanceInputSchema = z
  .object({
    type: typeSchema,
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    content: z.string().default(""),
    metadata: metadataSchema.default({})
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

export function registerTaskInstanceRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/admin/task-instances", async (request, reply) => {
    const validation = validateAdminPayload(listQuerySchema, request.query);
    if (!validation.success) return reply.code(400).send(validation.error);

    const dayStart = `${validation.data.date}T00:00:00+08:00`;
    const dayEnd = `${validation.data.date}T23:59:59.999+08:00`;
    const rows = validation.data.type
      ? db
          .prepare<[string, string, string], TaskInstanceRow>(
	             `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
	                     start_at, end_at, content, ext_data_json, status, generated_at, updated_at
	              from task_instances
	             where type = ? and julianday(start_at) <= julianday(?) and julianday(end_at) >= julianday(?)
	             order by start_at, content, id`
          )
          .all(validation.data.type, dayEnd, dayStart)
      : db
          .prepare<[string, string], TaskInstanceRow>(
	             `select id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
	                     start_at, end_at, content, ext_data_json, status, generated_at, updated_at
	              from task_instances
	             where julianday(start_at) <= julianday(?) and julianday(end_at) >= julianday(?)
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
    db.prepare(
      `insert into task_instances
       (id, type, template_id, source_template_item_id, source_type, generation_key, occurrence_date,
        start_at, end_at, content, ext_data_json, status, generated_at, updated_at)
       values (?, ?, null, null, 'manual', null, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(
      id,
      validation.data.type,
      toChinaDate(validation.data.startAt),
      validation.data.startAt,
      validation.data.endAt,
      validation.data.content,
      JSON.stringify(validation.data.metadata),
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
    db.prepare(
      `update task_instances
       set type = ?, occurrence_date = ?, start_at = ?, end_at = ?, content = ?, ext_data_json = ?, updated_at = ?
       where id = ?`
    ).run(
      validation.data.type,
      toChinaDate(validation.data.startAt),
      validation.data.startAt,
      validation.data.endAt,
      validation.data.content,
      JSON.stringify(validation.data.metadata),
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
    metadata: parseTaskInstanceMetadata(row.ext_data_json),
    status: row.status,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at
  };
}

function toChinaDate(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
