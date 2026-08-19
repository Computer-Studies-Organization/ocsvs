import { test, expect } from "../../fixtures/offline-test";
import { TEST_USERS } from "../../fixtures/db-setup";

test.describe("Authentication - Session Lifecycle", () => {
  test("rejects unauthenticated session check", async ({ request }) => {
    const response = await request.get("http://localhost:8787/me");
    expect(response.status()).toBe(401);
  });

  test("maintains session across authenticated requests and handles logout", async ({
    request,
  }) => {
    // 1. Login
    const loginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: "mock-token",
      },
    });
    expect(loginRes.ok()).toBe(true);

    // Get session cookie
    const cookies = loginRes.headers()["set-cookie"];
    expect(cookies).toBeDefined();

    // 2. Fetch /me with session cookie
    const meRes = await request.get("http://localhost:8787/me", {
      headers: { Cookie: cookies },
    });
    expect(meRes.ok()).toBe(true);
    const meBody = await meRes.json();
    expect(meBody.user.username).toBe(TEST_USERS.voter.username);

    // 3. Logout
    const logoutRes = await request.post("http://localhost:8787/logout", {
      headers: { Cookie: cookies },
    });
    expect(logoutRes.ok()).toBe(true);

    // 4. Verify session is revoked
    const mePostLogout = await request.get("http://localhost:8787/me", {
      headers: { Cookie: cookies },
    });
    expect(mePostLogout.status()).toBe(401);
  });
});
