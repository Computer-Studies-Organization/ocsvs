import { describe, expect, it } from "vitest";
import { CreatePartyListBodySchema, UpdatePartyListBodySchema } from "./openapi-schemas";

describe.each([
  ["create", CreatePartyListBodySchema, { name: "Innovators", code: "INNOV" }],
  ["update", UpdatePartyListBodySchema, {}],
])("%s party-list color validation", (_operation, schema, baseInput) => {
  it.each(["#3B82F6", "#abcdef"])("accepts six-digit hex color %s", (color) => {
    expect(schema.safeParse({ ...baseInput, color }).success).toBe(true);
  });

  it.each([null, undefined])("accepts optional color %s", (color) => {
    expect(schema.safeParse({ ...baseInput, color }).success).toBe(true);
  });

  it.each(["red", "#fff", "#12345678", "#GGGGGG", "#123456\n", "red;display:none"])(
    "rejects non-six-digit hex color %s",
    (color) => {
      expect(schema.safeParse({ ...baseInput, color }).success).toBe(false);
    },
  );
});

describe.each([
  ["create", CreatePartyListBodySchema, { name: "Innovators" }],
  ["update", UpdatePartyListBodySchema, {}],
])("%s party-list code validation", (_operation, schema, baseInput) => {
  it.each(["INNOV", "party-123", "party_456", "A1_B2-C3"])(
    "accepts acronym-safe code %s",
    (code) => {
      expect(schema.safeParse({ ...baseInput, code }).success).toBe(true);
    },
  );

  it("normalizes party code to uppercase on parse", () => {
    const result = schema.parse({ ...baseInput, code: "innovators" });
    expect(result.code).toBe("INNOVATORS");
  });

  it.each(["INNOV ATORS", "PARTY(1)", "PARTY'S", "PARTY!", "@PARTY"])(
    "rejects unsafe party code %s with proper message",
    (code) => {
      const result = schema.safeParse({ ...baseInput, code });
      expect(result.success).toBe(false);
      if (!result.success) {
        const codeError = result.error.issues.find((issue) => issue.path.includes("code"));
        expect(codeError?.message).toBe("Use only letters, numbers, hyphens, and underscores");
      }
    },
  );
});
