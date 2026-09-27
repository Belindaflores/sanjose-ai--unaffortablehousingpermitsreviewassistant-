// Run only from a trusted workspace shell. Never expose this as an HTTP endpoint.
import { clerkClient } from "@clerk/express";

const [userId, role] = process.argv.slice(2);
if (!userId || !["worker", "applicant"].includes(role)) {
  process.stderr.write("Usage: node scripts/set-worker-role.mjs <clerk-user-id> <worker|applicant>\n");
  process.exit(1);
}

const user = await clerkClient.users.getUser(userId);
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: { ...user.publicMetadata, role },
});
process.stdout.write(`Updated role for ${userId} to ${role}\n`);