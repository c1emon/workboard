import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const db = openDatabase(process.env.WORKBOARD_DB_FILE);
const app = createApp(db);
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });
