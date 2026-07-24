import { type Page, expect } from '@playwright/test';

export class VotingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/voting');
  }

  async selectCandidateByName(candidateName: string) {
    // Locate card containing candidate name and click it
    const candidateCard = this.page.locator('button, div').filter({ hasText: candidateName }).first();
    await candidateCard.click();
  }

  async clickNext() {
    await this.page.click('button:has-text("Next"), button:has-text("Review Ballot")');
  }

  async submitBallot() {
    await this.page.click('button:has-text("Submit Vote"), button:has-text("Confirm Vote")');
  }

  async expectThankYouMessage() {
    await expect(this.page.locator('h1')).toContainText('Thank you for voting!');
  }

  async expectNoActiveElectionMessage() {
    await expect(this.page.locator('body')).toContainText(/No active election|No elections scheduled|has ended/i);
  }

  async expectAlreadyVotedMessage() {
    await expect(this.page.locator('body')).toContainText(/Thank you for voting|Your vote.*has been recorded|Already voted/i);
  }
}
