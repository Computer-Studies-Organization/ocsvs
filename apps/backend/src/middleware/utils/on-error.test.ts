import { describe, expect, it, vi } from "vitest";
import onError from "./on-error";

describe("onError", () => {
  it("logs unexpected exceptions with their stack before returning 500", async () => {
    const error = new Error("database unavailable");
    const logger = { error: vi.fn() };
    const context = {
      env: { NODE_ENV: "production" },
      var: { logger },
      json: vi.fn(
        (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
      ),
    } as any;

    const response = await onError(error, context);

    expect(response.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith({ err: error }, "Unhandled request error");
    expect(await response.json()).toEqual({ message: "Internal Server Error" });
  });
});
