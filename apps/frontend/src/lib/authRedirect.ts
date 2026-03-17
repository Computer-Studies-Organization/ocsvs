const LOGIN_ROUTE = "/auth/login";
const AUTH_QUERY_KEY = ["me"] as const;

type RedirectOptions = {
  replace: boolean;
  to: typeof LOGIN_ROUTE;
};

type UnauthorizedRedirectDependencies = {
  getCurrentPathname: () => string;
  navigate: (options: RedirectOptions) => Promise<unknown> | unknown;
  setQueryData: (key: readonly string[], value: null) => void;
};

type UnauthorizedResponseContext = {
  skipUnauthorizedRedirect?: boolean;
  status?: number;
};

let dependencies: UnauthorizedRedirectDependencies | null = null;
let redirectInFlight = false;

export const configureUnauthorizedRedirect = (
  nextDependencies: UnauthorizedRedirectDependencies,
) => {
  dependencies = nextDependencies;
};

export const handleUnauthorizedResponse = async ({
  skipUnauthorizedRedirect,
  status,
}: UnauthorizedResponseContext) => {
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
};

export const resetUnauthorizedRedirectForTests = () => {
  dependencies = null;
  redirectInFlight = false;
};
