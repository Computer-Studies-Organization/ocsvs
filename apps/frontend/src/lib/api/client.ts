import { browser } from "$app/environment";
import { PUBLIC_API_BASE_URL } from "$env/static/public";
import { authStore } from "$lib/stores/auth.svelte";

// Production assets and the API are served by the same Cloudflare Worker.
// Keep the configurable base URL for local development, but never bake a
// cross-origin API URL into a production bundle.
const API_BASE_URL = import.meta.env.PROD ? "" : PUBLIC_API_BASE_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions extends RequestInit {
  fetch?: typeof fetch;
  skipAuthStateReset?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { fetch: customFetch, skipAuthStateReset, ...fetchOptions } = options;
  const url = `${API_BASE_URL}${path}`;
  const fetchFn = customFetch || fetch;
  const headers = new Headers(fetchOptions.headers);
  if (!(fetchOptions.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchFn(url, {
    ...fetchOptions,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    if (response.status === 401 && browser && !skipAuthStateReset) {
      authStore.logout();
    }
    throw new ApiError(response.status, body.message ?? response.statusText);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
