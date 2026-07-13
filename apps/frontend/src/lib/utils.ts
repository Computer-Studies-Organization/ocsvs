import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(unixSeconds: number | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined) {
    return "Date TBD";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
}

export const formatDate = formatTimestamp;
