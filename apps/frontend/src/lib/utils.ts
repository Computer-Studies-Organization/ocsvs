export function formatTimestamp(unixSeconds: number | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined) {
    return "Date TBD";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
}
