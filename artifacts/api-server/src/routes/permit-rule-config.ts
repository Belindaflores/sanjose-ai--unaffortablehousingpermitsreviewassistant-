import { Router } from "express";
import { db, permitRuleConfigsTable } from "@workspace/db";
import { GetPermitRuleConfigResponse, UpdatePermitRuleConfigBody, UpdatePermitRuleConfigResponse } from "@workspace/api-zod";
import { readRuleConfig } from "../lib/permit-screening";
import { requirePortalUser, requireStaff } from "../middlewares/portal-auth";

const router = Router();
router.use("/permit-rule-config", requirePortalUser);
router.get("/permit-rule-config", async (_req, res): Promise<void> => { res.json(GetPermitRuleConfigResponse.parse(await readRuleConfig())); });
router.put("/permit-rule-config", requireStaff, async (req, res): Promise<void> => {
  const parsed = UpdatePermitRuleConfigBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.updateNote?.trim()) { res.status(400).json({ error: "A valid configuration and a staff update note are required." }); return; }
  const values = { id: "underserved-areas", zips: parsed.data.zips, censusTracts: parsed.data.censusTracts, placeholder: parsed.data.placeholder, updateNote: parsed.data.updateNote.trim(), updatedBy: res.locals.portalUser.id, updatedAt: new Date() };
  const [saved] = await db.insert(permitRuleConfigsTable).values(values).onConflictDoUpdate({ target: permitRuleConfigsTable.id, set: values }).returning();
  res.json(UpdatePermitRuleConfigResponse.parse({ ...saved, updatedAt: saved!.updatedAt.toISOString() }));
});
export default router;