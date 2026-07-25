import { test, expect } from "@playwright/test";
import { TEST_USERS, seedTestUsers } from "../../fixtures/db-setup";

test.describe("User Archiving (Soft-Delete) & Restoration Flow", () => {
  test.beforeEach(async () => {
    await seedTestUsers();
  });

  test("multi-session invalidation: soft-deleting voter invalidates active sessions and blocks login until restored", async ({
    request,
  }) => {
    // 1. Log in as Voter (Session / Browser A)
    const voterLoginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: "mock-token",
      },
    });
    expect(voterLoginRes.ok()).toBe(true);
    const voterCookie = voterLoginRes.headers()["set-cookie"] || "";
    expect(voterCookie).toBeDefined();

    // Verify Voter session active via GET /me
    const meBeforeArchive = await request.get("http://localhost:8787/me", {
      headers: { Cookie: voterCookie },
    });
    expect(meBeforeArchive.ok()).toBe(true);

    // 2. Log in as Admin (Session / Browser B)
    const adminLoginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.admin.studentId,
        password: TEST_USERS.admin.password,
        turnstileToken: "mock-token",
      },
    });
    expect(adminLoginRes.ok()).toBe(true);
    const adminCookie = adminLoginRes.headers()["set-cookie"] || "";

    // 3. Admin soft-deletes (archives) Voter
    const archiveRes = await request.delete(
      `http://localhost:8787/users/${TEST_USERS.voter.userId}`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(archiveRes.ok()).toBe(true);
    const archiveBody = await archiveRes.json();
    expect(archiveBody.message).toContain("archived");

    // 4. Voter on Session A performs action -> returns 401 Unauthorized (session invalidated)
    const meAfterArchive = await request.get("http://localhost:8787/me", {
      headers: { Cookie: voterCookie },
    });
    expect(meAfterArchive.status()).toBe(401);

    // Voter attempts to log back in -> returns 401 Unauthorized (archived account blocked)
    const voterReLoginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: "mock-token",
      },
    });
    expect(voterReLoginRes.status()).toBe(401);

    // 5. Admin on Session B restores Voter
    const restoreRes = await request.post(
      `http://localhost:8787/users/${TEST_USERS.voter.userId}/restore`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(restoreRes.ok()).toBe(true);
    const restoreBody = await restoreRes.json();
    expect(restoreBody.message).toContain("restored");

    // 6. Voter attempts login again -> returns 200 OK (login succeeds)
    const voterFinalLoginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.voter.studentId,
        password: TEST_USERS.voter.password,
        turnstileToken: "mock-token",
      },
    });
    expect(voterFinalLoginRes.ok()).toBe(true);
    const voterFinalBody = await voterFinalLoginRes.json();
    expect(voterFinalBody.user).toBeDefined();
    expect(voterFinalBody.user.id).toBe(TEST_USERS.voter.accountId);
  });

  test("browser context simulation (Browser A & Browser B): soft-delete and restoration", async ({
    browser,
    request,
  }) => {
    // Browser A context (Voter)
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    // 1. Voter logs in on Browser A
    await pageA.goto("/auth");
    await pageA.fill("#studentNumber", TEST_USERS.voter.studentId);
    await pageA.fill("#password", TEST_USERS.voter.password);
    await pageA.click('button[type="submit"]');

    // Wait for navigation past /auth
    await pageA.waitForURL((url) => !url.pathname.endsWith("/auth"));

    // 2. Admin soft-deletes voter via API (simulating Browser B action)
    const adminLoginRes = await request.post("http://localhost:8787/login", {
      data: {
        studentNumber: TEST_USERS.admin.studentId,
        password: TEST_USERS.admin.password,
        turnstileToken: "mock-token",
      },
    });
    const adminCookie = adminLoginRes.headers()["set-cookie"] || "";

    await request.delete(`http://localhost:8787/users/${TEST_USERS.voter.userId}`, {
      headers: { Cookie: adminCookie },
    });

    // 3. Browser A voter tries to make an authenticated request
    const meCheck = await pageA.request.get("http://localhost:8787/me");
    expect(meCheck.status()).toBe(401);

    // 4. Admin restores voter
    await request.post(`http://localhost:8787/users/${TEST_USERS.voter.userId}/restore`, {
      headers: { Cookie: adminCookie },
    });

    // 5. Voter can log in again on Browser A
    await pageA.goto("/auth");
    await pageA.fill("#studentNumber", TEST_USERS.voter.studentId);
    await pageA.fill("#password", TEST_USERS.voter.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForURL((url) => !url.pathname.endsWith("/auth"));

    await contextA.close();
  });
});
