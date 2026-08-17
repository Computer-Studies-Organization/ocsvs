import { createRouter } from "@/lib/create-app";
import { createDb } from "@/config/db";
import { sql } from "drizzle-orm";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { healthRoute, readinessRoute } from "./routes";

const router = createRouter();

router.openapi(healthRoute, (c) => c.json({ status: "ok" }));

router.openapi(readinessRoute, async (c) => {
  try {
    const { db } = createDb(c);
    await db.run(sql`SELECT 1`);
    return c.json({ status: "ok" }, httpStatusCodes.OK);
  } catch (err) {
    c.var.logger.error({ err }, "Readiness check failed");
    return c.json({ status: "unavailable" }, httpStatusCodes.SERVICE_UNAVAILABLE);
  }
});

export default router;
