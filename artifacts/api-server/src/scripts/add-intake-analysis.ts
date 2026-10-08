import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

try {
  await db.execute(sql`ALTER TABLE permit_applications ADD COLUMN IF NOT EXISTS intake_analysis jsonb`);
  logger.info("Intake analysis column is available; existing records are unchanged");
} finally {
  await pool.end();
}
