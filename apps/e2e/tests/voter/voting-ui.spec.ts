import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/db-setup';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';
import { VotingPage } from '../../fixtures/page-objects/VotingPage';

test.describe('Voter Journey Browser UI', () => {
  test('voter logs in, selects candidates, and submits ballot successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    // 1. Login as voter
    await loginPage.goto();
    await loginPage.login(TEST_USERS.voter.studentId, TEST_USERS.voter.password);

    // 2. Navigate to voting page
    await votingPage.goto();

    // Verify active election header is displayed
    await expect(page.locator('h1')).toContainText(/Student Council Election|Active/i);

    // 3. Select Candidate for President position
    await votingPage.selectCandidateByName('Alice President');

    // 4. Click Next/Review
    await votingPage.clickNext();

    // 5. Select Vice President if step is active
    const vpCard = page.locator('text=Charlie VP').first();
    if (await vpCard.isVisible()) {
      await votingPage.selectCandidateByName('Charlie VP');
      await votingPage.clickNext();
    }

    // 6. Submit ballot
    await votingPage.submitBallot();

    // 7. Verify post-submission thank you state or voted state
    await votingPage.expectAlreadyVotedMessage();
  });

  test('prevents double voting on revisit to /voting', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const votingPage = new VotingPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.votedVoter.studentId, TEST_USERS.votedVoter.password);
    await votingPage.goto();

    // Verify double-voting is prevented by asserting already voted state
    await votingPage.expectAlreadyVotedMessage();
  });
});
