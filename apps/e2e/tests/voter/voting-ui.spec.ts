import { test, expect } from "../../fixtures/offline-test";
import { TEST_USERS, seedActiveElection } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";
import { VotingPage } from "../../fixtures/page-objects/VotingPage";

test.describe("Voter Journey Browser UI", () => {
  test.beforeEach(async () => {
    await seedActiveElection();
  });
  test("voter logs in, selects candidates, and submits ballot successfully", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    // 1. Login as voter
    await loginPage.goto();
    await loginPage.login(TEST_USERS.voter.studentId, TEST_USERS.voter.password);

    // 2. Navigate to voting page
    await votingPage.goto();

    // 2. Advance through candidates and navigate to Review step
    await votingPage.selectCandidateByName();
    await votingPage.clickNext();
    await votingPage.selectCandidateByName();

    const reviewNode = page.locator('button[aria-label="Go to Review step"]');
    if (await reviewNode.isVisible().catch(() => false)) {
      await reviewNode.click();
    } else {
      await votingPage.clickNext();
    }

    // 4. Submit ballot
    await votingPage.submitBallot();

    // 5. Verify post-submission thank you / voted state
    await votingPage.expectAlreadyVotedMessage();
  });

  test("prevents double voting on revisit to /voting", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.votedVoter.studentId, TEST_USERS.votedVoter.password);
    await votingPage.goto();

    // Verify double-voting is prevented by asserting already voted state
    await votingPage.expectAlreadyVotedMessage();
  });

  test("expands a manifesto with the keyboard without selecting the candidate", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.voter.studentId, TEST_USERS.voter.password);
    await votingPage.goto();

    const selectButton = page.getByRole("button", { name: "Select Alice President" });
    const card = selectButton.locator("..");
    const manifestoToggle = card.locator("button").filter({ hasText: /Read (More|Less)/ });

    await expect(manifestoToggle).toBeVisible({ timeout: 15000 });
    await expect(selectButton).toHaveAttribute("aria-pressed", "false");

    await manifestoToggle.press("Space");
    await expect(manifestoToggle).toHaveText("Read Less");
    await expect(selectButton).toHaveAttribute("aria-pressed", "false");

    await manifestoToggle.press("Enter");
    await expect(manifestoToggle).toHaveText("Read More");
    await expect(selectButton).toHaveAttribute("aria-pressed", "false");
  });
});
