import Router, {Request, Response} from "express";

const router = Router();

router.get("/api/test", async (req: Request, res: Response) => {
    return res.status(200).json('ok');
});

export default router;