import { Router } from "express";
import { db, portalUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetPortalUserResponse, RequestStaffAccessResponse } from "@workspace/api-zod";
import { requirePortalUser } from "../middlewares/portal-auth";

const router = Router();
router.use("/portal-user", requirePortalUser);
router.get("/portal-user", (_req, res) => { res.json(GetPortalUserResponse.parse(res.locals.portalUser)); });
router.post("/portal-user", async (_req, res): Promise<void> => {
  const [profile] = await db.update(portalUsersTable).set({ staffAccessRequested: true }).where(eq(portalUsersTable.id, res.locals.portalUser.id)).returning();
  res.json(RequestStaffAccessResponse.parse(profile));
});
export default router;