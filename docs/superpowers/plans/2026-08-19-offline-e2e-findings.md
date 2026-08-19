# Offline E2E Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the existing offline-mode requirements by removing the remaining Google Fonts request and eliminating the candidate-image upload race.

**Architecture:** Reuse the existing system-font fallback and Playwright response synchronization. No application abstraction, dependency, or backend change is needed.

**Tech Stack:** SvelteKit HTML shell, Playwright

---

### Task 1: Remove the external font request

**Files:**
- Modify: `apps/frontend/src/app.html:13-16`
- Test: `apps/e2e/fixtures/offline-test.ts`

- [ ] **Step 1: Verify the existing guard rejects the current page resource**

Run the focused Chromium request probe used during finding validation.

Expected: the browser emits `https://fonts.googleapis.com/...` and `isAllowedOfflineUrl` returns `false`.

- [ ] **Step 2: Remove the stylesheet link**

Delete this block from `apps/frontend/src/app.html`:

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
/>
```

Keep the existing local/system fallback in `apps/frontend/src/app.css` unchanged.

- [ ] **Step 3: Verify the built shell contains no external font URL**

Run:

```bash
PUBLIC_API_BASE_URL= PUBLIC_OFFLINE_DEV=true PUBLIC_SENTRY_DSN= pnpm --dir apps/frontend build
rg -n "fonts\\.googleapis\\.com|fonts\\.gstatic\\.com" apps/frontend/dist
```

Expected: build passes and `rg` returns no matches.

### Task 2: Await the candidate-image upload

**Files:**
- Modify: `apps/e2e/tests/admin/candidate-image.spec.ts:16-27`

- [ ] **Step 1: Verify the race**

Use a delayed upload response with an async file-input handler.

Expected before the fix: `setInputFiles()` returns with `previewVisible: true` and `uploadDone: false`.

- [ ] **Step 2: Register and await the matching POST response**

Before `setInputFiles`, create:

```ts
const uploadResponsePromise = page.waitForResponse(
  (response) =>
    response.url().endsWith(`/candidates/${DRAFT_CANDIDATE.candidateId}/image`) &&
    response.request().method() === "POST",
);
```

After `setInputFiles`, await it and assert success:

```ts
expect((await uploadResponsePromise).status()).toBe(200);
```

Then retain the preview and ETag assertions.

- [ ] **Step 3: Run focused verification**

Run:

```bash
pnpm --dir apps/e2e exec playwright test tests/admin/candidate-image.spec.ts --project=chromium
```

Expected: the candidate-image scenario passes. If the existing Worker asset-routing failure prevents reaching the scenario, report that blocker separately and retain the successful frontend build/static checks.

