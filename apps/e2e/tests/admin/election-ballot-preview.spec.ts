import { test, expect } from "../../fixtures/offline-test";
import {
  ACTIVE_ELECTION_ID,
  TEST_USERS,
  createTestDatabaseClient,
  seedActiveElection,
} from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";

test.describe("Admin Election Ballot Preview UI", () => {
  test.beforeEach(async () => {
    await seedActiveElection();
  });

  test("admin navigates to ballot preview, interacts with simulation, and resets without database mutation", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const interceptedVoteRequests: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/votes")) {
        interceptedVoteRequests.push(req.url());
      }
    });

    // 1. Log in as admin
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    // 2. Navigate to admin election detail
    await page.goto(`/admin/elections/${ACTIVE_ELECTION_ID}`);
    await expect(page.locator("h1")).toContainText("E2E Active Student Council Election");

    // 3. Click the "Preview ballot" button
    const previewBtn = page.locator('a:has-text("Preview ballot")');
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // 4. Verify preview route and banner
    await expect(page).toHaveURL(`/admin/elections/${ACTIVE_ELECTION_ID}/preview`);
    await expect(page.locator("text=Sandbox Mode")).toBeVisible();
    await expect(
      page.locator("text=You are previewing the exact voter ballot interface"),
    ).toBeVisible();

    // 5. Select a candidate in the first position
    const firstCandidateCard = page.locator('button[aria-label^="Select"]').first();
    await expect(firstCandidateCard).toBeVisible();
    await firstCandidateCard.click();

    // 6. Click Next to advance position
    const nextBtn = page.locator('button:has-text("Next")');
    await nextBtn.click();

    // 7. Select a candidate in the second position
    const secondCandidateCard = page.locator('button[aria-label^="Select"]').first();
    await expect(secondCandidateCard).toBeVisible();
    await secondCandidateCard.click();

    // 8. Advance to Review step
    await nextBtn.click();
    await expect(page.locator("text=Review Ballot")).toBeVisible();

    // 9. Submit the simulated ballot
    const submitBtn = page.locator('button:has-text("Submit ballot")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // 10. Verify simulation completion card
    await expect(page.locator("text=Ballot Simulation Complete!")).toBeVisible();
    await expect(
      page.locator("text=All ballot steps and selections were successfully completed"),
    ).toBeVisible();

    // 11. Assert no vote submission requests were dispatched
    expect(interceptedVoteRequests).toHaveLength(0);

    // 12. Assert database state remains unmutated (zero votes/ballots/participation recorded)
    const client = createTestDatabaseClient();
    const [votesRes, ballotsRes, participationRes] = await Promise.all([
      client.execute({
        sql: "SELECT COUNT(*) as count FROM votes WHERE election_id = ?",
        args: [ACTIVE_ELECTION_ID],
      }),
      client.execute({
        sql: "SELECT COUNT(*) as count FROM ballot_snapshots WHERE election_id = ?",
        args: [ACTIVE_ELECTION_ID],
      }),
      client.execute({
        sql: "SELECT COUNT(*) as count FROM voter_election_participation WHERE election_id = ?",
        args: [ACTIVE_ELECTION_ID],
      }),
    ]);
    expect(Number(votesRes.rows[0].count)).toBe(0);
    expect(Number(ballotsRes.rows[0].count)).toBe(0);
    expect(Number(participationRes.rows[0].count)).toBe(0);

    // 13. Test restart simulation
    const restartBtn = page.locator('button:has-text("Restart simulation")');
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();
    await expect(page.locator("text=Step 1 of")).toBeVisible();

    // 14. Return to election management
    const backLink = page.locator('a:has-text("Back to election")');
    await backLink.click();
    await expect(page).toHaveURL(`/admin/elections/${ACTIVE_ELECTION_ID}`);
  });
});
