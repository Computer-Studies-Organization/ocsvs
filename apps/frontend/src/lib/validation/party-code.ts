export const PARTY_CODE_REGEX = /^[A-Za-z0-9_-]+$/;
export const INVALID_PARTY_CODE_MESSAGE = "Use only letters, numbers, hyphens, and underscores";

export function validatePartyCode(code: string): string | null {
  if (!PARTY_CODE_REGEX.test(code)) {
    return INVALID_PARTY_CODE_MESSAGE;
  }
  return null;
}
