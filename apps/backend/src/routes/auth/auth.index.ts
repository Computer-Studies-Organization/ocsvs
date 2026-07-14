import * as handlers from "@/handlers/auth/auth.handler";
import { createRouter } from "@/lib/create-app";
import { requireAuth } from "@/middleware/auth";
import { createIpRateLimiter } from "@/middleware/rate-limit";
import { loginRoute, logoutRoute, meRoute } from "./routes";

const router = createRouter();

// Per-IP rate limiting on public auth endpoints (runs before handlers).
// Registered via router.use() before .openapi() so the middleware executes first.
// /login is an exact POST path with no sub-routes, so the
// Workers router.use() prefix-match bug does not apply here.
router.use("/login", createIpRateLimiter("LOGIN_IP_LIMITER"));

router.openapi(loginRoute, handlers.login).openapi(logoutRoute, handlers.logout);

// Protected routes - apply middleware before OpenAPI route definition
router.use("/me", requireAuth);
router.openapi(meRoute, handlers.me);

export default router;
