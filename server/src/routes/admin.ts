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

const leaveInputSchema = z.object({
  date: dateSchema,
  name: z.string().min(1)
});

const holidayInputSchema = z.object({
  date: dateSchema,
  name: z.string().default("")
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

interface TaskContainerDurationRow {
  start_at: string;
  end_at: string;
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

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
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

  app.post("/api/admin/holidays", async (request, reply) => {
    const validation = validateAdminPayload(holidayInputSchema, request.body);
    if (!validation.success) {
      return reply.code(400).send(validation.error);
    }

    const input = validation.data;
    const id = nanoid();

    db.prepare("insert into holidays (id, date, name) values (?, ?, ?)").run(id, input.date, input.name);
    boardEvents.publish();

    return reply.code(201).send({ id });
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
}
