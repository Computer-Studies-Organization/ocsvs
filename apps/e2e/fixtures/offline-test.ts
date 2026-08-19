import { test as base, expect } from "@playwright/test";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isAllowedOfflineUrl(requestUrl: string): boolean {
  if (/^(about|blob|data):/.test(requestUrl)) return true;

  try {
    const url = new URL(requestUrl);
    return url.protocol === "http:" && localHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    let blockedUrl: string | undefined;
    page.on("request", (request) => {
      if (!isAllowedOfflineUrl(request.url())) blockedUrl ??= request.url();
    });

    await use(page);
    if (blockedUrl) {
      throw new Error(`Offline network guard blocked ${blockedUrl} during ${testInfo.title}`);
    }
  },
});

export { expect };
