import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitApplicationsRouter from "./permit-applications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(permitApplicationsRouter);

export default router;
