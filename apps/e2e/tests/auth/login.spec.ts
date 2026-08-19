import { test, expect } from "../../fixtures/offline-test";
import { TEST_USERS } from "../../fixtures/db-setup";

test.describe("Authentication - Login Page", () => {
  test("renders login form with expected inputs and title", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator("h1")).toContainText("Student Elections");
    await expect(page.locator("#studentNumber")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("offline login omits Turnstile and keeps the form usable", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.locator('script[src*="challenges.cloudflare.com"]')).toHaveCount(0);
    await expect(page.locator("#studentNumber")).toBeEditable();
    await expect(page.locator("#password")).toBeEditable();
  });

  test("backend login API validates incorrect credentials", async ({ request }) => {
    const response = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: "C99-99-99999-INVALID",
        password: "WrongPassword123!",
        turnstileToken: "mock-token",
      },
    });

    expect(response.ok()).toBe(false);
    expect([401, 400, 422]).toContain(response.status());
  });

  test("backend login API authenticates valid voter credentials", async ({ request }) => {
    const response = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: "mock-token",
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.role).toBe("user");
  });

  test("backend login API authenticates valid admin credentials", async ({ request }) => {
    const response = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.admin.studentId,
        password: TEST_USERS.admin.password,
        turnstileToken: "mock-token",
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(["admin", "super_admin"]).toContain(body.user.role);
  });
});
