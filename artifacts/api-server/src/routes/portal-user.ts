import { Router } from "express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetPortalUserResponse, RequestStaffAccessResponse, SelectPortalRoleBody } from "@workspace/api-zod";
import { requirePortalUser, portalProfile } from "../middlewares/portal-auth";
import { sameOrigin, setPortalRole } from "@workspace/app-access";

const router = Router();
router.post("/portal-session", async (req, res): Promise<void> => {
  if (!sameOrigin(req)) { res.status(403).json({ error: "This request is not allowed." }); return; }
  const input = SelectPortalRoleBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Choose Permit Applicant or City Worker." }); return; }
  const profile = GetPortalUserResponse.parse(await portalProfile(input.data.role));
  setPortalRole(req, res, input.data.role);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(profile);
});
router.delete("/portal-session", (req, res) => {
  if (!sameOrigin(req)) { res.status(403).json({ error: "This request is not allowed." }); return; }
  setPortalRole(req, res, null);
  res.status(204).end();
});
router.use("/portal-user", requirePortalUser);
router.get("/portal-user", (_req, res) => { res.json(GetPortalUserResponse.parse(res.locals.portalUser)); });
router.post("/portal-user", async (_req, res): Promise<void> => {
  const [profile] = await db.update(portalUsersTable).set({ staffAccessRequested: true }).where(eq(portalUsersTable.id, res.locals.portalUser.id)).returning();
  res.json(RequestStaffAccessResponse.parse(profile));
});
export default router;