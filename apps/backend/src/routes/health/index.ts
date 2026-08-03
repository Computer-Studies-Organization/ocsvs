import { createRouter } from "@/lib/create-app";
import { healthRoute } from "./routes";

const router = createRouter();

router.openapi(healthRoute, (c) => c.json({ status: "ok" }));

export default router;
