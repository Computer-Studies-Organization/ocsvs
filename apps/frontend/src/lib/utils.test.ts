import { describe, expect, it } from "vitest";
import { formatTimestamp } from "./utils";

describe("formatTimestamp", () => {
  it("should handle null and undefined", () => {
    expect(formatTimestamp(null)).toBe("To Be Determined");
    expect(formatTimestamp(undefined)).toBe("To Be Determined");
  });

  it("should format valid unix timestamp", () => {
    const timestamp = 1774944000; // Some future date
    expect(formatTimestamp(timestamp)).not.toBe("To Be Determined");
  });
});
