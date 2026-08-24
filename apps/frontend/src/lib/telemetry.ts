import { browser } from "$app/environment";
import { PUBLIC_SENTRY_DSN } from "$env/static/public";

const dsn = PUBLIC_SENTRY_DSN;
const enabled = browser && Boolean(dsn);
let sentryPromise: Promise<typeof import("./sentry") | undefined> | undefined;

function loadSentry(): Promise<typeof import("./sentry") | undefined> {
  sentryPromise ??= import("./sentry")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
      });
      return Sentry;
    })
    .catch(() => undefined);
  return sentryPromise;
}

if (enabled) loadSentry();

export function captureException(error: unknown): void {
  if (enabled) void loadSentry().then((Sentry) => Sentry?.captureException(error));
}
