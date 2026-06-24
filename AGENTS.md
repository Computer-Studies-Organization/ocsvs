# AGENTS.md — CSO Voting System (OCSVS)

Computer Studies Organization's voting platform. Monorepo: SvelteKit 2/Svelte 5 frontend + Hono/Cloudflare Workers/Turso (libSQL) backend, with pnpm workspaces.

## Quick Reference

| What | Command |
|------|---------|
| Install everything | `pnpm install` |
| Dev (both apps, parallel) | `pnpm dev` or `just dev` |
| Dev frontend only | `pnpm dev:frontend` (port 3001) |
| Dev backend only | `pnpm dev:backend` (port 8787 via wrangler) |
| Typecheck all | `pnpm typecheck` |
| Lint all | `pnpm lint` |
| Test all | `pnpm test` |
| Build all | `pnpm build` |
| Backend only (cwd in `apps/backend`) | `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm lint:fix` |
| Frontend only (cwd in `apps/frontend`) | `pnpm dev` (port 3001) / `pnpm check` (typecheck) / `pnpm test` / `pnpm build` |
| DB scripts (backend) | `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio` / `pnpm cf-typegen` |
| Deploy backend | `pnpm deploy` (wrangler deploy --minify) |
| Full quality check | `just check` (typecheck → lint → test) |
| Lint auto-fix all | `just lint-fix` |

> The `justfile` at root provides shorthand recipes (`just dev`, `just check`, `just lint-fix`, `just db-generate`, etc.) wrapping the pnpm commands.

## Monorepo Layout

```
ocsvs/
├── apps/
│   ├── backend/        # @cso-voting/backend — Hono API on Cloudflare Workers (Turso / libSQL)
│   ├── frontend/       # @cso-voting/frontend — SvelteKit 2 + Svelte 5 (active frontend)
│   └── frontend-react/ # Experimental: React + TanStack Router (excluded from pnpm workspace via !apps/frontend-react)
├── packages/           # Reserved for shared code (currently empty — just .gitkeep)
├── docs/
│   └── superpowers/    # Project documentation
├── scripts/            # Root-level scripts
├── .github/workflows/ci.yml  # CI: install → typecheck → lint → test → build
├── justfile            # Task runner (just) — delegates to pnpm scripts
└── pnpm-workspace.yaml # Workspace: apps/* (excl. frontend-react) + packages/*
```

The workspace is declared in `pnpm-workspace.yaml` (`apps/*` excluding `frontend-react`, and `packages/*`).

## Task Runner — `justfile`

The `justfile` at the root wraps common pnpm commands. Core recipes:

| `just` recipe | Delegates to | Description |
|---------------|-------------|-------------|
| `just dev` | `pnpm dev` | Both apps parallel |
| `just dev-fe` | `pnpm dev:frontend` | Frontend only |
| `just dev-be` | `pnpm dev:backend` | Backend only |
| `just check` | typecheck → lint → test | Full quality gate |
| `just lint-fix` | `pnpm -r lint:fix` | Auto-fix lint |
| `just db-generate` | `cd apps/backend && pnpm db:generate` | New migration |
| `just db-migrate` | `cd apps/backend && pnpm db:migrate` | Apply migrations |
| `just cf-typegen` | `cd apps/backend && pnpm cf-typegen` | Regenerate CF types |

Run `just` with no args to list all recipes.

## Backend (`apps/backend`)

### Stack

- **Runtime:** Cloudflare Workers via Wrangler 4.x (`wrangler.jsonc`)
- **Framework:** Hono 4 with `@hono/zod-openapi` for OpenAPI 3.0 generation
- **DB:** [Turso](https://turso.tech) (libSQL) accessed via `@libsql/client` + `drizzle-orm/libsql`; migrations live in `src/database/migrations/`
- **ORM:** Drizzle ORM 0.44 + `drizzle-zod` for select schemas
- **Validation:** Zod (and Zod from `@hono/zod-openapi`)
- **Logging:** Pino via `hono-pino` (pretty in dev, JSON in prod)
- **Auth:** Session cookies (`session_id`), PBKDF2-SHA256 password hashing (Web Crypto API; 100k iterations, 16-byte salt, 256-bit key)
- **OpenAPI UI:** Scalar at `GET /reference`; raw spec at `GET /docs`
- **Tests:** Vitest 3
- **Lint:** `oxlint` (with `oxfmt --check` for formatting)
- **Path alias:** `@/*` → `src/*` (see `tsconfig.json` and `vitest.config.ts`)
- **Production static assets:** Backend serves the built frontend (`../frontend/dist`) as Cloudflare Assets with SPA fallback (configured in `wrangler.jsonc`)

### Architecture / Layering

```
src/
├── app.ts                    # App factory entry: mounts routes at '/'
├── config/db/index.ts        # createDb(c) returns { db } using @libsql/client (Turso)
├── database/
│   ├── schema.ts             # Drizzle table defs + select schemas
│   ├── schema-names.test.ts  # Invariant test for schema/API drift
│   ├── migrations/           # Generated SQL migrations (versioned)
│   ├── openapi-schemas.ts    # OpenAPI-flavored Zod schemas (booleans, examples)
│   ├── repositories/         # Single-table data access (accountRepo, candidateRepo, electionRepo, positionRepo, userRepo, voteRepo)
│   └── queries/              # Cross-table / joined queries (userAccountQueries, electionQueries, votingStateQueries)
├── handlers/                 # AppRouteHandler implementations (one file per resource)
├── routes/                   # Hono router + createRoute() definitions
│   ├── auth/                 # /register, /login, /logout, /me
│   ├── candidates/           # /candidates CRUD (admin-gated writes)
│   ├── elections/            # /elections (CRUD), /elections/current, /elections/state, /elections/:id/transitions, /elections/:id/results, /elections/:id/positions
│   ├── profile/              # /me/profile, /me/password
│   ├── users/                # /users (admin-only)
│   ├── votes/                # /votes, /votes/me, /votes/results, /votes/candidates/:id/count
│   └── index.route.ts        # / -> "Hono API"
├── lib/
│   ├── create-app.ts         # OpenAPIHono factory + middleware chain + createTestApp helper
│   ├── election-lifecycle.ts # Election state machine (draft→open→closed→archived) with TransitionError
│   ├── session.ts            # Session CRUD + cookie helpers (session_id, 7-day TTL)
│   ├── password.ts           # hashPassword / verifyPassword (PBKDF2 via Web Crypto)
│   ├── profanity.ts          # bad-words wrapper, used in profile updates
│   ├── errors.ts             # isUniqueConstraintError() detector
│   ├── constants/            # Centralized ERROR_MESSAGES
│   ├── types/                # AppBindings, AppOpenAPI, AppRouteHandler
│   ├── validation/           # booleanQuery for query strings
│   └── openapi-configuration.ts  # OpenAPI doc + Scalar reference UI setup
├── middleware/
│   ├── auth.ts               # requireAuth, requireAdmin
│   ├── env.ts                # parseEnv() Zod-validated process.env (for scripts, not Workers)
│   ├── pino-logger.ts        # Request-id-aware Pino logger (primary logger for handlers)
│   ├── custom-logger.ts      # Lightweight timestamped console.warn logger (fallback/alternative)
│   └── utils/                # json-content, create-error-schema, id-params-validator, on-error, not-found, serve-emoji-favicon
├── openapi/
│   ├── default-hook.ts       # Zod validation error hook (returns 422)
│   ├── http-status-codes.ts  # Named HTTP status constants (OK=200, CREATED=201, etc.)
│   └── http-status-phrases.ts # Status phrase constants
├── scripts/ (standalone — not part of src)
│   ├── seed-admin.ts         # Seed admin account into Turso
│   ├── verify-pragma-fk.ts   # PRAGMA foreign_keys verification (local)
│   ├── verify-migration-fk.ts # Migration FK behaviour (local)
│   ├── verify-turso-fk.ts    # PRAGMA + enforcement on live Turso
│   ├── verify-future-migration.ts # Reproduces NOT NULL ADD COLUMN failure
│   └── verify-real-fk.ts     # End-to-end FK exercise on Turso
└── worker-configuration.d.ts  # Auto-generated by pnpm cf-typegen — do not hand-edit
```

### Request Lifecycle

1. `createApp()` (`src/lib/create-app.ts:13`) sets up an `OpenAPIHono<AppBindings>` with: pino logger → CORS (`http://localhost:3001` only, `credentials: true`) → emoji favicon → notFound/onError. Env is read from `c.env` (Worker bindings).
2. Per-resource routers are mounted at `/` in `app.ts`. Each router applies its own `requireAuth`/`requireAdmin` middleware before `openapi(route, handler)`.
3. Handlers use `c.req.valid('json' | 'query' | 'param')` (Zod-validated by the route's schema + `defaultHook` returning 422 on failure).
4. Database access: `const { db } = createDb(c)` (libSQL client from `c.env`) → call `electionRepo.*`, `voteRepo.*`, etc. A fresh `createClient` is constructed per request (acceptable for libSQL HTTP transport).
5. Auth: `requireAuth` reads the `session_id` cookie → joins `sessions` + `accounts` in Turso → sets `c.set('authUser', { id, email, username, role })`. 401 on missing/expired.
6. Errors: prefer returning `c.json({ message }, httpStatusCodes.XXX)` using `ERROR_MESSAGES` constants. Unhandled errors land in `onError` (env-aware stack trace).

### Conventions

- **Route definitions** live next to the router (`routes/<resource>/routes.ts`); handlers live in `handlers/<resource>/<resource>.handler.ts`. The router (`routes/<resource>/index.ts`) wires them.
- **Election routes** follow a layered middleware pattern in `routes/elections/index.ts`: `requireAuth` at the `/elections/*` level, then `requireAdmin` on specific sub-paths.
- **OpenAPI schemas for the API layer** are in `database/openapi-schemas.ts` and use `@hono/zod-openapi`'s `z`. They intentionally differ from DB select schemas (e.g. `z.boolean()` vs `integer(0|1)` in DB). See `database/schema-names.test.ts` for the invariant test.
- **Atomic multi-statement writes** use libSQL's `db.batch([...])`. Examples: `accountRepo.create` (account + user insert), `submitVote` (multiple vote inserts).
- **Unique-constraint handling** uses `isUniqueConstraintError()` (string-matches "UNIQUE constraint failed"). Registration has a pre-check *and* this fallback to cover race conditions.
- **Timestamps:** all stored as integer Unix seconds via `unixepoch()` default. Handlers compute `Math.floor(Date.now() / 1000)` when setting timestamps manually.
- **Soft delete:** `accounts` use `deletedAt` integer (filtered via `isNull`); `candidates` use `isActive` 0/1.
- **Vote integrity:** unique indexes on `(userId, candidateId)` and `(userId, positionId, electionId)` enforce one-vote-per-position-per-election. Voting status is derived from `votes` table — no `hasVoted` flag on users.
- **Election model:** `elections` and `positions` are first-class tables. `elections_one_open_idx` is a partial unique index `WHERE status = 'open'` — at most one open election at a time. Positions are per-election, ordered by `displayOrder`.
- **Error/success messages** must come from `lib/constants/error-messages.ts` (see `lib/constants/README.md`). Don't inline ad-hoc strings.
- **Boolean query params** must use the `booleanQuery` helper from `lib/validation/boolean-query.ts` (Zod `z.coerce.boolean()` only treats empty string as false).
- **ID generation:** always `crypto.randomUUID()` (Workers exposes Web Crypto).
- **Auth checks** are in two places: middleware (`requireAuth`/`requireAdmin` on the router) **and** a defensive `c.var.authUser.role !== 'admin'` check inside mutation handlers. Don't remove either; the handler-level check is the source of truth if middleware is bypassed in tests.
  - **Exception:** `routes/elections/index.ts` uses handler-only admin checks (middleware was removed because Cloudflare Workers `router.use()` prefix-match blocks GET sub-routes — see comment at line 50). Any new election mutation handler added to that router **must** include the `c.var.authUser?.role !== 'admin'` guard.
- **Hono `strict: false`** is set on the router so trailing slashes don't 404.
- **CORS** is hardcoded to `http://localhost:3001` with `credentials: true`. If you change the frontend dev port, update `lib/create-app.ts:27`.

### Auth & Sessions

- `session_id` cookie: `Path=/; HttpOnly; SameSite=Lax; Expires=…; Secure` (Secure only when `NODE_ENV === 'production'`).
- Session TTL: 7 days (`SESSION_DURATION_DAYS` in `lib/session.ts:6`).
- `requireAuth` returns 401 with `{ message: 'Unauthorized' }` if cookie missing, and `{ message: 'Session expired or invalid' }` if lookup fails.
- The session lookup joins `accounts` and filters out soft-deleted accounts (`isNull(accounts.deletedAt)`).
- Login is by **student number + password** (`studentId`, not username or email). Register accepts email optionally.
- Voting status is derived from the `votes` table (not stored on account/user).

### Database

- Drizzle config: `drizzle.config.ts` uses `dialect: 'turso'` and reads `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` from env (set in `apps/backend/.env` for local, or via `wrangler secret` for production).
- The `AppBindings` type is `Environment & Omit<CloudflareBindings, keyof Environment>` (the wrangler-generated interface is `CloudflareBindings`, not `Env`). See `src/lib/types/app-types.ts`.
- Migrations are auto-generated, versioned, and committed under `src/database/migrations/`. Applied via `pnpm db:migrate` against the remote Turso database.
- Schema is the single source of truth. After changing `src/database/schema.ts` run `pnpm db:generate` then commit the new SQL.

### Foreign keys & migrations

- **libsql and Turso default `PRAGMA foreign_keys = ON`** (verified empirically — see `apps/backend/scripts/verify-turso-fk.ts`). Do **not** issue `PRAGMA foreign_keys = ON` in `src/config/db`; it's already on. The `onDelete: '…'` declarations in `schema.ts` ARE enforced at runtime.
- **Important caveat about `schema.ts` comments:** The file contains a NOTE comment (lines 100-110) stating that `onDelete: 'restrict'` on `positions`, `candidates`, and `votes` tables end up as `NO ACTION` because SQLite's `ALTER TABLE ADD COLUMN ... REFERENCES` cannot express `ON DELETE`. This comment was written when `PRAGMA foreign_keys` was thought to be OFF. With the current `PRAGMA foreign_keys = ON` default, the `NO ACTION` FKs **are** enforced (behaving as RESTRICT for non-deferred constraints). The comment is outdated — trust the actual runtime behaviour.
- **Drizzle silently drops `ON DELETE` / `ON UPDATE` from SQLite `ALTER TABLE ADD COLUMN`** (tracked as [drizzle-orm#5619](https://github.com/drizzle-team/drizzle-orm/issues/5619)).
- **Future migrations that `ADD` a `NOT NULL` column (with or without `REFERENCES`) to a POPULATED table will fail** with `Cannot add a NOT NULL column with default value NULL`. Two safe patterns:
  - **Table-recreation:** `CREATE new … → copy rows → DROP old → ALTER TABLE new RENAME TO old`. Always works.
  - **Nullable-then-backfill:** `ADD col TEXT REFERENCES …` (nullable), backfill values, then recreate the table with `NOT NULL`.
  - The `ALTER TABLE … ADD … NOT NULL REFERENCES …` form in migration `0001_sharp_lord_tyger.sql` only works because the preceding `DELETE FROM votes/candidates` emptied the tables first. Don't copy that pattern for populated tables.
- **Verification scripts** in `apps/backend/scripts/` — run these any time you suspect FK behaviour has changed:
  - `verify-pragma-fk.ts`, `verify-migration-fk.ts`, `verify-turso-fk.ts`, `verify-future-migration.ts`, `verify-real-fk.ts`

### Election Lifecycle

Defined in `src/lib/election-lifecycle.ts`:

- **State machine:** `draft → open → closed → archived` (archived is terminal). Also allows `closed → draft` (reopen for editing).
- **Assertion logic:** `assertTransition(from, to, body, positionCount)` validates transitions and throws `TransitionError` (with HTTP status code) for invalid transitions, missing position count on `draft→open`, or missing/invalid `opensAt/closesAt` timestamps.
- **Transitions** are requested via `POST /elections/:id/transitions` with `{ to, opensAt?, closesAt? }`.

### Voting State Composite Endpoint

`GET /elections/state` (`/elections/state` route, handler in `handlers/elections/voting-state.handler.ts`) returns a composite response:

```typescript
interface VotingState {
  open: ElectionRow | null;       // Current open election (if any)
  nextDraft: { id, name, opensAt, closesAt } | null;  // Earliest upcoming draft
  lastClosed: { id, name, closesAt, results } | null;  // Latest closed with results
  myVotes: { electionId, votes: Array<{ candidateId, positionId }> };  // User's votes in current open election
}
```

This is the primary endpoint the frontend uses to determine what to display on the voting page. It replaces multiple separate calls and handles the "no active election" / "no upcoming election" / "results available" empty states at the backend.

### Testing

- Tests live next to source as `*.test.ts`. Backend uses **Vitest**.
- Backend tests **mock the DB and middleware** rather than hitting a real Turso instance:
  - `vi.mock('@/middleware/auth', ...)` provides stubs `requireAuth`/`requireAdmin` that set `authUser` and let you flip `AUTH_ENABLED` and `TEST_USER.role` to test 401/403.
  - `vi.mock('@/config/db', ...)` provides `createDb: vi.fn(() => ({ db: {} }))`; downstream repos/queries are mocked individually with `vi.hoisted`.
  - `vi.mock('@/lib/create-app', ...)` injects a logger into `c.var.logger`.
  - Tests build a `createMockDb()` builder (chainable `select/insert/update/delete`) and assert via `expect(mockDb.insert).toHaveBeenCalledWith(...)`.
  - Hono router is invoked directly with `router.request('/path', { method, headers, body })` (no real server).
- **Always run the test suite after schema/handler changes** — DB-level invariants in `schema-names.test.ts` catch schema/API drift.

### Things to be careful about

- **CORS allowlist** is `http://localhost:3001`. The frontend's Vite dev port is set in `apps/frontend/package.json` (`vite dev --port 3001`). Keep these in sync if you change either.
- **Path alias** `@/` is configured in both `tsconfig.json` and `vitest.config.ts` (via `vite-tsconfig-paths`). Don't import via deep relative paths; use the alias.
- **`worker-configuration.d.ts`** is auto-generated by `pnpm cf-typegen` (Wrangler). Don't hand-edit.
- **Don't commit** `.env` / `.dev.vars` — gitignored. Required keys for Turso migrations: `TURSO_DATABASE_URL` (and `TURSO_AUTH_TOKEN` for remote). For local dev, `wrangler dev` reads from `.dev.vars` or `.env`. For local libSQL without Turso, set `TURSO_DATABASE_URL=file:./local.db` (SQLite file).
- **`NODE_ENV`, `LOG_LEVEL`, `TURSO_DATABASE_URL`** are set in `wrangler.jsonc` `vars` (development defaults). Production overrides go via `wrangler secret` / environment. **`TURSO_AUTH_TOKEN` must be set as a secret in production** — do not put it in `wrangler.jsonc` `vars`.
- **The `env.ts` middleware** (`src/middleware/env.ts`) is for standalone scripts (like `seed-admin.ts`), not for Worker request handlers — Workers read env from `c.env`.
- **`seed-admin.ts`** (`apps/backend/scripts/seed-admin.ts`) is a standalone script for seeding the first admin account. Run with `tsx` from the `apps/backend` directory. It reads `.env` for Turso credentials and calls `parseEnv(process.env)` — it's not part of the Worker.

## Frontend (`apps/frontend`) — SvelteKit (Active)

### Stack

- **SvelteKit 2** + **Svelte 5** (runes mode with `$props()`, `$state()`)
- **Routing:** SvelteKit file-based routing with layout groups `(public)`, `(protected)`, `(admin)`
- **Data:** SvelteKit `fetch` with cookie-based auth (session cookie `session_id`)
- **UI:** Tailwind 4 via `@tailwindcss/vite` plugin
- **Auth:** Session cookie based, with `authStore` writable store
- **Build output:** Built as static SPA via `@sveltejs/adapter-static` (outputs to `dist/`)
- **Typecheck:** `svelte-check` (via `pnpm check`)
- **Tests:** Node built-in test runner (`node:test`) with `--experimental-test-module-mocks`
- **Lint:** `oxlint` + `oxfmt`

### Architecture

```
src/
├── routes/                   # SvelteKit file-based routes
│   ├── +layout.svelte        # Root layout — initializes auth from /me
│   ├── (public)/             # Public area (login/register)
│   │   └── auth/             #   login, register pages
│   ├── (protected)/          # Authenticated area
│   │   ├── voting/           #   Voting page
│   │   ├── results/          #   Election results
│   │   └── settings/         #   Profile/password settings
│   └── (admin)/              # Admin area
│       ├── admin/            #   Election management
│       │   └── elections/    #     CRUD, positions, transitions
│       └── admin-dashboard/  #   Dashboard + results viewing
├── lib/
│   ├── stores/auth.ts        # Auth state: { user, loading }
│   ├── api/                  # Fetch-based API wrappers
│   │   ├── client.ts        # apiFetch() with ApiError
│   │   ├── auth.ts          # login/register/logout/me
│   │   ├── elections.ts     # Election CRUD, transitions, positions
│   │   ├── candidates.ts    # Candidate list/create/update
│   │   ├── votes.ts         # Vote submission + results
│   │   ├── users.ts         # User management (admin)
│   │   ├── positions.ts     # Position CRUD
│   │   └── profile.ts       # Profile update
│   ├── types.ts              # Type definitions
│   ├── routeGuards.ts        # Pure redirect decision functions
│   ├── userRegistration.ts   # Registration validation + mutation helpers
│   ├── election-lifecycle-client.ts # Client-side election state helpers
│   ├── voting-page-state.ts  # Voting page state machine
│   ├── voting-stepper-logic.ts # Voting stepper logic
│   ├── vote-count-utils.ts   # Vote count formatting
│   ├── mutation-feedback-utils.ts # Error extraction helpers
│   └── components/ui/        # Reusable UI components
├── app.html                  # HTML shell (references favicon.svg)
├── app.css                   # Global styles (Tailwind)
└── app.d.ts                  # Global type declarations
```

### Conventions

- **Route guards** use `getProtectedRouteRedirectPath`, `getAdminRouteRedirectPath`, `getPublicRouteRedirectPath` from `lib/routeGuards.ts`.
- **API calls** use `apiFetch<T>` from `lib/api/client.ts` which returns JSON or throws `ApiError(status, message)`.
- **Auth flow**: Root layout's `onMount` calls `/me` and sets `authStore`. Layout guards redirect based on store state.
- **Error extraction**: `extractErrorMessage()` in `lib/mutation-feedback-utils.ts` is the canonical helper.
- **CSS** is Tailwind 4 via `@tailwindcss/vite` plugin (not CDN).

### Testing

- Uses **Node's built-in test runner** (`node:test`).
- Test command: `node --experimental-test-module-mocks --import tsx --test src/lib/*.test.ts`
- Test files are in `src/lib/` alongside their modules (e.g. `routeGuards.test.ts`, `userRegistration.test.ts`, `voting-page-state.test.ts`, `voting-stepper-logic.test.ts`, `vote-count-utils.test.ts`, `adminUsers.test.ts`).
- Typecheck runs via `svelte-check` (`pnpm check`), not `tsc`.

### Things to be careful about

- **`PUBLIC_API_BASE_URL`** env variable must be set to `http://localhost:8787` in `.env`.
- **Port 3001** — frontend dev server runs on port 3001 (configured in `package.json` as `vite dev --port 3001`). CORS on the backend allows `http://localhost:3001`.
- **Favicon reference** in `app.html` points to `favicon.svg` (ensure the file exists in `static/`).
- **`@sveltejs/adapter-static`** with SPA fallback (`fallback: "404.html"`). The backend serves this output as Cloudflare Assets in production.
- **Session cookie**: Same as backend conventions (HttpOnly, SameSite=Lax).

## Frontend (`apps/frontend-react`) — Experimental React Rewrite

A React + TanStack Router rewrite of the frontend, **excluded from the pnpm workspace** (`!apps/frontend-react` in `pnpm-workspace.yaml`). This is work-in-progress and not wired into CI/CD or the backend's asset serving.

### Stack

- **React 19** + **Vite 6**
- **Routing:** TanStack Router (file-based via `@tanstack/router-plugin`, `routeTree.gen.ts` auto-generated)
- **Data fetching:** TanStack React Query 5 + axios
- **UI:** Tailwind 4 with `tw-animate-css`, `lucide-react` icons, `class-variance-authority`
- **Path alias:** `@/` → `./src/` (Vite resolve alias)
- **Tests:** Node built-in test runner (`node:test` with `tsx`)
- **Lint:** `oxlint` + `oxfmt`

### Architecture

```
src/
├── routes/                   # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (ToastProvider, TanStack Router Devtools)
│   ├── index.tsx             # Landing page
│   ├── auth/                 # login.tsx, register.tsx, login-v1.tsx, login-v2.tsx
│   ├── dashboard/            # index.tsx, my-ballot/
│   ├── admin-dashboard/      # index.tsx, users.tsx, users-table.tsx, view-results/
│   └── settings.tsx
├── api/                      # Axios-based API wrappers
│   ├── axios.ts             # Axios instance (baseURL localhost:8787, withCredentials)
│   └── *._api.ts            # candidate_api, profile_api, user_api, votes_api
├── lib/                      # UI and utility modules
├── hooks/                    # React hooks
├── components/               # Shared components
├── middleware/                # Auth redirect middleware
├── data/                     # Data layer
└── assets/                   # Static assets
```

### Notes

- **Axios** is used with `withCredentials: true` for session cookie auth.
- Has multiple login page versions (v1, v2, current) — indicates active redesign work.
- Has admin-dashboard variants (`admin-dashboard-v1.tsx`, `admin-dashboard-v2.tsx`, `admin-dashboard/` directory).
- Route auto-code-splitting enabled (`autoCodeSplitting: true` in router plugin config).
- Not connected to CI/CD. Run `pnpm dev`, `pnpm build`, etc. from within `apps/frontend-react/` directory.

## Cross-Cutting

### CI (`.github/workflows/ci.yml`)

Triggers on PR and push to `main`. Runs on Node 22 with pnpm. Steps: install (frozen lockfile) → typecheck → lint → test → build. Use this order locally before pushing.

### Linting

- All apps use `oxlint` for linting and `oxfmt` for formatting, run together as `oxlint . && oxfmt --check .`. Configs live in each app's `.oxlintrc.json` (ignore patterns only).
- `pnpm lint` forwards to each app via `pnpm -r lint`.
- `pnpm lint:fix` (or `just lint-fix`) applies auto-fixes.

### Type Generation

- Backend: `pnpm cf-typegen` regenerates `apps/backend/worker-configuration.d.ts` from `wrangler.jsonc`. Run after binding/env changes.

### Environment Variables (backend dev)

Required for Turso connectivity (set in `.dev.vars` for local wrangler, or as `wrangler secret` for production):
- `TURSO_DATABASE_URL` — libSQL connection URL (e.g. `libsql://your-db.turso.io` for remote, `file:./local.db` for local SQLite)
- `TURSO_AUTH_TOKEN` — Turso auth token (only required for remote)

`NODE_ENV`, `LOG_LEVEL`, `TURSO_DATABASE_URL` are set in `wrangler.jsonc` `vars` for dev. `TURSO_AUTH_TOKEN` must be a secret in production.

### Naming & Style

- 2-space indent, double quotes, trailing semicolons, parens around single arrow-function parameters (oxfmt defaults — no `.oxfmtrc.json`; pin if you want to deviate), ESM throughout (`"type": "module"` in every package).
- File names: kebab-case for routes, camelCase for everything else; handler files `<resource>.handler.ts`; route files `routes.ts` or `<resource>.route.ts`.
- Type imports use the `import type { ... }` form.
- Handlers/repos return Promises; the test layer relies on `await`-ing every Drizzle call.
