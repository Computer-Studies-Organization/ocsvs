import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/db-setup';

test.describe('Admin Election Management & Audit Trail', () => {
  let adminCookie: string;
  let createdElectionId: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post('http://localhost:8787/login', {
      data: {
        studentNumber: TEST_USERS.admin.studentId,
        password: TEST_USERS.admin.password,
        turnstileToken: 'mock-token',
      },
    });
    adminCookie = loginRes.headers()['set-cookie'] || '';
  });

  test('admin can fetch election list', async ({ request }) => {
    const res = await request.get('http://localhost:8787/elections', {
      headers: { Cookie: adminCookie },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.items || body)).toBe(true);
  });

  test('admin can create election draft and verify audit log entry', async ({ request }) => {
    const name = `E2E Test Election ${Date.now()}`;
    const createRes = await request.post('http://localhost:8787/elections', {
      headers: { Cookie: adminCookie },
      data: {
        name,
        description: 'Created by automated E2E test suite',
      },
    });

    expect(createRes.ok()).toBe(true);
    const election = await createRes.json();
    expect(election.id).toBeDefined();
    expect(election.name).toBe(name);
    createdElectionId = election.id;

    // Verify Audit Log entry recorded
    const auditRes = await request.get('http://localhost:8787/audit-log', {
      headers: { Cookie: adminCookie },
    });
    expect(auditRes.ok()).toBe(true);
    const auditBody = await auditRes.json();
    const items = auditBody.items || auditBody;
    const matchingLog = items.find((item: any) => item.targetId === createdElectionId);
    expect(matchingLog).toBeDefined();
    expect(matchingLog.action).toBe('election.create');
  });

  test('non-admin user is rejected from admin mutation endpoints', async ({ request }) => {
    const voterLogin = await request.post('http://localhost:8787/login', {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: 'mock-token',
      },
    });
    const voterCookie = voterLogin.headers()['set-cookie'] || '';

    const forbiddenRes = await request.post('http://localhost:8787/elections', {
      headers: { Cookie: voterCookie },
      data: {
        name: 'Unauthorized Election',
      },
    });

    expect(forbiddenRes.status()).toBe(403);
  });
});
