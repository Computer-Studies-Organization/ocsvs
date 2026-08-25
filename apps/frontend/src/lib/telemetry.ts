import { browser } from "$app/environment";

function getDsn(): string | undefined {
  return import.meta.env.PUBLIC_SENTRY_DSN;
}

function isEnabled(): boolean {
  return browser && Boolean(getDsn());
}

let sentryPromise: Promise<typeof import("./sentry") | undefined> | undefined;

function loadSentry(): Promise<typeof import("./sentry") | undefined> {
  const dsn = getDsn();
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

if (isEnabled()) loadSentry();

export function captureException(error: unknown): void {
  if (isEnabled()) void loadSentry().then((Sentry) => Sentry?.captureException(error));
}
