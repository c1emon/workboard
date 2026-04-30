import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AppDatabase } from "./db/database.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerBoardRoutes } from "./routes/board.js";

export function createApp(db: AppDatabase) {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });
  registerAdminRoutes(app, db);
  registerBoardRoutes(app, db);
  return app;
}
