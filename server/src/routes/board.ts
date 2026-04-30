import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/database.js";
import { getBoardSnapshot } from "../domain/boardSnapshot.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

export function registerBoardRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/board", async () => getBoardSnapshot(db));
  app.get("/api/events", async (_request, reply) => {
    reply.hijack();
    const unregister = boardEvents.register(reply.raw);

    const cleanup = () => {
      reply.raw.off("close", cleanup);
      unregister();
    };
    reply.raw.on("close", cleanup);
  });
}
