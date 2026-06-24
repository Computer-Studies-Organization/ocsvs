const LOGIN_ROUTE = "/auth/login";
const AUTH_QUERY_KEY = ["me"] as const;

interface RedirectOptions {
  replace: boolean;
  to: typeof LOGIN_ROUTE;
}

interface UnauthorizedRedirectDependencies {
  getCurrentPathname: () => string;
  navigate: (options: RedirectOptions) => Promise<unknown> | unknown;
  setQueryData: (key: readonly string[], value: null) => void;
}

interface UnauthorizedResponseContext {
  skipUnauthorizedRedirect?: boolean;
  status?: number;
}

let dependencies: UnauthorizedRedirectDependencies | null = null;
let redirectInFlight = false;

export function configureUnauthorizedRedirect(nextDependencies: UnauthorizedRedirectDependencies) {
  dependencies = nextDependencies;
}

export async function handleUnauthorizedResponse({
  skipUnauthorizedRedirect,
  status,
}: UnauthorizedResponseContext) {
  if (status !== 401 || !dependencies) {
    return;
  }

  dependencies.setQueryData(AUTH_QUERY_KEY, null);

  if (
    skipUnauthorizedRedirect ||
    redirectInFlight ||
    dependencies.getCurrentPathname() === LOGIN_ROUTE
  ) {
    return;
  }

  redirectInFlight = true;

  try {
    await dependencies.navigate({ replace: true, to: LOGIN_ROUTE });
  } finally {
    redirectInFlight = false;
  }
}

export function resetUnauthorizedRedirectForTests() {
  dependencies = null;
  redirectInFlight = false;
}
