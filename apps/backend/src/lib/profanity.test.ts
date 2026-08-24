import { describe, expect, it } from "vitest";
import { validateProfanity } from "./profanity";

describe("validateProfanity", () => {
  it("allows legitimate names containing God", () => {
    expect(validateProfanity("God Grace Riel", "firstName")).toBeNull();
  });

  it("still rejects profane language", () => {
    expect(validateProfanity("shit", "firstName")).toBe(
      "firstName contains inappropriate language",
    );
  });
});
