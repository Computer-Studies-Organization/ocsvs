import { Filter } from "bad-words";

const filter = new Filter();

// ponytail: return only validation message; callers choose response or skip behavior.
export function validateProfanity(text: string, fieldName: string): string | null {
  if (filter.isProfane(text)) {
    return `${fieldName} contains inappropriate language`;
  }

  return null;
}
