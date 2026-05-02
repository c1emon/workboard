import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { AppDatabase } from "./db/database.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerBoardRoutes } from "./routes/board.js";
import { createBoardEventBroadcaster, type BoardEventBroadcaster } from "./routes/boardEvents.js";

export interface AppOptions {
  boardEvents?: BoardEventBroadcaster;
  logger?: FastifyServerOptions["logger"];
}

export function createApp(db: AppDatabase, options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? (process.env.NODE_ENV === "test" ? false : true) });
  const boardEvents = options.boardEvents ?? createBoardEventBroadcaster();
  app.register(cors, { origin: true });
  registerAdminRoutes(app, db, boardEvents);
  registerBoardRoutes(app, db, boardEvents);
  return app;
}
