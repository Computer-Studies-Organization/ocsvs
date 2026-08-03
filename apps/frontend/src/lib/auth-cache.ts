import { appCache } from "$lib/cache";

export function clearAuthCache(): void {
  appCache.invalidate();
}
