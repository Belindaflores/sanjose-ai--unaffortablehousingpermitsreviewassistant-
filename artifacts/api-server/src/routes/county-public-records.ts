import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, countyPublicRecordsTable } from "@workspace/db";
import { ListCountyPublicRecordsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/county-public-records", async (_req, res): Promise<void> => {
  const records = await db
    .select()
    .from(countyPublicRecordsTable)
    .orderBy(desc(countyPublicRecordsTable.receivedDate));

  res.json(ListCountyPublicRecordsResponse.parse(records));
});

export default router;