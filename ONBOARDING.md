# Onboarding — OCSVS

Computer Studies Organization Voting System (OCSVS). This file is the fastest path from “fresh clone” to “running locally with working Backblaze storage.”

## 1. Prerequisites

- **Node.js** >= 20.16.0 < 21 || >= 22.3.0
- **pnpm** >= 9.0.0
- **wrangler** (comes via devDependencies)
- **Turso CLI** (required only for the seeded local E2E suite)
- **Backblaze B2** account (free tier works for staging)

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
├── docs/superpowers/   # Plans + specs (agent scratchpads, stay untracked)
├── justfile            # Task runner shortcuts
├── pnpm-workspace.yaml
└── ONBOARDING.md       # You are here
```

## 4. Backblaze B2 Bucket Setup

Candidate avatar images are stored in Backblaze B2. The backend uploads directly to B2 and stores the public URL in `candidates.imageUrl`.

### 4.1 Create the Bucket

1. Log in to the [Backblaze B2 console](https://console.backblaze.com/).
2. Create a bucket named **`cso-voting-candidates`**.
3. Set **Bucket Type** to **`allPublic`** — required because the frontend loads images directly from B2 URLs.
4. Note the bucket name; `wrangler.jsonc` already defaults to `cso-voting-candidates`.

### 4.2 Create an Application Key

1. In the B2 console, go to **App Keys** → **Add a New Application Key**.
2. Scope the key to the bucket you just created with **read** and **write** access.
3. Save the generated values:
   - **`keyID`** → `B2_APPLICATION_KEY_ID`
   - **`applicationKey`** → `B2_APPLICATION_KEY`

### 4.3 Configure Credentials

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

### 4.4 Verify the Setup

```bash
# Backend only
pnpm dev:backend

# In a separate terminal — smoke test the upload endpoint
curl -X POST http://localhost:8787/candidates/<candidate-id>/image \
  -H "Cookie: session_id=<valid-session>" \
  -F "image=@/path/to/photo.jpg"
```

A `200 OK` with a JSON body containing `candidate.imageUrl` means B2 is wired correctly.

### 4.5 Expected B2 Key Format

Files are uploaded under:

```
candidates/{candidateId}/{uuid}.{ext}
```

Example: `candidates/abc-123/def-456.jpg`

The public URL follows this shape:

```
https://f003.backblazeb2.com/file/cso-voting-candidates/candidates/abc-123/def-456.jpg
```

## 5. Environment Variables

| Variable                | Required              | Where to Set                    | Purpose                               |
| ----------------------- | --------------------- | ------------------------------- | ------------------------------------- |
| `TURSO_DATABASE_URL`    | Yes                   | `.env` / `.dev.vars`            | libSQL / Turso connection             |
| `TURSO_AUTH_TOKEN`      | Yes\*                 | `.env` / `.dev.vars`            | Required for remote Turso             |
| `B2_APPLICATION_KEY_ID` | At runtime for images | `.dev.vars` / `wrangler secret` | B2 auth                               |
| `B2_APPLICATION_KEY`    | At runtime for images | `.dev.vars` / `wrangler secret` | B2 auth                               |
| `B2_BUCKET_NAME`        | Yes (for images)      | `wrangler.jsonc` `vars`         | Target bucket                         |
| `PUBLIC_API_BASE_URL`   | Yes (frontend)        | apps/frontend `.env`            | Backend URL (`http://localhost:8787`) |

> `*` Local SQLite (`file:./local.db`) typically does not need `TURSO_AUTH_TOKEN`.

## 6. Development Commands

```bash
# Install everything
pnpm install

# Both apps in parallel
pnpm dev

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

# Build all
pnpm build

# Full quality gate
just check
```

## 7. End-to-End Tests

The Worker-origin Playwright suite starts Wrangler on port `8787`. Seeded browser tests also require a local Turso dev server on port `8080`; CI starts this service automatically.

For the full suite, run the database server in one terminal:

```bash
turso dev --db-file "$PWD/apps/backend/local.db" --port 8080
```

In another terminal from the repository root:

```bash
export TURSO_DATABASE_URL=http://127.0.0.1:8080
unset TURSO_AUTH_TOKEN
pnpm --filter @cso-voting/backend db:migrate
pnpm test:e2e
```

The dependency-free Worker asset smoke test does not require the database server:

```bash
pnpm --filter @cso-voting/e2e exec playwright test tests/worker/asset-routing.spec.ts --project=worker-smoke
```

## 8. Database Commands (Backend)

```bash
cd apps/backend

pnpm db:generate   # New migration from schema.ts changes
pnpm db:migrate    # Apply migrations to remote Turso
pnpm db:push       # Push schema without migration (dev only)
pnpm db:studio     # Open Drizzle Studio
```

## 9. Deployment

```bash
cd apps/backend
pnpm deploy        # wrangler deploy --minify
```

The backend serves the built frontend from `../frontend/dist` as Cloudflare Assets with SPA fallback. Production releases use the protected workflow and runbook in [`docs/deployment/production-release.md`](./docs/deployment/production-release.md).

## 10. Troubleshooting Backblaze

| Symptom                             | Fix                                                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `B2 credentials are not configured` | Add `B2_APPLICATION_KEY_ID` and `B2_APPLICATION_KEY` to `.dev.vars` (local) or set via `wrangler secret put` (production).       |
| `B2 bucket "..." not found`         | Create the bucket in the B2 console with the exact name `cso-voting-candidates`, or update `wrangler.jsonc`.                     |
| Images 403 / not loading            | Ensure the bucket type is **`allPublic`**. Private buckets block direct browser access.                                          |
| Upload returns 415                  | File must be `image/jpeg`, `image/png`, or `image/webp` and under **5 MB**.                                                      |
| Old image stays after delete        | B2 delete is best-effort; the DB reference is always cleared. Old orphaned files can be purged via B2 lifecycle rules if needed. |

## 10. Key Files

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

## 11. Next Steps After Setup

1. Run `pnpm test` — all suites should pass.
2. Start the dev servers: `pnpm dev`.
3. In the admin UI, open any candidate management page and upload an image.
4. Verify the image renders in the voting ballot and candidate card.
