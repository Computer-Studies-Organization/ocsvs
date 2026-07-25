import { type Page, expect } from '@playwright/test';

export class AdminElectionsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/admin/elections');
  }

  async openCreateModal() {
    await this.page.click('button:has-text("New election"), button:has-text("Create election")');
  }

  async fillElectionForm(name: string, description: string) {
    await this.page.fill('input#createElectionName, input[name="name"], input[placeholder*="title"], input[placeholder*="Name"], input#name', name);
    if (description) {
      await this.page.fill('textarea#createElectionDescription, textarea[name="description"], textarea#description', description);
    }
  }

  async submitCreateForm() {
    await this.page.click('form button[type="submit"], button:has-text("Save"), button:has-text("Create")');
  }

  async expectElectionTitleInList(name: string) {
    await expect(this.page.locator(`text=${name}`)).toBeVisible();
  }
}
