import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/db-setup';
import { LoginPage } from '../../fixtures/page-objects/LoginPage';

test.describe('Role-Based Access Control (RBAC) Navigation UI', () => {
  test('redirects unauthenticated users attempting to access admin routes', async ({ page }) => {
    await page.goto('/admin/elections');
    // Unauthenticated access should redirect to /auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('redirects regular voter attempting to access admin routes', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.voter.studentId, TEST_USERS.voter.password);

    await page.goto('/admin/elections');
    // Voter account should be blocked/redirected away from admin paths
    await expect(page).not.toHaveURL(/\/admin\/elections/);
  });
});
