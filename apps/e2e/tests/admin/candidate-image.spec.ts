import { test, expect } from "../../fixtures/offline-test";
import { DRAFT_CANDIDATE, TEST_USERS } from "../../fixtures/db-setup";
import { LoginPage } from "../../fixtures/page-objects/LoginPage";

test.describe("Offline candidate image storage", () => {
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
