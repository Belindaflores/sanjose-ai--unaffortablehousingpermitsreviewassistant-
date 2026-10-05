import { Router, type IRouter } from "express";
import { ListBuildingPermitRecordsQueryParams, ListBuildingPermitRecordsResponse } from "@workspace/api-zod";
import { listBuildingPermits } from "../lib/public-building-permits";

const router: IRouter = Router();
router.get("/public-building-permits", async (req, res): Promise<void> => {
  const parsed = ListBuildingPermitRecordsQueryParams.safeParse({
    page: Number(req.query.page ?? 1),
    pageSize: Number(req.query.pageSize ?? 25),
    q: req.query.q ?? "",
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Use a positive page, page size 25, 50 or 100, and a search of at most 200 characters." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const result = await listBuildingPermits(parsed.data.page ?? 1, parsed.data.pageSize ?? 25, parsed.data.q ?? "");
    res.json(ListBuildingPermitRecordsResponse.parse(result));
  } catch (error) {
    req.log.warn({ error: error instanceof Error ? error.message : "Source request failed" }, "Official building-permit feed unavailable");
    res.status(503).json({ error: "The official City building-permit source is temporarily unavailable. Please retry; no portal applications were changed." });
  }
});
export default router;