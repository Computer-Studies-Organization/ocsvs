import { describe, expect, it } from "vitest";
import { INVALID_PARTY_CODE_MESSAGE, validatePartyCode } from "./party-code";

describe("validatePartyCode", () => {
  it.each(["INNOV", "party-123", "party_456", "A1_B2-C3"])(
    "accepts acronym-safe code %s",
    (code) => {
      expect(validatePartyCode(code)).toBeNull();
    },
  );

  it.each(["INNOV ATORS", "PARTY(1)", "PARTY'S", "PARTY!", "@PARTY"])(
    "rejects unsafe code %s containing spaces, parens or special characters",
    (code) => {
      expect(validatePartyCode(code)).toBe(INVALID_PARTY_CODE_MESSAGE);
    },
  );
});
