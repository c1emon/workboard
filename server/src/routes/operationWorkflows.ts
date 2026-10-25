import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { AppDatabase } from "../db/database.js";
import { getOperationBoardSelection, setOperationBoardSelection } from "../domain/operationBoardSelection.js";
import { regenerateOperationInstances } from "../domain/taskInstanceGeneration.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";
import { validateAdminPayload } from "./validation.js";

const idSchema = z.string().min(1).max(64);
const paramsSchema = z.object({ id: idSchema });
const chinaDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?\+08:00$/)
  .refine((value) => Number.isFinite(Date.parse(value)) && new Date(Date.parse(value) + 8 * 3600_000).toISOString().slice(0, 19) === value.slice(0, 19), "Invalid Beijing datetime");
const generationSchema = z.object({ startAt: chinaDateTime, cutoffAt: chinaDateTime, startItemId: idSchema.optional() });
const importSchema = z.object({ mode: z.literal("replace"), items: z.array(z.object({
  content: z.string().trim().min(1), offsetMinutes: z.number().int().nonnegative(),
  durationMinutes: z.number().int().positive(), sortOrder: z.number().int().nonnegative(),
  extData: z.record(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])).default({})
})).min(1) });

export function registerOperationWorkflowRoutes(app: FastifyInstance, db: AppDatabase, events: BoardEventBroadcaster): void {
  const exists = (id: string) => db.prepare("select id from task_templates where id = ? and type = 'operation'").get(id);
  app.get("/api/admin/operation-board-selection", async () => getOperationBoardSelection(db));
  app.put("/api/admin/operation-board-selection", async (request, reply) => {
    const input = validateAdminPayload(z.object({ planId: idSchema }), request.body);
    if (!input.success) return reply.code(400).send(input.error);
    if (!exists(input.data.planId)) return reply.code(404).send({ error: "操作计划不存在" });
    setOperationBoardSelection(db, input.data.planId);
    events.publish();
    return getOperationBoardSelection(db);
  });
  app.post("/api/admin/operation-plans/:id/generate", async (request, reply) => {
    const params = validateAdminPayload(paramsSchema, request.params);
    const input = validateAdminPayload(generationSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!input.success) return reply.code(400).send(input.error);
    if (!exists(params.data.id)) return reply.code(404).send({ error: "操作计划不存在", rolledBack: true });
    let result;
    try {
      result = regenerateOperationInstances(db, params.data.id, input.data);
    } catch (error) {
      // The domain transaction has completed rollback before a definite failure is returned.
      const message = error instanceof Error ? error.message : "生成失败";
      const invalid = /请选择|只能|必须|禁用|添加子任务/.test(message);
      return reply.code(invalid ? 400 : 500).send({ error: invalid ? message : "生成失败", rolledBack: true });
    }
    events.publish();
    return result;
  });
  app.post("/api/admin/operation-plans/:id/items/import", async (request, reply) => {
    const params = validateAdminPayload(paramsSchema, request.params);
    const input = validateAdminPayload(importSchema, request.body);
    if (!params.success) return reply.code(400).send(params.error);
    if (!input.success) return reply.code(400).send(input.error);
    if (!exists(params.data.id)) return reply.code(404).send({ error: "操作计划不存在", rolledBack: true });
    try {
      db.transaction(() => {
        db.prepare("delete from task_template_items where template_id = ?").run(params.data.id);
        const insert = db.prepare(`insert into task_template_items
          (id, template_id, offset_minutes, duration_minutes, content, ext_data_json, sort_order) values (?, ?, ?, ?, ?, ?, ?)`);
        for (const item of input.data.items) insert.run(nanoid(), params.data.id, item.offsetMinutes,
          item.durationMinutes, item.content, JSON.stringify(item.extData), item.sortOrder);
      })();
    } catch {
      return reply.code(500).send({ error: "导入失败", rolledBack: true });
    }
    events.publish();
    return { imported: input.data.items.length };
  });
}
