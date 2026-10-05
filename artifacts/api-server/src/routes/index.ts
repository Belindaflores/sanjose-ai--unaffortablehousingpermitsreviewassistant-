import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitApplicationsRouter from "./permit-applications";
import countyPublicRecordsRouter from "./county-public-records";
import savedApplicationsRouter from "./saved-applications";
import portalUserRouter from "./portal-user";
import permitRuleConfigRouter from "./permit-rule-config";
import storageRouter from "./storage";
import portalReviewRecordsRouter from "./portal-review-records";

const router: IRouter = Router();

router.use(healthRouter);
router.use(portalUserRouter);
router.use(permitRuleConfigRouter);
router.use(storageRouter);
router.use(permitApplicationsRouter);
router.use(countyPublicRecordsRouter);
router.use(portalReviewRecordsRouter);
router.use(savedApplicationsRouter);

export default router;
