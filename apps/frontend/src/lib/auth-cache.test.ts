import { afterEach, describe, expect, it, vi } from "vitest";
import { appCache } from "$lib/cache";
import { clearAuthCache } from "./auth-cache";

describe("clearAuthCache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates all user-scoped cache entries", () => {
    const invalidate = vi.spyOn(appCache, "invalidate");

    clearAuthCache();

    expect(invalidate).toHaveBeenCalledOnce();
    expect(invalidate).toHaveBeenCalledWith();
  });
});
