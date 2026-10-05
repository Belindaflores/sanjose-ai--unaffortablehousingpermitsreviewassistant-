// Development-only administrative seed; the authenticated list endpoint also
// creates the same private account records after the production schema is published.
import { db, pool, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureStarterDrafts, starterDraftEmail } from "../lib/saved-application-seeds";

try {
  const users = await db.select().from(portalUsersTable).where(eq(portalUsersTable.email, starterDraftEmail));
  if (users.length !== 1) throw new Error("Expected exactly one existing account for the requested email.");
  await ensureStarterDrafts(users[0]!);
  console.log("One submitted presentation record and one saved draft are available for the requested account.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}