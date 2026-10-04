// Administrative shell operation only; never exposed as an applicant-facing endpoint.
import { db, pool, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
const [userId, role] = process.argv.slice(2);
if (!userId?.startsWith("user_") || !["applicant", "worker", "fire_marshal"].includes(role ?? "")) {
  console.error("Usage: pnpm --filter @workspace/api-server exec tsx src/scripts/set-portal-role.ts <Clerk user ID> <applicant|worker|fire_marshal>");
  process.exitCode = 1;
} else {
  const [user] = await db.update(portalUsersTable).set({ role: role!, staffAccessRequested: false }).where(eq(portalUsersTable.id, userId)).returning({ id: portalUsersTable.id });
  if (!user) { console.error("No portal profile found. This user must sign in first."); process.exitCode = 1; }
  else console.log(`Assigned ${role} access to ${user.id}. Existing sessions refresh their permissions automatically.`);
}
await pool.end();