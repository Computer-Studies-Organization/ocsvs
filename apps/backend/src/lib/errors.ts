export function isUniqueConstraintError(error: unknown): boolean {
  const seen = new Set<Error>();
  for (
    let current = error;
    current instanceof Error && !seen.has(current);
    current = current.cause
  ) {
    seen.add(current);
    if (current.message.includes("UNIQUE constraint failed")) {
      return true;
    }
  }
  return false;
}
