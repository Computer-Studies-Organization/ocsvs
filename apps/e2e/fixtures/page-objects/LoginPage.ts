import { type Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/auth');
  }

  async login(studentNumber: string, password: string) {
    await this.page.fill('#studentNumber', studentNumber);
    await this.page.fill('#password', password);
    await expect(this.page.locator('button[type="submit"]')).toBeEnabled();
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL((url) => !url.pathname.endsWith('/auth'));
  }

  async expectLoginFormVisible() {
    await expect(this.page.locator('#studentNumber')).toBeVisible();
    await expect(this.page.locator('#password')).toBeVisible();
    await expect(this.page.locator('button[type="submit"]')).toBeVisible();
  }
}
