import { test, expect } from "../../fixtures/offline-test";
import { DRAFT_CANDIDATE, TEST_USERS } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";

test.describe("Offline candidate image storage", () => {
  let createdCandidateId: string | undefined;

  // Isolation comes from each test using its own account fixture plus the
  // stale-candidate deactivation in seedDraftCandidate. This cleanup is only
  // tidiness, so a failure must not fail the test that just passed.
  test.afterEach(async ({ page }) => {
    const candidateId = createdCandidateId;
    createdCandidateId = undefined;
    if (!candidateId) return;

    const cleanupResponse = await page.request.delete(`/candidates/${candidateId}`);
    if (!cleanupResponse.ok()) {
      console.warn(
        `Failed to deactivate E2E candidate ${candidateId}: ${cleanupResponse.status()}`,
      );
    }
  });

  test("creates a candidate with a valid photo and uploads image with candidate ID", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}`,
    );
    await page.getByRole("button", { name: "Add candidate" }).first().click();
    await expect(page.getByRole("heading", { name: "Add candidate" })).toBeVisible();

    await page.locator("#candidate-user-search").fill(TEST_USERS.voter.studentId);
    const userOption = page.getByRole("option", {
      name: new RegExp(TEST_USERS.voter.firstName, "i"),
    });
    await expect(userOption).toBeVisible();
    await userOption.click();

    await page.locator("#candidatePhoto").setInputFiles({
      name: "new-candidate-avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    await expect(page.getByText("new-candidate-avatar.png")).toBeVisible();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/candidates") &&
        !response.url().endsWith("/image") &&
        response.request().method() === "POST",
    );
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/candidates/") &&
        response.url().endsWith("/image") &&
        response.request().method() === "POST",
    );

    await page.locator("form").getByRole("button", { name: "Add candidate" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    createdCandidateId = createData.candidate.id;
    expect(createdCandidateId).toBeTruthy();

    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(200);
    expect(uploadResponse.url()).toContain(`/candidates/${createdCandidateId}/image`);

    await expect(
      page
        .getByRole("dialog")
        .getByText(
          `${TEST_USERS.voter.firstName} ${TEST_USERS.voter.lastName} (${TEST_USERS.voter.studentId})`,
        ),
    ).toBeVisible();

    const imageResponse = await page.request.get(`/candidates/${createdCandidateId}/image`);
    expect(imageResponse.status()).toBe(200);
  });

  test("creates a candidate once when photo upload fails", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}`,
    );
    await page.getByRole("button", { name: "Add candidate" }).first().click();

    await page.locator("#candidate-user-search").fill(TEST_USERS.candidateVoter.studentId);
    const userOption = page.getByRole("option", {
      name: new RegExp(TEST_USERS.candidateVoter.firstName, "i"),
    });
    await expect(userOption).toBeVisible();
    await userOption.click();

    await page.locator("#candidatePhoto").setInputFiles({
      name: "failed-candidate-avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });

    let createRequestCount = 0;
    page.on("request", (request) => {
      if (
        request.url().includes("/candidates") &&
        !request.url().endsWith("/image") &&
        request.method() === "POST"
      ) {
        createRequestCount++;
      }
    });
    await page.route("**/candidates/*/image", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Upload failed" }),
      });
    });

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/candidates") &&
        !response.url().endsWith("/image") &&
        response.request().method() === "POST",
    );

    await page.locator("form").getByRole("button", { name: "Add candidate" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    createdCandidateId = createData.candidate.id;

    await expect(
      page.getByText(
        "Candidate added, but photo upload failed. Retry the photo from candidate editing.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add candidate" })).toHaveCount(0);
    expect(createRequestCount).toBe(1);
  });

  test("creates a candidate without a photo", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}`,
    );
    await page.getByRole("button", { name: "Add candidate" }).first().click();
    await expect(page.getByRole("heading", { name: "Add candidate" })).toBeVisible();

    await page.locator("#candidate-user-search").fill(TEST_USERS.votedVoter.studentId);
    const userOption = page.getByRole("option", {
      name: new RegExp(TEST_USERS.votedVoter.firstName, "i"),
    });
    await expect(userOption).toBeVisible();
    await userOption.click();

    let uploadRequestMade = false;
    page.on("request", (req) => {
      if (
        req.url().includes("/candidates/") &&
        req.url().endsWith("/image") &&
        req.method() === "POST"
      ) {
        uploadRequestMade = true;
      }
    });

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/candidates") &&
        !response.url().endsWith("/image") &&
        response.request().method() === "POST",
    );

    await page.locator("form").getByRole("button", { name: "Add candidate" }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(200);
    const createData = await createResponse.json();
    createdCandidateId = createData.candidate.id;

    await expect(
      page
        .getByRole("dialog")
        .getByText(
          `${TEST_USERS.votedVoter.firstName} ${TEST_USERS.votedVoter.lastName} (${TEST_USERS.votedVoter.studentId})`,
        ),
    ).toBeVisible();

    expect(uploadRequestMade).toBe(false);

    const imageResponse = await page.request.get(`/candidates/${createdCandidateId}/image`);
    expect(imageResponse.status()).toBe(404);
  });

  test("rejects invalid candidate photos before submission", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}`,
    );
    await page.getByRole("button", { name: "Add candidate" }).first().click();

    await page.locator("#candidate-user-search").fill(TEST_USERS.voter.studentId);
    await page.getByRole("option", { name: new RegExp(TEST_USERS.voter.firstName, "i") }).click();

    const photoInput = page.locator("#candidatePhoto");
    await photoInput.setInputFiles({
      name: "candidate.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("GIF89a"),
    });
    await expect(page.getByText("Invalid file type. Allowed: JPEG, PNG, WebP")).toBeVisible();

    await photoInput.setInputFiles({
      name: "candidate.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await expect(page.getByText("File too large. Maximum size: 5MB")).toBeVisible();
    await expect(
      page.locator("form").getByRole("button", { name: "Add candidate" }),
    ).toBeDisabled();
  });

  test("uploads, replaces, reads with ETag, and deletes a candidate image", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}/candidates/${DRAFT_CANDIDATE.candidateId}`,
    );
    await expect(page.getByText("E2E Image Candidate")).toBeVisible();

    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/candidates/${DRAFT_CANDIDATE.candidateId}/image`) &&
        response.request().method() === "POST",
    );
    await page.locator("#candidate-photo-input").setInputFiles({
      name: "offline-candidate.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    });
    expect((await uploadResponsePromise).status()).toBe(200);

    const image = page.locator('img[alt="Candidate"]');
    await expect(image).toBeVisible();

    const imageResponse = await page.request.get(
      `/candidates/${DRAFT_CANDIDATE.candidateId}/image`,
    );
    expect(imageResponse.status()).toBe(200);
    const etag = imageResponse.headers().etag;
    expect(etag).toBeTruthy();

    const cachedResponse = await page.request.get(
      `/candidates/${DRAFT_CANDIDATE.candidateId}/image`,
      { headers: { "If-None-Match": etag } },
    );
    expect(cachedResponse.status()).toBe(304);

    const replacementUpload = await page.request.post(
      `/candidates/${DRAFT_CANDIDATE.candidateId}/image`,
      {
        multipart: {
          image: {
            name: "offline-candidate-replacement.png",
            mimeType: "image/png",
            buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          },
        },
      },
    );
    expect(replacementUpload.status()).toBe(200);

    const replacementResponse = await page.request.get(
      `/candidates/${DRAFT_CANDIDATE.candidateId}/image`,
      { headers: { "If-None-Match": etag } },
    );
    expect(replacementResponse.status()).toBe(200);
    expect(replacementResponse.headers().etag).not.toBe(etag);
    expect(await replacementResponse.body()).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    await page.getByRole("button", { name: "Remove candidate photo" }).click();
    await expect(page.locator('img[alt="Candidate"]')).toHaveCount(0);

    const deletedResponse = await page.request.get(
      `/candidates/${DRAFT_CANDIDATE.candidateId}/image`,
    );
    expect(deletedResponse.status()).toBe(404);
  });
});

test.describe("Add candidate user picker", () => {
  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(TEST_USERS.admin.studentId, TEST_USERS.admin.password);

    await page.goto(
      `/admin/elections/${DRAFT_CANDIDATE.electionId}/positions/${DRAFT_CANDIDATE.positionId}`,
    );
    await page.getByRole("button", { name: "Add candidate" }).first().click();
    await expect(page.getByRole("heading", { name: "Add candidate" })).toBeVisible();
  });

  test("selects a user with keyboard navigation", async ({ page }) => {
    await page.route("**/users**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("search") !== "keyboard") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              accountId: "keyboard-first-account",
              studentId: "keyboard-first",
              firstName: "Keyboard",
              lastName: "First",
            },
            {
              accountId: "keyboard-second-account",
              studentId: "keyboard-second",
              firstName: "Keyboard",
              lastName: "Second",
            },
          ],
          meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
        }),
      });
    });

    const searchInput = page.locator("#candidate-user-search");
    const options = page.getByRole("listbox").getByRole("option");
    await searchInput.fill("keyboard");
    await expect(options).toHaveCount(2);

    await searchInput.press("ArrowDown");
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await searchInput.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await searchInput.press("ArrowUp");
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await searchInput.press("Enter");

    await expect(page.getByText("Keyboard First (keyboard-first)")).toBeVisible();
    await expect(page.getByText("Selected user")).toBeVisible();
  });

  test("closes the picker with Escape", async ({ page }) => {
    const searchInput = page.locator("#candidate-user-search");
    await searchInput.fill(TEST_USERS.voter.studentId);
    await expect(page.getByRole("listbox").getByRole("option")).toBeVisible();

    await searchInput.press("Escape");

    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("shows an empty state when the user search has no matches", async ({ page }) => {
    await page.route("**/users**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("search") !== "no-matches") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        }),
      });
    });

    await page.locator("#candidate-user-search").fill("no-matches");
    await expect(page.getByText("No users found.")).toBeVisible();
  });

  test("shows an error when the user search fails", async ({ page }) => {
    await page.route("**/users**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("search") !== "search-error") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "User search unavailable" }),
      });
    });

    await page.locator("#candidate-user-search").fill("search-error");
    await expect(page.getByText("User search unavailable")).toBeVisible();
  });
});
