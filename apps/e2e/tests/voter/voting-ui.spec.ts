import { test, expect } from "@playwright/test";
import { TEST_USERS, resetVoterVotes } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";
import { VotingPage } from "../../fixtures/page-objects/VotingPage";

test.describe("Voter Journey Browser UI", () => {
  test.beforeEach(async () => {
    await resetVoterVotes();
  });
  test("voter logs in, selects candidates, and submits ballot successfully", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    // 1. Login as voter
    await loginPage.goto();
    await loginPage.login(TEST_USERS.voter.studentId, TEST_USERS.voter.password);

    // 2. Navigate to voting page
    await votingPage.goto();

    // 2. Verify active election header and candidate grid are loaded
    await page.waitForSelector('.grid [role="button"]', { timeout: 15000 });

    // 3. Advance through candidates and navigate to Review step
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
});
