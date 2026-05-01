import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/database.js";
import { getBoardSnapshot } from "../domain/boardSnapshot.js";
import type { BoardEventBroadcaster } from "./boardEvents.js";

export function registerBoardRoutes(app: FastifyInstance, db: AppDatabase, boardEvents: BoardEventBroadcaster): void {
  app.get("/api/board", async () => getBoardSnapshot(db));
  app.get("/api/events", async (request, reply) => {
    reply.hijack();
    const origin = request.headers.origin;
    const unregister = boardEvents.register(reply.raw, {
      "Access-Control-Allow-Origin": typeof origin === "string" ? origin : "*",
      Vary: "Origin"
    });

    const cleanup = () => {
      reply.raw.off("close", cleanup);
      unregister();
    };
    reply.raw.on("close", cleanup);
  });
}
