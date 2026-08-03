import { expect, test } from "@playwright/test";

test.describe("Worker asset routing", () => {
  test("serves the SPA shell and health endpoint from one origin", async ({ page, request }) => {
    const rootResponse = await page.goto("/");
    expect(rootResponse?.ok()).toBe(true);
    expect(rootResponse?.headers()["content-type"]).toContain("text/html");

    const authResponse = await page.goto("/auth");
    expect(authResponse?.ok()).toBe(true);
    expect(authResponse?.headers()["content-type"]).toContain("text/html");

    const healthResponse = await request.get("/health");
    expect(healthResponse.ok()).toBe(true);
    await expect(healthResponse.json()).resolves.toEqual({ status: "ok" });
  });
});
