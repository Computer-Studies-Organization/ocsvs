import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";

test.describe("Admin Audit Log Interactivity & Pagination UI", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Admin login
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);
  });

  test("admin can view audit logs, expand details, filter, and change page size with mock API", async ({
    page,
  }) => {
    // Mock the audit log API request
    await page.route("**/audit-log*", async (route) => {
      if (route.request().resourceType() !== "fetch") {
        return route.continue();
      }
      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      const action = url.searchParams.get("action");

      if (cursor === "page-2") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "test-log-2",
                createdAt: Math.floor(Date.now() / 1000) - 3600,
                action: "user.create",
                targetType: "user",
                targetId: "test-voter-id",
                actorAccountIdSnapshot: "test-actor-account-id",
                actorUsernameSnapshot: "test-admin",
                description: "created user voter-1",
              },
            ],
            nextCursor: null,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items:
              action === "election.create"
                ? [
                    {
                      id: "test-log-1",
                      createdAt: Math.floor(Date.now() / 1000),
                      action: "election.create",
                      targetType: "election",
                      targetId: "test-election-id",
                      actorAccountIdSnapshot: "test-actor-account-id-1",
                      actorUsernameSnapshot: "test-admin",
                      description: "created election test",
                    },
                  ]
                : [
                    {
                      id: "test-log-1",
                      createdAt: Math.floor(Date.now() / 1000),
                      action: "election.create",
                      targetType: "election",
                      targetId: "test-election-id",
                      actorAccountIdSnapshot: "test-actor-account-id-1",
                      actorUsernameSnapshot: "test-admin",
                      description: "created election test",
                    },
                    {
                      id: "test-log-other",
                      createdAt: Math.floor(Date.now() / 1000) - 60,
                      action: "user.create",
                      targetType: "user",
                      targetId: "test-voter-id",
                      actorAccountIdSnapshot: "test-actor-account-id-2",
                      actorUsernameSnapshot: "test-admin",
                      description: "created user voter-1",
                    },
                  ],
            nextCursor: action ? null : "page-2",
          }),
        });
      }
    });

    // 2. Go to audit log page
    await page.goto("/admin/audit-log");
    await expect(page.locator("h1")).toContainText("Audit Log");

    // 3. Verify page structure and initial table has our mock item
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(page.locator("text=election.create")).toBeVisible();

    // 4. Test row expansion (toggle detail row)
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();

    // Click the row to expand details
    await firstRow.click();

    // Verify expanded details panel/div is visible
    const detailsPanel = page.locator("text=Actor Account ID");
    await expect(detailsPanel).toBeVisible();
    await expect(page.locator("text=test-actor-account-id-1")).toBeVisible();

    // Click it again to collapse details
    await firstRow.click();
    await expect(detailsPanel).not.toBeVisible();

    // 5. Test filtering and page size changes
    await page.getByRole("button", { name: "Filters" }).click();
    const filteredRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        request.resourceType() === "fetch" && url.searchParams.get("action") === "election.create"
      );
    });
    await page.locator("#filter-action").selectOption("election.create");
    await filteredRequest;
    await expect(page.locator("tbody")).toContainText("election.create");
    await expect(page.locator("tbody")).not.toContainText("user.create");

    const pageSizeSelect = page.locator("#page-size-select");
    await expect(pageSizeSelect).toBeVisible();
    await pageSizeSelect.selectOption("20");
    await expect(pageSizeSelect).toHaveValue("20");
    await expect(page).toHaveURL(/limit=20/);

    // Verify pagination text indicates Page 1
    const paginationInfo = page.locator("text=Page 1");
    await expect(paginationInfo).toBeVisible();
  });

  test("does not skip rows at the 100-row batch boundary when showing 20 rows", async ({
    page,
  }) => {
    const makeAuditLogItem = (index: number) => ({
      id: `test-log-${index}`,
      createdAt: 1_700_000_000 - index,
      action: "user.create" as const,
      targetType: "user" as const,
      targetId: `audit-row-${index}`,
      actorAccountIdSnapshot: "test-actor-account-id",
      actorUsernameSnapshot: "test-admin",
      description: `created user ${index}`,
    });

    await page.route("**/audit-log*", async (route) => {
      if (route.request().resourceType() !== "fetch") {
        return route.continue();
      }

      const url = new URL(route.request().url());
      const cursor = url.searchParams.get("cursor");
      const requestedLimit = Number(url.searchParams.get("limit"));
      const start = cursor ? requestedLimit : 0;
      const count = cursor ? 50 : requestedLimit;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: Array.from({ length: count }, (_, index) => makeAuditLogItem(start + index)),
          nextCursor: cursor ? null : "page-2",
        }),
      });
    });

    await page.goto("/admin/audit-log");
    await page.locator("#page-size-select").selectOption("20");

    const nextButton = page.getByRole("button", { name: "Next" });
    for (let pageNumber = 0; pageNumber < 4; pageNumber += 1) {
      await nextButton.click();
    }

    const cursorRequest = page.waitForRequest(
      (request) => new URL(request.url()).searchParams.get("cursor") === "page-2",
    );
    await nextButton.click();
    await cursorRequest;
    await expect(page.getByText("audit-row-100")).toBeVisible();

    await nextButton.click();
    await expect(page.getByText("audit-row-120")).toBeVisible();
  });
});
