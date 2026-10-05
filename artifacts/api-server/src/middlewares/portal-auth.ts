import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type PortalUser = typeof portalUsersTable.$inferSelect;
export const isStaff = (user: Pick<PortalUser, "role">) => user.role === "worker" || user.role === "fire_marshal";
export const canViewApplication = (user: Pick<PortalUser, "id" | "role">, ownerUserId: string | null | undefined) => isStaff(user) || ownerUserId === user.id;
export const requirePortalUser: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in to access permit records." }); return; }
  let [profile] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, userId));
  if (!profile) {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || email;
    [profile] = await db.insert(portalUsersTable).values({ id: userId, email, name, role: "applicant" }).onConflictDoNothing().returning();
    if (!profile) [profile] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, userId));
  }
  res.locals.portalUser = profile;
  next();
};
export const requireStaff: RequestHandler = (_req, res, next) => {
  if (!isStaff(res.locals.portalUser)) { res.status(403).json({ error: "Staff access must be assigned by an administrator. Selecting the worker portal does not grant permissions." }); return; }
  next();
};