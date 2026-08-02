import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, needsRehash } from "./password";

const ALGORITHM_ID = "pbkdf2-sha256";
const CURRENT_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 100_000;

function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

/**
 * Builds a legacy-format hash (`salt$hash`) using PBKDF2-SHA256 at the legacy
 * iteration count, mimicking hashes written by the pre-versioning implementation.
 */
async function legacyHash(
  password: string,
  iterations: number = LEGACY_ITERATIONS,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return `${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

describe("password utilities", () => {
  describe("hashPassword", () => {
    it("should return a versioned hash with current algorithm and iteration count", async () => {
      const hashedPassword = await hashPassword("my-secure-password");

      const parts = hashedPassword.split("$");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe(ALGORITHM_ID);
      expect(parts[1]).toBe(String(CURRENT_ITERATIONS));
      expect(parts[2].length).toBeGreaterThan(0);
      expect(parts[3].length).toBeGreaterThan(0);
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

  describe("verifyPassword", () => {
    it("should verify a versioned hash with the correct password", async () => {
      const password = "my-secure-password";
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it("should fail verification with incorrect password", async () => {
      const password = "my-secure-password";
      const hashedPassword = await hashPassword(password);

      const isValid = await verifyPassword("wrong-password", hashedPassword);
      expect(isValid).toBe(false);
    });

    it("should verify a legacy two-field hash using the legacy iteration count", async () => {
      const password = "legacy-password";
      const legacy = await legacyHash(password);

      expect(legacy.split("$")).toHaveLength(2);
      expect(await verifyPassword(password, legacy)).toBe(true);
      expect(await verifyPassword("wrong-password", legacy)).toBe(false);
    });

    it("should verify a versioned hash with a non-current iteration count", async () => {
      const password = "older-versioned-password";
      const legacy = await legacyHash(password);
      const olderVersioned = `${ALGORITHM_ID}$${LEGACY_ITERATIONS}$${legacy}`;

      expect(await verifyPassword(password, olderVersioned)).toBe(true);
    });

    it("should return false for malformed stored hash formats", async () => {
      const password = "my-secure-password";

      // No $ delimiter
      expect(await verifyPassword(password, "just-a-plain-string")).toBe(false);

      // Missing hash segment
      expect(await verifyPassword(password, "salt-but-no-hash$")).toBe(false);

      // Empty segments
      expect(await verifyPassword(password, "$")).toBe(false);

      // Unknown algorithm id
      expect(
        await verifyPassword(
          password,
          `argon2id$600000$${toBase64(new Uint8Array(16))}$${toBase64(new Uint8Array(32))}`,
        ),
      ).toBe(false);

      // Non-numeric iteration count
      expect(
        await verifyPassword(
          password,
          `${ALGORITHM_ID}$abc$${toBase64(new Uint8Array(16))}$${toBase64(new Uint8Array(32))}`,
        ),
      ).toBe(false);

      // Zero iteration count
      expect(
        await verifyPassword(
          password,
          `${ALGORITHM_ID}$0$${toBase64(new Uint8Array(16))}$${toBase64(new Uint8Array(32))}`,
        ),
      ).toBe(false);
    });
  });

  describe("needsRehash", () => {
    it("should return true for a legacy two-field hash", async () => {
      expect(needsRehash(await legacyHash("legacy-password"))).toBe(true);
    });

    it("should return true for a versioned hash with below-current iterations", async () => {
      const legacy = await legacyHash("older-password");
      expect(needsRehash(`${ALGORITHM_ID}$${LEGACY_ITERATIONS}$${legacy}`)).toBe(true);
    });

    it("should return false for a versioned hash with current iterations", async () => {
      expect(needsRehash(await hashPassword("current-password"))).toBe(false);
    });

    it("should return false for malformed hashes", async () => {
      expect(needsRehash("garbage")).toBe(false);
    });
  });
});
