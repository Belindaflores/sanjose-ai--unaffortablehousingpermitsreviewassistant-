import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// The workspace database can close idle connections when it is restarted.
// pg removes that connection; an unhandled pool error must not crash the API.
pool.on("error", () => console.error("An idle database connection closed; subsequent requests will use a new connection."));
export const db = drizzle(pool, { schema });

export * from "./schema";
