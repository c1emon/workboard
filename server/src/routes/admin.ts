import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";

const timeTagSchema = z.enum(["全天", "上午", "下午"]);

const permitInputSchema = z.object({
  date: z.string().min(1),
  timeTag: timeTagSchema,
  permit: z.string().min(1),
  personnel: z.string().default(""),
  area: z.string().default(""),
  other: z.string().default("")
});

const otherInputSchema = z.object({
  date: z.string().min(1),
  timeTag: timeTagSchema,
  task: z.string().min(1),
  personnel: z.string().default(""),
  vehicle: z.string().default(""),
  other: z.string().default("")
});

const leaveInputSchema = z.object({
  date: z.string().min(1),
  name: z.string().min(1)
});

const holidayInputSchema = z.object({
  date: z.string().min(1),
  name: z.string().default("")
});

export function registerAdminRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.post("/api/admin/permit-arrangements", async (request, reply) => {
    const input = permitInputSchema.parse(request.body);
    const id = nanoid();

    db.prepare(
      "insert into permit_arrangements (id, date, time_tag, permit, personnel, area, other) values (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, input.date, input.timeTag, input.permit, input.personnel, input.area, input.other);

    return reply.code(201).send({ id });
  });

  app.post("/api/admin/other-arrangements", async (request, reply) => {
    const input = otherInputSchema.parse(request.body);
    const id = nanoid();

    db.prepare(
      "insert into other_arrangements (id, date, time_tag, task, personnel, vehicle, other) values (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, input.date, input.timeTag, input.task, input.personnel, input.vehicle, input.other);

    return reply.code(201).send({ id });
  });

  app.post("/api/admin/leave-people", async (request, reply) => {
    const input = leaveInputSchema.parse(request.body);
    const id = nanoid();

    db.prepare("insert into leave_people (id, date, name) values (?, ?, ?)").run(id, input.date, input.name);

    return reply.code(201).send({ id });
  });

  app.post("/api/admin/holidays", async (request, reply) => {
    const input = holidayInputSchema.parse(request.body);
    const id = nanoid();

    db.prepare("insert into holidays (id, date, name) values (?, ?, ?)").run(id, input.date, input.name);

    return reply.code(201).send({ id });
  });
}
