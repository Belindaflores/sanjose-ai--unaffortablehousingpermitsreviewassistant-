import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitApplicationsRouter from "./permit-applications";
import { requireIdentity } from "../middlewares/identity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireIdentity);
router.use(permitApplicationsRouter);

export default router;
