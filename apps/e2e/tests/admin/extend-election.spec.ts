import type { Page } from "@playwright/test";
import { test, expect } from "../../fixtures/offline-test";
import { ACTIVE_ELECTION_ID, seedActiveElection, TEST_USERS } from "../../fixtures/db-setup";

function addHour(value: string): string {
  const date = new Date(`${value}:00`);
  date.setHours(date.getHours() + 1);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function openElection(page: Page) {
  const login = await page.request.post("/login", {
    data: {
      studentNumber: TEST_USERS.admin.studentId,
      password: TEST_USERS.admin.password,
      turnstileToken: "mock-token",
    },
  });
  expect(login.ok()).toBe(true);
  await page.goto(`/admin/elections/${ACTIVE_ELECTION_ID}`);
}

test.describe("Extend election control", () => {
  test.beforeEach(async () => {
    await seedActiveElection();
  });

  test("submits an extension, shows success, and refreshes the deadline", async ({ page }) => {
    await openElection(page);
    await page.getByRole("button", { name: "Extend voting" }).click();

    const dialog = page.getByRole("dialog", { name: "Extend voting" });
    const input = dialog.locator('input[type="datetime-local"]');
    const later = addHour(await input.inputValue());
    await input.fill(later);

    const extensionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/elections/${ACTIVE_ELECTION_ID}/extensions`,
    );
    const refreshResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === `/elections/${ACTIVE_ELECTION_ID}`,
    );

    await dialog.getByRole("button", { name: "Extend voting" }).click();
    expect((await extensionResponse).ok()).toBe(true);
    expect((await refreshResponse).ok()).toBe(true);
    await expect(
      page.getByRole("alert").filter({
        hasText: "Election closing time extended successfully",
      }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Extend voting" }).click();
    await expect(page.getByRole("dialog", { name: "Extend voting" }).locator("input")).toHaveValue(
      later,
    );
  });

  test("validates the deadline and reports an API error", async ({ page }) => {
    await openElection(page);
    await page.getByRole("button", { name: "Extend voting" }).click();

    const dialog = page.getByRole("dialog", { name: "Extend voting" });
    const input = dialog.locator('input[type="datetime-local"]');
    const current = await input.inputValue();
    await dialog
      .locator("form")
      .evaluate((form) =>
        form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true })),
      );
    await expect(
      dialog.getByText("New closing time must be later than the current closing time"),
    ).toBeVisible();

    await page.route(`**/elections/${ACTIVE_ELECTION_ID}/extensions`, (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "Extension rejected by test" }),
      }),
    );
    await input.fill(addHour(current));
    await dialog.getByRole("button", { name: "Extend voting" }).click();

    await expect(dialog.getByText("Extension rejected by test")).toBeVisible();
    await expect(
      page.getByRole("alert").filter({ hasText: "Extension rejected by test" }),
    ).toBeVisible();
  });
});
