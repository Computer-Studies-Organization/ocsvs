export function formatTimestamp(unixSeconds: number | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined) {
    return "To Be Determined";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
}
