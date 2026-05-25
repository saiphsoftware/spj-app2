import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import puzzlesRouter from "./puzzles";
import piecesRouter from "./pieces";
import usersRouter from "./users";
import storeRouter from "./store";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(puzzlesRouter);
router.use(piecesRouter);
router.use(usersRouter);
router.use(storeRouter);

export default router;
