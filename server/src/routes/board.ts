import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/database.js";
import { getBoardSnapshot } from "../domain/boardSnapshot.js";

export function registerBoardRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.get("/api/board", async () => getBoardSnapshot(db));
  app.get("/api/events", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    reply.raw.end(`event: board:update\ndata: {"version":1}\n\n`);
  });
}
