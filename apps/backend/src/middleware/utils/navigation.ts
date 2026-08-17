const NAVIGATION_METHODS = new Set(["GET", "HEAD"]);
const EXCLUDED_PATHS = new Set(["/docs", "/reference", "/health", "/health/ready"]);

interface NavigationRequest {
  method: string;
  path: string;
  accept?: string;
  secFetchMode?: string;
}

function normalizePath(path: string): string {
  const normalizedPath = path.replace(/\/+$/, "");
  return normalizedPath || "/";
}

function acceptsHtml(accept: string | undefined): boolean {
  return (
    accept
      ?.split(",")
      .some(
        (mediaType) => mediaType.trim().split(";", 1)[0].trim().toLowerCase() === "text/html",
      ) ?? false
  );
}

export function isNavigationRequest(request: NavigationRequest): boolean {
  if (!NAVIGATION_METHODS.has(request.method) || !acceptsHtml(request.accept)) {
    return false;
  }

  const path = normalizePath(request.path);

  if (EXCLUDED_PATHS.has(path) || /\.[^/]+$/.test(path)) {
    return false;
  }

  return path === "/" || request.secFetchMode === "navigate";
}

export { normalizePath };
