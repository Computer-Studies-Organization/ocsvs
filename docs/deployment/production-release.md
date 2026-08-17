# Production Release Runbook

Deployment is continuous via **Cloudflare Workers Builds**, connected to this repository. Every push and pull request produces a preview deployment with its own unique preview URL; pushes to the production branch (as configured in the Workers Builds dashboard) deploy to the stable production Worker. There is no manually dispatched release workflow.

## What the Pipeline Automates

On every push, Workers Builds:

1. Builds the frontend (`build.command` in `apps/backend/wrangler.jsonc` runs `pnpm --dir ../frontend build`). The build needs a real `PUBLIC_TURNSTILE_SITEKEY` and an **empty** `PUBLIC_API_BASE_URL` (same-origin production); these come from the build variables configured in the Workers Builds dashboard — the frontend `.env` files are gitignored and absent in CI.
2. Deploys the Worker via `pnpm --filter @cso-voting/backend deploy`: `validate-frontend-build-env.ts` fails the deploy if `PUBLIC_API_BASE_URL` is non-empty or the Turnstile site key is missing or a dummy, then `wrangler deploy --minify` ships the Worker and the built frontend assets.
3. Fails if any secret listed in `secrets.required` (in `wrangler.jsonc`) is missing from the Worker.

**Migrations are not part of this pipeline** — they are applied manually (see below).

After a production deploy, verify `GET <production-url>/health` returns exactly `{"status":"ok"}`. The dependency-aware readiness endpoint is `GET <production-url>/health/ready` and should also return `{"status":"ok"}`.

## Monitoring and frontend telemetry

Use the public liveness endpoint for deployment checks and configure one external HTTP monitor for the readiness endpoint:

1. Create an UptimeRobot HTTP(s) monitor for `https://<production-url>/health/ready`.
2. Use the free plan's 5-minute interval and email alerting.
3. Treat any non-200 response as an incident; the endpoint checks the Worker and its Turso connection.

The repository does not provision external monitors. Configure the monitor in the UptimeRobot account ([free-plan details](https://uptimerobot.com/pricing/)) and verify it with a deliberate test notification.

Frontend exceptions are sent to Sentry when `PUBLIC_SENTRY_DSN` is set as a Workers Builds public build variable. Leave it empty to disable client telemetry. Do not put a Sentry auth token in frontend variables; only the project DSN belongs in the browser bundle.

## Worker Secrets (Manual)

Wrangler and its `wrangler.jsonc` live in `apps/backend` — run these from there:

```bash
cd apps/backend
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put HMAC_SECRET
wrangler secret put B2_APPLICATION_KEY_ID
wrangler secret put B2_APPLICATION_KEY
```

Preview deployments currently share the Worker's bindings, secrets, and Turso database. The deployed Worker is treated as **pre-production** and contains no real student data, so keeping PR previews enabled is an accepted temporary risk while all data remains synthetic. Do not use previews for real student data, load tests, or destructive tests. Before the first real-data import or production cutover, isolate preview resources or disable non-production branch builds.

## Migrations (Manual)

The deploy command never applies migrations. Apply them explicitly **before** pushing code that depends on them:

1. Confirm the target database and current migration state.
2. Create or verify a current Turso backup/PITR recovery point and record its identifier in the release ticket.
3. Do not apply `0001_sharp_lord_tyger.sql` to a populated database; it deletes `votes` and `candidates` and is not reversible.
4. Apply pending migrations:

   ```bash
   cd apps/backend
   pnpm db:migrate
   ```

5. Verify the schema, then push to the production branch to deploy.

## Rollback

For a bad deployment, roll back to the last known-good build in the Worker's build/deployment history in the Cloudflare dashboard, or with Wrangler from the backend package:

```bash
cd apps/backend
wrangler versions list
wrangler rollback <VERSION_ID>
```

For a migration failure, stop the release, preserve logs, and use the documented Turso restore/PITR procedure before attempting another migration. Do not edit an applied migration file to repair production state.

## Local Verification

Run the repository checks before pushing to the production branch:

```bash
pnpm -w typecheck
pnpm -w lint
pnpm -w test
pnpm -w build
pnpm audit --prod --audit-level=high
pnpm --filter @cso-voting/backend exec wrangler types --env-interface CloudflareBindings --check
```
