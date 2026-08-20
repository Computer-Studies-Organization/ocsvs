# Onboarding — OCSVS

Computer Studies Organization Voting System (OCSVS). This file is the fastest path from “fresh clone” to “running locally,” with an offline path that does not need service credentials.

## 1. Prerequisites

- **Node.js** >= 20.16.0 < 21 || >= 22.3.0
- **pnpm** >= 9.0.0
- **wrangler** (comes via devDependencies)
- **Turso CLI** (required for offline development and the seeded local E2E suite)
- **Backblaze B2** account (only required for explicit online image development or staging)

## 2. Clone and Install

```bash
git clone <repository-url>
cd ocsvs
pnpm install
```

## 3. Project Layout

```
ocsvs/
├── apps/
│   ├── backend/        # Hono API on Cloudflare Workers (Turso / libSQL)
│   └── frontend/       # SvelteKit 2 + Svelte 5 (active)
├── justfile            # Task runner shortcuts
├── pnpm-workspace.yaml
└── ONBOARDING.md       # You are here
```

## 4. Offline Development

Offline mode is explicit. It uses one local HTTP database, skips Turnstile, keeps Sentry disabled, and stores candidate images in memory inside the Worker process. Images disappear when Wrangler restarts.

Start the complete local stack:

```bash
pnpm dev:offline
# or
just dev-offline
```

The command starts or reuses:

- `turso dev --db-file apps/backend/local.db --port 8080`
- the Worker on `http://localhost:8787`
- the frontend with `PUBLIC_OFFLINE_DEV=true`

To prepare the database or seed accounts manually:

```bash
pnpm --filter @cso-voting/backend db:migrate:offline
pnpm --filter @cso-voting/backend db:seed-admin:offline
pnpm --filter @cso-voting/backend db:seed-voter:offline
```

Offline commands are pinned to `http://127.0.0.1:8080` and refuse remote database URLs. Start `turso dev` first when running migrations or seed commands directly.

## 5. Backblaze B2 Bucket Setup

Candidate avatar images are stored in Backblaze B2. The backend uploads directly to B2 and stores the public URL in `candidates.imageUrl`.

### 5.1 Create the Bucket

1. Log in to the [Backblaze B2 console](https://console.backblaze.com/).
2. Create a bucket named **`cso-voting-candidates`**.
3. Set **Bucket Type** to **`allPublic`** — required because the frontend loads images directly from B2 URLs.
4. Note the bucket name; `wrangler.jsonc` already defaults to `cso-voting-candidates`.

### 5.2 Create an Application Key

1. In the B2 console, go to **App Keys** → **Add a New Application Key**.
2. Scope the key to the bucket you just created with **read** and **write** access.
3. Save the generated values:
   - **`keyID`** → `B2_APPLICATION_KEY_ID`
   - **`applicationKey`** → `B2_APPLICATION_KEY`

### 5.3 Configure Credentials

#### Local Development

```bash
cd apps/backend

# Create .dev.vars if it does not exist
cat <<EOF >> .dev.vars
B2_APPLICATION_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-key
EOF
```

`wrangler dev` automatically loads `.dev.vars`. The bucket name is already set in `wrangler.jsonc` under `vars` as `B2_BUCKET_NAME = "cso-voting-candidates"`.

#### Production (Cloudflare Workers)

```bash
cd apps/backend
wrangler secret put B2_APPLICATION_KEY_ID
wrangler secret put B2_APPLICATION_KEY
```

Do **not** commit `.dev.vars` or real secrets. They are gitignored.

### 5.4 Verify the Setup

```bash
# Backend only
pnpm dev:backend

# In a separate terminal — smoke test the upload endpoint
curl -X POST http://localhost:8787/candidates/<candidate-id>/image \
  -H "Cookie: session_id=<valid-session>" \
  -F "image=@/path/to/photo.jpg"
```

A `200 OK` with a JSON body containing `candidate.imageUrl` means B2 is wired correctly.

### 5.5 Expected B2 Key Format

Files are uploaded under:

```
candidates/{candidateId}/{uuid}.{ext}
```

Example: `candidates/abc-123/def-456.jpg`

The public URL follows this shape:

```
https://f003.backblazeb2.com/file/cso-voting-candidates/candidates/abc-123/def-456.jpg
```

## 6. Environment Variables

| Variable                   | Required              | Where to Set                    | Purpose                                    |
| -------------------------- | --------------------- | ------------------------------- | ------------------------------------------ |
| `TURSO_DATABASE_URL`       | Yes                   | `.env` / `.dev.vars`            | libSQL / Turso connection                  |
| `TURSO_AUTH_TOKEN`         | Yes\*                 | `.env` / `.dev.vars`            | Required for remote Turso                  |
| `B2_APPLICATION_KEY_ID`    | At runtime for images | `.dev.vars` / `wrangler secret` | B2 auth                                    |
| `B2_APPLICATION_KEY`       | At runtime for images | `.dev.vars` / `wrangler secret` | B2 auth                                    |
| `B2_BUCKET_NAME`           | Yes (for images)      | `wrangler.jsonc` `vars`         | Target bucket                              |
| `PUBLIC_API_BASE_URL`      | Local development     | apps/frontend `.env`            | Backend URL; leave empty in production     |
| `PUBLIC_TURNSTILE_SITEKEY` | Online builds         | apps/frontend `.env`            | Turnstile site key                         |
| `PUBLIC_OFFLINE_DEV`       | Offline builds        | apps/frontend `.env`            | Set to `true` only for offline development |
| `PUBLIC_SENTRY_DSN`        | Optional              | apps/frontend `.env`            | Leave empty offline                        |
| `TURNSTILE_SECRET_KEY`     | Production            | `wrangler secret`               | Server-side Turnstile verification         |
| `HMAC_SECRET`              | Production            | `wrangler secret`               | Base64 key for voter participation hashes  |
| `PREVIOUS_HMAC_SECRETS`    | During key rotation   | `wrangler secret`               | Comma-separated retained HMAC keys         |

> `*` Local SQLite (`file:./local.db`) typically does not need `TURSO_AUTH_TOKEN`.

## 7. Development Commands (or you may use justfile if you have it installed in your device)

```bash
# Install everything
pnpm install

# Both apps in parallel
pnpm dev

# Both apps with local Turso and no external service calls
pnpm dev:offline

# Backend only (port 8787)
pnpm dev:backend

# Frontend only (port 3001)
pnpm dev:frontend

# Typecheck all
pnpm typecheck

# Lint all
pnpm lint

# Test all
pnpm test

# Build production frontend assets
pnpm build

# Full quality gate
just check
```

## 8. End-to-End Tests

The offline Playwright suite starts or reuses Turso on port `8080`, runs offline migrations before seeding, builds the frontend with `PUBLIC_OFFLINE_DEV=true`, starts Wrangler on port `8787`, and fails on non-local browser requests:

```bash
pnpm test:e2e
```

The suite uses the same `apps/backend/local.db` as offline development. Do not set remote Turso credentials for this command.

The dependency-free Worker asset smoke test does not require the database server:

```bash
pnpm --filter @cso-voting/e2e exec playwright test tests/worker/asset-routing.spec.ts --project=worker-smoke
```

## 9. Database Commands (Backend)

```bash
cd apps/backend

pnpm db:generate   # New migration from schema.ts changes
pnpm db:migrate    # Apply migrations to remote Turso
pnpm db:push       # Push schema without migration (dev only)
pnpm db:studio     # Open Drizzle Studio
pnpm db:migrate:offline # Apply migrations to local Turso dev HTTP server
```

### Local Seed Scripts

Seed scripts refuse `NODE_ENV=production`; remote non-production databases also require `ALLOW_REMOTE_SEEDING=true`. Supply passwords through environment variables and never commit them:

```bash
TURSO_DATABASE_URL=file:./local.db SUPERADMIN_PASSWORD='<password>' pnpm db:seed-superadmin
TURSO_DATABASE_URL=file:./local.db ADMIN_PASSWORD='<password>' pnpm db:seed-admin
TURSO_DATABASE_URL=file:./local.db VOTER_PASSWORD='<password>' pnpm db:seed-voter
```

### Guarded Password Reset

`db:reset-password` rehashes one account, clears its login lockout, and invalidates its sessions. It prompts without echoing in an interactive terminal; automation should inject `RESET_PASSWORD` from a secrets manager. Remote targets require explicit approval:

```bash
RESET_STUDENT_ID='C24-01-00001-BSC001' \
ALLOW_REMOTE_PASSWORD_RESET=true NODE_ENV=production \
pnpm db:reset-password
```

## 10. Online Development and Deployment

Online development is an explicit opt-in: use `pnpm dev` with a non-local `TURSO_DATABASE_URL`, real `TURSO_AUTH_TOKEN`, Turnstile secret/site key, and B2 credentials. Never pass remote credentials to `dev:offline`, `db:migrate:offline`, offline seed commands, or the offline E2E suite.

Production is same-origin, so `PUBLIC_API_BASE_URL` must be empty and `PUBLIC_TURNSTILE_SITEKEY` must be a real site key:

```bash
cd apps/backend
PUBLIC_API_BASE_URL= PUBLIC_TURNSTILE_SITEKEY='<real-site-key>' pnpm deploy
```

The backend serves the built frontend from `../frontend/dist` as Cloudflare Assets with SPA fallback. Production deploys are continuous via **Cloudflare Workers Builds**: every push and pull request gets a unique preview URL, and pushes to the production branch deploy to the stable production Worker. See the runbook in [`docs/deployment/production-release.md`](./docs/deployment/production-release.md).

### HMAC Secret Rotation

`HMAC_SECRET` and every comma-separated value in `PREVIOUS_HMAC_SECRETS` must be standard base64 that decodes to at least 32 bytes. Generate a new key with `openssl rand -base64 32`.

Earlier releases treated the secret as literal UTF-8. To preserve existing participation hashes, encode the old value's exact bytes without a trailing newline:

```bash
printf %s "$EXISTING_HMAC_SECRET" | base64 | tr -d '\n'
```

Use that output as `HMAC_SECRET`, or retain it in `PREVIOUS_HMAC_SECRETS` while installing a new current key. Keep every key used by election participation records that must remain enforceable; losing one can let a hard-deleted and recreated voter evade the durable hash check.

## 11. Troubleshooting Backblaze

| Symptom                             | Fix                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `B2 credentials are not configured` | Add `B2_APPLICATION_KEY_ID` and `B2_APPLICATION_KEY` to `.dev.vars` (local) or set via `wrangler secret put` (production).       |
| `B2 bucket "..." not found`         | Create the bucket in the B2 console with the exact name `cso-voting-candidates`, or update `wrangler.jsonc`.                     |
| Images 403 / not loading            | Ensure the bucket type is **`allPublic`**. Private buckets block direct browser access.                                          |
| Upload returns 415                  | File must be `image/jpeg`, `image/png`, or `image/webp` and under **5 MB**.                                                      |
| Old image stays after delete        | B2 delete is best-effort; the DB reference is always cleared. Old orphaned files can be purged via B2 lifecycle rules if needed. |

## 12. Key Files

| What                         | Where                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| B2 client                    | `apps/backend/src/lib/b2-client.ts`                                                                     |
| Image upload/delete handlers | `apps/backend/src/handlers/candidates/image.handler.ts`                                                 |
| Candidate routes             | `apps/backend/src/routes/candidates/routes.ts`                                                          |
| DB schema + migration        | `apps/backend/src/database/schema.ts`, `apps/backend/src/database/migrations/0002_famous_supernaut.sql` |
| OpenAPI schemas              | `apps/backend/src/database/openapi-schemas.ts`                                                          |
| Frontend types               | `apps/frontend/src/lib/types.ts`                                                                        |
| Image upload component       | `apps/frontend/src/lib/components/ui/image-upload.svelte`                                               |
| Frontend candidate API       | `apps/frontend/src/lib/api/candidates.ts`                                                               |
| Worker env binding defaults  | `apps/backend/wrangler.jsonc`                                                                           |

## 13. Next Steps After Setup

1. Run `pnpm test` — all suites should pass.
2. Start the dev servers: `pnpm dev` or `just dev`/`just dev-offline`.
3. In the admin UI, open any candidate management page and upload an image.
4. Verify the image renders in the voting ballot and candidate card.
