import { Router, type IRouter } from "express";
import { requirePortalUser, requireStaff } from "../middlewares/portal-auth";
import { getCityWorkerWorkspace, getCityWorkerRecord } from "../lib/city-worker-records";

const router: IRouter = Router();
router.get("/portal-review-records", requirePortalUser, requireStaff, async (_req, res): Promise<void> => {
  res.json(await getCityWorkerWorkspace(res.locals.portalUser.workspaceId));
});
router.get("/portal-review-records/:id", requirePortalUser, requireStaff, async (req, res): Promise<void> => {
  const record = await getCityWorkerRecord(res.locals.portalUser.workspaceId, String(req.params.id));
  if (!record) { res.status(404).json({ error: "Portal review record not found." }); return; }
  res.json(record);
});
export default router;