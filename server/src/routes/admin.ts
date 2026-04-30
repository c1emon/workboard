import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";

const timeTagSchema = z.enum(["全天", "上午", "下午"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase): void {
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

    return reply.code(201).send({ id });
  });
}
