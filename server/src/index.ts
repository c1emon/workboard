import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const db = openDatabase();
const app = createApp(db);
const port = Number(process.env.PORT ?? 4000);

await app.listen({ port, host: "0.0.0.0" });
