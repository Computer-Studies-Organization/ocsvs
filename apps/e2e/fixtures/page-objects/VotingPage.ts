import { type Page, expect } from "@playwright/test";

export class VotingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/voting");
  }

  async selectCandidateByName(candidateName?: string) {
    const candidateButton = candidateName
      ? this.page.getByRole("button", { name: `Select ${candidateName}`, exact: true })
      : this.page.getByRole("button", { name: /^Select / }).first();
    await expect(candidateButton).toBeVisible({ timeout: 10000 });
    await candidateButton.click();
    await this.page.waitForTimeout(400);
  }

  async clickNext() {
    const nextBtn = this.page
      .locator(
        'button:has-text("Next_Step"), button:has-text("Next"), button:has-text("Review Ballot")',
      )
      .first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
    await nextBtn.click();
    await this.page.waitForTimeout(500);
  }

  async submitBallot() {
    const submitBtn = this.page
      .locator(
        'button:has-text("Submit Ballot"), button:has-text("Submit Vote"), button:has-text("Confirm Vote")',
      )
      .first();
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();
  }
  async expectAlreadyVotedMessage() {
    await expect(this.page.locator("body")).toContainText(
      /Thank you for voting|Your vote.*has been recorded|Already voted/i,
      { timeout: 15000 },
    );
  }
}
