import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitApplicationsRouter from "./permit-applications";
import countyPublicRecordsRouter from "./county-public-records";

const router: IRouter = Router();

router.use(healthRouter);
router.use(permitApplicationsRouter);
router.use(countyPublicRecordsRouter);

export default router;
