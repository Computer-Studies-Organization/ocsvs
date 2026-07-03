import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password utilities", () => {
  it("should hash a password and verify it successfully", async () => {
    const password = "my-secure-password";
    const hashedPassword = await hashPassword(password);

    // Format should be salt$hash
    expect(hashedPassword).toContain("$");
    const [salt, hash] = hashedPassword.split("$");
    expect(salt).toBeDefined();
    expect(hash).toBeDefined();
    expect(salt.length).toBeGreaterThan(0);
    expect(hash.length).toBeGreaterThan(0);

    // Verification should pass with correct password
    const isValid = await verifyPassword(password, hashedPassword);
    expect(isValid).toBe(true);
  });

  it("should fail verification with incorrect password", async () => {
    const password = "my-secure-password";
    const hashedPassword = await hashPassword(password);

    const isValid = await verifyPassword("wrong-password", hashedPassword);
    expect(isValid).toBe(false);
  });

  it("should return false for malformed stored hash formats", async () => {
    const password = "my-secure-password";

    // No $ delimiter
    expect(await verifyPassword(password, "just-a-plain-string")).toBe(false);

    // Missing hash segment
    expect(await verifyPassword(password, "salt-but-no-hash$")).toBe(false);

    // Empty segments
    expect(await verifyPassword(password, "$")).toBe(false);
  });

  it("should generate unique hashes for identical passwords due to random salt", async () => {
    const password = "my-secure-password";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);

    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});
