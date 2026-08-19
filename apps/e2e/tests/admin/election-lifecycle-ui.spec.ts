import { test, expect } from "../../fixtures/offline-test";
import { TEST_USERS } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";
import { AdminElectionsPage } from "../../fixtures/page-objects/AdminElectionsPage";

test.describe("Admin Election Management UI", () => {
  test("admin creates draft election, manages state transitions and views list", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const adminElectionsPage = new AdminElectionsPage(page);

    // 1. Admin login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    // 2. Go to admin elections page
    await adminElectionsPage.goto();
    await expect(page.locator("h1")).toContainText("Elections");

    // 3. Create a new election draft
    const electionName = `E2E UI Election ${Date.now()}`;
    await adminElectionsPage.openCreateModal();
    await adminElectionsPage.fillElectionForm(electionName, "Created by Playwright E2E UI Suite");
    await adminElectionsPage.submitCreateForm();

    // 4. Verify election appears in list
    await adminElectionsPage.expectElectionTitleInList(electionName);
  });
});
