import type { FastifyInstance } from "fastify";
import type { AppDatabase } from "../db/database.js";
import { getBoardSnapshot } from "../domain/boardSnapshot.js";

interface BoardEventStream {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
}

export function registerBoardRoutes(app: FastifyInstance, db: AppDatabase): void {
  app.get("/api/board", async () => getBoardSnapshot(db));
  app.get("/api/events", async (_request, reply) => {
    reply.hijack();
    writeInitialBoardEvent(reply.raw);

    const cleanup = () => {
      reply.raw.off("close", cleanup);
    };
    reply.raw.on("close", cleanup);
  });
}

export function writeInitialBoardEvent(stream: BoardEventStream): void {
  stream.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  stream.write(`event: board:update\ndata: {"version":1}\n\n`);
}
