import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../../fixtures/db-setup';

test.describe('Voter Journey & Ballot Submission', () => {
  let voterCookie: string;

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post('http://localhost:8787/login', {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: 'mock-token',
      },
    });
    voterCookie = loginRes.headers()['set-cookie'] || '';
  });

  test('fetches current voting state for voter', async ({ request }) => {
    const stateRes = await request.get('http://localhost:8787/elections/state', {
      headers: { Cookie: voterCookie },
    });
    expect(stateRes.ok()).toBe(true);
    const state = await stateRes.json();
    expect(state).toHaveProperty('open');
    expect(state.open).toBeDefined();
  });

  test('rejects voting submission when election is not open or invalid candidate', async ({ request }) => {
    const voteRes = await request.post('http://localhost:8787/votes', {
      headers: { Cookie: voterCookie },
      data: {
        votes: [
          {
            electionId: 'non-existent-election-id',
            positionId: 'non-existent-position-id',
            candidateId: 'non-existent-candidate-id',
          },
        ],
      },
    });

    expect(voteRes.ok()).toBe(false);
    expect([400, 401, 404, 422]).toContain(voteRes.status());
  });
});
