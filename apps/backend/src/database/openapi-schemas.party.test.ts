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
