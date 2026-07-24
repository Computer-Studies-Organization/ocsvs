import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seedTestUsers, seedActiveElection, TEST_USERS } from './fixtures/db-setup';

const authDir = path.join(__dirname, '.auth');

setup('global setup and authentication', async ({ page }) => {
  // Ensure DB seed runs
  await seedTestUsers();
  await seedActiveElection();

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 1. Authenticate Voter
  await page.goto('/auth');
  await page.fill('#studentNumber', TEST_USERS.voter.studentId);
  await page.fill('#password', TEST_USERS.voter.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== '/auth');
  await page.context().storageState({ path: path.join(authDir, 'voter.json') });

  // 2. Authenticate Admin
  await page.goto('/auth');
  await page.fill('#studentNumber', TEST_USERS.admin.studentId);
  await page.fill('#password', TEST_USERS.admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname !== '/auth');
  await page.context().storageState({ path: path.join(authDir, 'admin.json') });
});
