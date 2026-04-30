import { createApp } from "./app.js";
import { openDatabase } from "./db/database.js";

const db = openDatabase();
const app = createApp(db);

await app.listen({ port: 4000, host: "0.0.0.0" });
