# Production Release Runbook

## Required GitHub Configuration

Create a protected GitHub environment named `production` and require at least one reviewer before jobs run.

Set these environment variables:

- `PUBLIC_TURNSTILE_SITEKEY`: real production Turnstile site key.
- `PRODUCTION_URL`: public Worker URL, without a trailing slash.

Set these environment secrets:

- `CLOUDFLARE_API_TOKEN`: token with Worker deployment permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account identifier.
- `TURSO_DATABASE_URL`: production libSQL/Turso URL for the optional migration job.
- `TURSO_AUTH_TOKEN`: production Turso token for the optional migration job.

Provision these Worker secrets with Wrangler before the first release:

```bash
wrangler secret put TURSO_DATABASE_URL
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put TURNSTILE_SECRET_KEY
wrangler secret put HMAC_SECRET
wrangler secret put B2_APPLICATION_KEY_ID
wrangler secret put B2_APPLICATION_KEY
```

## Release Procedure

1. Confirm the target database and current migration state.
2. Create or verify a current Turso backup/PITR recovery point and record its identifier in the release ticket.
3. Do not apply `0001_sharp_lord_tyger.sql` to a populated database; it deletes `votes` and `candidates` and is not reversible.
4. Open **Actions > Production Release > Run workflow**.
5. Leave `apply_migrations` disabled for an asset-only release.
6. Enable `apply_migrations` only after the backup/PITR check and enter `APPLY_AFTER_BACKUP` exactly.
7. Approve the protected `production` environment when GitHub requests review.
8. Confirm the workflow's `/health` check returns the exact `{"status":"ok"}` response.

The release workflow builds the frontend with an empty `PUBLIC_API_BASE_URL`, validates the production Turnstile site key, deploys the Worker and assets, and checks the configured production URL.

## Rollback

For a bad Worker deployment, use the last known-good version:

```bash
wrangler versions list
wrangler rollback <VERSION_ID>
```

For a migration failure, stop the release, preserve logs, and use the documented Turso restore/PITR procedure before attempting another migration. Do not edit an applied migration file to repair production state.

## Local Verification

Run the repository checks before requesting release approval:

```bash
pnpm -w typecheck
pnpm -w lint
pnpm -w test
pnpm -w build
pnpm audit --prod --audit-level=high
pnpm --filter @cso-voting/backend exec wrangler types --env-interface CloudflareBindings --check
```
