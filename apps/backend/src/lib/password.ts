/**
 * Password hashing utilities using Web Crypto API (CF Workers compatible).
 * Uses PBKDF2-SHA256 with 100,000 iterations.
 */

const ITERATIONS = 100_000;
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
 * Derives a key from password and salt using PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
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
      iterations: ITERATIONS,
      hash: HASH,
    },
    keyMaterial,
    KEY_LENGTH,
  );
}

/**
 * Hashes a password with a random salt.
 * Returns format: `salt$hash` (both base64 encoded)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const derivedKey = await deriveKey(password, salt);
  const hash = new Uint8Array(derivedKey);

  return `${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verifies a password against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltBase64, hashBase64] = storedHash.split("$");

  if (!saltBase64 || !hashBase64) {
    return false;
  }

  const salt = fromBase64(saltBase64);
  const expectedHash = fromBase64(hashBase64);
  const derivedKey = await deriveKey(password, salt);
  const actualHash = new Uint8Array(derivedKey);

  // Constant-time comparison
  if (expectedHash.length !== actualHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < expectedHash.length; i++) {
    result |= expectedHash[i] ^ actualHash[i];
  }

  return result === 0;
}
