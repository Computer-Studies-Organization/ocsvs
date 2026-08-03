/**
 * Password hashing utilities using Web Crypto API (CF Workers compatible).
 * Uses PBKDF2-SHA256 with a versioned stored format so the work factor can be
 * raised without invalidating existing hashes.
 *
 * Current format: `pbkdf2-sha256$<iterations>$<salt>$<hash>` (all base64 except iterations)
 * Legacy format (pre-versioning): `salt$hash` — implicitly PBKDF2-SHA256 at LEGACY_ITERATIONS.
 */

// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000.
// Keep this value within the Worker runtime limit for both new and dummy hashes.
const ITERATIONS = 100_000;
const MAX_SUPPORTED_ITERATIONS = 100_000;
const LEGACY_ITERATIONS = 100_000;
const ALGORITHM_ID = "pbkdf2-sha256";
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const ALGORITHM = "PBKDF2";
const HASH = "SHA-256";

/**
 * Generates a cryptographically secure random salt.
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Converts Uint8Array to base64 string.
 */
function toBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer));
}

/**
 * Converts base64 string to Uint8Array.
 */
function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/**
 * Derives a key from password and salt using PBKDF2 at the given iteration count.
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    ALGORITHM,
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt.buffer as ArrayBuffer,
      iterations,
      hash: HASH,
    },
    keyMaterial,
    KEY_LENGTH,
  );
}

/**
 * Parses a stored hash into its parameters.
 * Returns null for malformed input.
 */
function parseStoredHash(storedHash: string): {
  iterations: number;
  salt: Uint8Array;
  hash: Uint8Array;
} | null {
  const parts = storedHash.split("$");

  if (parts.length === 2) {
    const [saltBase64, hashBase64] = parts;
    if (!saltBase64 || !hashBase64) {
      return null;
    }
    try {
      return {
        iterations: LEGACY_ITERATIONS,
        salt: fromBase64(saltBase64),
        hash: fromBase64(hashBase64),
      };
    } catch {
      return null;
    }
  }

  if (parts.length === 4) {
    const [algorithmId, iterationsRaw, saltBase64, hashBase64] = parts;
    if (algorithmId !== ALGORITHM_ID || !saltBase64 || !hashBase64) {
      return null;
    }
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations <= 0) {
      return null;
    }
    try {
      return {
        iterations,
        salt: fromBase64(saltBase64),
        hash: fromBase64(hashBase64),
      };
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Hashes a password with a random salt.
 * Returns format: `pbkdf2-sha256$<iterations>$<salt>$<hash>` (salt and hash base64).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derivedKey = await deriveKey(password, salt, ITERATIONS);
  const hash = new Uint8Array(derivedKey);

  return `${ALGORITHM_ID}$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verifies a password against a stored hash, honoring the parameters recorded
 * in the hash itself (legacy hashes verify at the legacy iteration count).
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseStoredHash(storedHash);

  if (!parsed || parsed.iterations > MAX_SUPPORTED_ITERATIONS) {
    return false;
  }

  const derivedKey = await deriveKey(password, parsed.salt, parsed.iterations);
  const actualHash = new Uint8Array(derivedKey);

  // Constant-time comparison
  if (parsed.hash.length !== actualHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < parsed.hash.length; i++) {
    result |= parsed.hash[i] ^ actualHash[i];
  }

  return result === 0;
}

/**
 * Returns true when the stored hash should be rehashed with the current policy
 * (legacy format or any non-current iteration count).
 */
export function needsRehash(storedHash: string): boolean {
  const parsed = parseStoredHash(storedHash);

  if (!parsed) {
    return false;
  }

  return storedHash.split("$").length !== 4 || parsed.iterations !== ITERATIONS;
}

/**
 * Returns false for hashes that this runtime cannot verify safely.
 * This lets callers provide a controlled recovery path instead of surfacing
 * Web Crypto's unsupported-iteration exception as a 500 response.
 */
export function isPasswordHashSupported(storedHash: string): boolean {
  const parsed = parseStoredHash(storedHash);
  return parsed !== null && parsed.iterations <= MAX_SUPPORTED_ITERATIONS;
}

/**
 * A well-formed hash at the current cost used to equalize verification time for
 * accounts that do not exist (timing-attack mitigation). Never matches any password.
 */
export const CURRENT_COST_DUMMY_HASH = `${ALGORITHM_ID}$${ITERATIONS}$${toBase64(new Uint8Array(SALT_LENGTH))}$${toBase64(new Uint8Array(KEY_LENGTH / 8))}`;
