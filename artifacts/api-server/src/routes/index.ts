import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitApplicationsRouter from "./permit-applications";
import countyPublicRecordsRouter from "./county-public-records";
import portalUserRouter from "./portal-user";
import permitRuleConfigRouter from "./permit-rule-config";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portalUserRouter);
router.use(permitRuleConfigRouter);
router.use(storageRouter);
router.use(permitApplicationsRouter);
router.use(countyPublicRecordsRouter);

export default router;
