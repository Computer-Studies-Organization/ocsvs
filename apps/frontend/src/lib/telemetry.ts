import { browser } from "$app/environment";
import { PUBLIC_SENTRY_DSN } from "$env/static/public";
import * as Sentry from "@sentry/browser";

const dsn = PUBLIC_SENTRY_DSN;
const enabled = browser && Boolean(dsn);

if (enabled) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
  });
}

export function captureException(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
