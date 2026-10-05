// Development-only administrative seed; the authenticated list endpoint also
// creates the private records on first visit after the production schema is published.
import { db, pool, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureStarterDrafts, starterDraftEmail } from "../lib/saved-application-seeds";

try {
  const users = await db.select().from(portalUsersTable).where(eq(portalUsersTable.email, starterDraftEmail));
  if (users.length !== 1) throw new Error("Expected exactly one existing account for the requested email.");
  await ensureStarterDrafts(users[0]!);
  console.log("The account-owned Meridian draft and Opal presentation record are available.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}