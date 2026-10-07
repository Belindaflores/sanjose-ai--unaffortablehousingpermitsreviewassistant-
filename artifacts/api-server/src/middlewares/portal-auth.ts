import type { RequestHandler } from "express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getPortalRole } from "@workspace/app-access";
import { starterDraftEmail } from "../lib/saved-application-seeds";

export type PortalUser = typeof portalUsersTable.$inferSelect;
export const isStaff = (user: Pick<PortalUser, "role">) => user.role === "worker" || user.role === "fire_marshal";
export const canViewApplication = (user: Pick<PortalUser, "id" | "role">, ownerUserId: string | null | undefined) => isStaff(user) || ownerUserId === user.id;
// Passcode-only access uses shared prototype profiles. Reuse the existing
// presentation account so its saved records remain visible without migration.
export async function portalProfile(role: "applicant" | "worker"): Promise<PortalUser> {
  const id = `passcode-portal-${role}`;
  let [profile] = await db.select().from(portalUsersTable).where(
    role === "applicant" ? eq(portalUsersTable.email, starterDraftEmail) : eq(portalUsersTable.id, id),
  );
  if (!profile) {
    [profile] = await db.insert(portalUsersTable).values({
      id, email: role === "applicant" ? starterDraftEmail : "prototype.worker@example.com",
      name: role === "applicant" ? "Permit Applicant" : "City Worker", role,
    }).onConflictDoNothing().returning();
    if (!profile) [profile] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, id));
  }
  if (!profile) throw new Error("The selected portal profile could not be loaded.");
  // Selecting applicant always retains applicant permissions, even if the
  // presentation account previously had a staff role.
  return { ...profile, role };
}
export const requirePortalUser: RequestHandler = async (req, res, next) => {
  const role = getPortalRole(req);
  if (!role) { res.status(401).json({ error: "Choose a portal to continue.", code: "PORTAL_SELECTION_REQUIRED" }); return; }
  res.locals.portalUser = await portalProfile(role);
  next();
};
export const requireStaff: RequestHandler = (_req, res, next) => {
  if (!isStaff(res.locals.portalUser)) { res.status(403).json({ error: "Choose the City Worker portal to access staff actions." }); return; }
  next();
};