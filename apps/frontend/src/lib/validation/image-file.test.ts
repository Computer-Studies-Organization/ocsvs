import { describe, expect, it } from "vitest";
import { validateImageFile } from "./image-file";

describe("validateImageFile", () => {
  it("rejects unsupported image types and oversize files", () => {
    expect(validateImageFile({ type: "image/gif", size: 1 })).toBe(
      "Invalid file type. Allowed: JPEG, PNG, WebP",
    );
    expect(validateImageFile({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toBe(
      "File too large. Maximum size: 5MB",
    );
  });
});
