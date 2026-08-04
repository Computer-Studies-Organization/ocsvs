# AGENTS.md — CSO Voting System (OCSVS)

Computer Studies Organization's voting platform. Monorepo: SvelteKit 2/Svelte 5 frontend + Hono/Cloudflare Workers/Turso (libSQL) backend, with pnpm workspaces.

## Quick Reference

| What                                   | Command                                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Install everything                     | `pnpm install`                                                                                 |
| Dev (both apps, parallel)              | `pnpm dev` or `just dev`                                                                       |
| Dev frontend only                      | `pnpm dev:frontend` (port 3001)                                                                |
| Dev backend only                       | `pnpm dev:backend` (port 8787 via wrangler)                                                    |
| Typecheck all                          | `pnpm typecheck`                                                                               |
| Lint all                               | `pnpm lint`                                                                                    |
| Test all                               | `pnpm test`                                                                                    |
| Test E2E                               | `cd apps/e2e && pnpm test`                                                                     |
| Build all                              | `pnpm build`                                                                                   |
| Backend only (cwd in `apps/backend`)   | `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm lint:fix`                        |
| Frontend only (cwd in `apps/frontend`) | `pnpm dev` (port 3001) / `pnpm check` (typecheck) / `pnpm test` / `pnpm build`                 |
| DB scripts (backend)                   | `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio` / `pnpm cf-typegen` |
| Deploy backend                         | `pnpm deploy` (wrangler deploy --minify)                                                       |
| Full quality check                     | `just check` (typecheck → lint → test)                                                         |
| Lint auto-fix all                      | `just lint-fix`                                                                                |

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

| `just` recipe      | Delegates to                          | Description         |
| ------------------ | ------------------------------------- | ------------------- |
| `just dev`         | `pnpm dev`                            | Both apps parallel  |
| `just dev-fe`      | `pnpm dev:frontend`                   | Frontend only       |
| `just dev-be`      | `pnpm dev:backend`                    | Backend only        |
| `just check`       | typecheck → lint → test               | Full quality gate   |
| `just lint-fix`    | `pnpm -r lint:fix`                    | Auto-fix lint       |
| `just db-generate` | `cd apps/backend && pnpm db:generate` | New migration       |
| `just db-migrate`  | `cd apps/backend && pnpm db:migrate`  | Apply migrations    |
| `just cf-typegen`  | `cd apps/backend && pnpm cf-typegen`  | Regenerate CF types |

Run `just` with no args to list all recipes.

## Backend (`apps/backend`)

### Stack

- **Runtime:** Cloudflare Workers via Wrangler 4.x (`wrangler.jsonc`)
- **Framework:** Hono 4 with `@hono/zod-openapi` for OpenAPI 3.0 generation
- **DB:** [Turso](https://turso.tech) (libSQL) accessed via `@libsql/client` + `drizzle-orm/libsql`; migrations live in `src/database/migrations/`
- **ORM:** Drizzle ORM 0.44 + `drizzle-zod` for select schemas
- **Validation:** Zod (and Zod from `@hono/zod-openapi`)
- **Logging:** Pino via `hono-pino` (pretty in dev, JSON in prod)
- **Auth:** Session cookies (`session_id`), PBKDF2-SHA256 password hashing (Web Crypto API; 600k iterations, 16-byte salt, 256-bit key, versioned stored format `pbkdf2-sha256$<iterations>$<salt>$<hash>` with legacy 2-field hashes verified at 100k and rehashed on login)
- **Object storage:** Backblaze B2 for candidate images (via `backblaze-b2` SDK; upload, download, delete with magic-byte validation)
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
│   ├── repositories/         # Single-table data access
│   │   ├── audit-log.repository.ts
│   │   ├── candidates.repository.ts
│   │   ├── database.type.ts  # DbClient and Database type aliases
│   │   ├── election.repository.ts
│   │   ├── login-attempt.repository.ts   # Failed login tracking for lockout
│   │   ├── party-list.repository.ts      # Party list CRUD (in progress)
│   │   ├── position.repository.ts
│   │   ├── voter-account-store.ts        # Account + user join queries
│   │   └── votes.repository.ts
│   └── queries/              # Cross-table / joined queries
│       ├── election.queries.ts
│       └── voting-state.queries.ts
├── handlers/                 # AppRouteHandler implementations (one file per resource)
│   ├── admin-stats/          # Dashboard stats (voter count, election turnout)
│   ├── audit-log/
│   ├── auth/                 # Register, login, logout, me
│   ├── candidates/           # CRUD + image upload/delete (B2 storage)
│   ├── elections/            # Election CRUD, positions, transitions, results, voting-state
│   ├── parties/              # Party list CRUD (in progress)
│   ├── profile/              # User profile + password updates
│   ├── users/                # Admin user management (soft/hard delete, restore, unlock)
│   └── votes/                # Vote submission + results
├── routes/                   # Hono router + createRoute() definitions
│   ├── admin-stats/          # /admin/stats
│   ├── audit-log/            # /audit-log (paginated, filterable)
│   ├── auth/                 # /register, /login, /logout, /me
│   ├── candidates/           # /candidates CRUD (admin-gated writes)
│   ├── elections/            # /elections (CRUD), /elections/current, /elections/state, /elections/:id/transitions, /elections/:id/results, /elections/:id/positions
│   ├── parties/              # /elections/:id/parties (in progress)
│   ├── profile/              # /me/profile, /me/password
│   ├── users/                # /users (admin-only)
│   ├── votes/                # /votes, /votes/me, /votes/results, /votes/candidates/:id/count
│   └── index.route.ts        # / -> "Hono API"
├── lib/
│   ├── ballot-caster.ts      # Atomic vote casting with db.batch (Result<T,E> pattern)
│   ├── b2-client.ts          # Backblaze B2 client (upload/download/delete candidate images)
│   ├── create-app.ts         # OpenAPIHono factory + middleware chain + createTestApp helper
│   ├── election-lifecycle.ts # Election state machine (draft→open→closed→archived) with TransitionError
│   ├── session.ts            # Session CRUD + cookie helpers (session_id, 7-day TTL)
│   ├── password.ts           # hashPassword / verifyPassword (PBKDF2 via Web Crypto)
│   ├── profanity.ts          # bad-words wrapper, used in profile updates
│   ├── errors.ts             # isUniqueConstraintError() detector
│   ├── candidate-lifecycle-coordinator.ts   # Candidate CRUD + avatar + audit
│   ├── election-lifecycle-coordinator.ts    # Election CRUD + transitions + audit
│   ├── position-lifecycle-coordinator.ts    # Position CRUD + audit
│   ├── user-lifecycle-coordinator.ts        # User CRUD + auth + bulk import + audit
│   ├── constants/            # Centralized ERROR_MESSAGES, AUDIT_ACTIONS
│   ├── types/                # AppBindings, AppOpenAPI, AppRouteHandler
│   ├── validation/           # booleanQuery for query strings
│   └── openapi-configuration.ts  # OpenAPI doc + Scalar reference UI setup
├── middleware/
│   ├── auth.ts               # requireAuth, requireAdmin
│   ├── env.ts                # parseEnv() Zod-validated process.env (for scripts, not Workers)
│   ├── env-validator.ts      # Validates env bindings on every request (skips in Vitest)
│   ├── rate-limit.ts         # Cloudflare Rate Limiting binding integration
│   ├── csrf.ts               # Same-origin validation for POST/PUT/PATCH/DELETE (CSRF)
│   ├── security-headers.ts   # nosniff, framing, Referrer-Policy, Permissions-Policy, report-only CSP, HSTS
│   ├── pino-logger.ts        # Request-id-aware Pino logger (primary logger for handlers)
│   ├── custom-logger.ts      # Lightweight timestamped console.warn logger (fallback/alternative)
│   └── utils/                # json-content, create-error-schema, on-error, not-found, serve-emoji-favicon
├── openapi/
│   ├── default-hook.ts       # Zod validation error hook (returns 422)
│   ├── http-status-codes.ts  # Named HTTP status constants (OK=200, CREATED=201, etc.)
├── scripts/ (standalone — not part of src)
│   ├── seed-admin.ts         # Seed admin account into Turso
│   ├── seed-superadmin.ts    # Seed super_admin account
│   ├── seed-voter.ts         # Seed test voter account
│   ├── import-students.ts    # Bulk import students from PDF/CSV
│   ├── verify-pragma-fk.ts   # PRAGMA foreign_keys verification (local)
│   ├── verify-migration-fk.ts # Migration FK behaviour (local)
│   ├── verify-turso-fk.ts    # PRAGMA + enforcement on live Turso
│   ├── verify-future-migration.ts # Reproduces NOT NULL ADD COLUMN failure
│   └── verify-real-fk.ts     # End-to-end FK exercise on Turso
└── worker-configuration.d.ts  # Auto-generated by pnpm cf-typegen — do not hand-edit
```

### Request Lifecycle

1. `createApp()` (`src/lib/create-app.ts:13`) sets up an `OpenAPIHono<AppBindings>` with: pino logger → CORS (`http://localhost:3001` only, `credentials: true`) → CSRF same-origin validation → security headers → emoji favicon → notFound/onError. Env is read from `c.env` (Worker bindings).
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
- **Unique-constraint handling** uses `isUniqueConstraintError()` (string-matches "UNIQUE constraint failed"). Registration has a pre-check _and_ this fallback to cover race conditions.
- **Timestamps:** all stored as integer Unix seconds via `unixepoch()` default. Handlers compute `Math.floor(Date.now() / 1000)` when setting timestamps manually.
- **Soft delete:** `accounts` use `deletedAt` integer (filtered via `isNull`); `candidates` use `isActive` 0/1.
- **Vote integrity:** unique indexes on `(userId, candidateId)` and `(userId, positionId, electionId)` enforce one-vote-per-position-per-election. Voting status is derived from `votes` table — no `hasVoted` flag on users.
- **Election model:** `elections` and `positions` are first-class tables. `elections_one_open_idx` is a partial unique index `WHERE status = 'open'` — at most one open election at a time. Positions are per-election, ordered by `displayOrder`.
- **Error/success messages** must come from `lib/constants/error-messages.ts` (see `lib/constants/README.md`). Don't inline ad-hoc strings.
- **Boolean query params** must use the `booleanQuery` helper from `lib/validation/boolean-query.ts` (Zod `z.coerce.boolean()` only treats empty string as false).
- **Auth checks:** Admin routes enforce authorization at the route definition seam via `withAdmin(...)` or route-level `requireAdmin` middleware. Any new admin mutation handler added to a router should be wrapped with `withAdmin(handler)` at the `router.openapi(...)` call site.
- **Hono `strict: false`** is set on the router so trailing slashes don't 404.
- **CORS** is hardcoded to `http://localhost:3001` with `credentials: true`. If you change the frontend dev port, update `lib/create-app.ts:27`.
- **CSRF** (`middleware/csrf.ts`, wired in `createApp`) rejects `POST/PUT/PATCH/DELETE` requests whose Origin (Referer as fallback) is neither the request's own origin, the dev frontend origin, nor an origin in the `ALLOWED_ORIGINS` binding (comma-separated env var, validated in `middleware/env.ts`). Requests without a parseable origin are rejected. Set `ALLOWED_ORIGINS` to your production origin(s) in `wrangler.jsonc` `vars` (or via secret/CI env) before deploy.

### Lifecycle Coordinators

Domain operations that span multiple repositories and must be atomic are encapsulated in **lifecycle coordinators** in `src/lib/`. Each coordinator handles CRUD + audit logging for a specific entity, wrapping everything in a transaction:

- `candidate-lifecycle-coordinator.ts` — create, update, deactivate, uploadAvatar, deleteAvatar
- `election-lifecycle-coordinator.ts` — create, updateMetadata, transition
- `position-lifecycle-coordinator.ts` — create, update, delete
- `user-lifecycle-coordinator.ts` — register, bulkImport, update, softDelete, restore, hardDelete, authenticate, logout, unlock

**Pattern:** Coordinators accept a `DbClient` (transaction handle) and `ActorInfo` (admin snapshot), perform validation + mutation + audit log insert inside a single transaction. They export typed error classes (`CandidateLifecycleError`, `PositionLifecycleError`, `UserLifecycleError`, `TransitionError`) with HTTP status codes. Handlers delegate to coordinators rather than calling repos directly.

**`ballot-caster.ts`** is a special case: it uses `db.batch()` (not `db.transaction()`) to atomically insert votes + ballot snapshot. It returns a `Result<T, E>` discriminated union instead of throwing.

### Rate Limiting

The backend uses **Cloudflare Rate Limiting** bindings for login protection. See `src/middleware/rate-limit.ts`:

- `createIpRateLimiter("LOGIN_IP_LIMITER")` — middleware that checks `c.env.LOGIN_IP_LIMITER.limit({ key: clientIp })`.
- The binding must be configured in `wrangler.jsonc` under `[[unsafe.bindings]]` with `type: "ratelimit"`.
- `RATE_LIMIT_PERIOD_SECONDS` must match the `period` field in the wrangler ratelimit config.
- Returns 429 with `Retry-After` header when exceeded.

### Login Attempt Tracking

Failed login attempts are tracked in the `login_attempts` table (via `login-attempt.repository.ts`) for account lockout:

- 5 failed attempts within 900 seconds triggers lockout.
- `user-lifecycle-coordinator.ts`'s `authenticate()` method uses constant-time hash verification even on locked/non-existent accounts to prevent timing attacks.
- `unlock` admin action clears attempts for a student.

### Admin Stats

`GET /admin/stats` (`routes/admin-stats/routes.ts`, handler in `handlers/admin-stats/admin-stats.handler.ts`) returns aggregated dashboard data: voter count, election count, active election with turnout percentage, and last 5 audit log entries.

### Party Lists (in progress)

A new feature for organizing candidates into parties within an election. Currently staged but not yet fully wired:

- `database/repositories/party-list.repository.ts` — CRUD operations for the `party_lists` table
- `handlers/parties/parties.handler.ts` — Route handlers for party list management
- `routes/parties/parties.routes.ts` — OpenAPI route definitions
- `routes/parties/index.ts` — Router mounting
- Candidates can be assigned to a party via the `partyId` foreign key on the `candidates` table
- New audit actions: `party.create`, `party.update`, `party.delete` (add to `audit-actions.ts` when feature ships)

### Auth & Sessions

- `session_id` cookie: `Path=/; HttpOnly; SameSite=Lax; Expires=…; Secure` — `Secure` is emitted unconditionally when `NODE_ENV === 'production'` (regardless of request protocol) and whenever the request is HTTPS; only omitted in dev over plain HTTP.
- Session TTL: 7 days (`SESSION_DURATION_DAYS` in `lib/session.ts:6`).
- `requireAuth` returns 401 with `{ message: 'Unauthorized' }` if cookie missing, and `{ message: 'Session expired or invalid' }` if lookup fails.
- The session lookup joins `accounts` and filters out soft-deleted accounts (`isNull(accounts.deletedAt)`).
- Login is by **student number + password** (`studentId`, not username or email). Register accepts email optionally.
- On successful login, password hashes stored in the legacy `salt$hash` format (or any versioned hash below 600k iterations) are rehashed with the current policy (see `needsRehash` in `lib/password.ts`). The dummy hash used for non-existent/locked accounts is also current-cost.
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

### Audit log

Append-only audit trail of admin write actions, captured by every admin mutation handler. Source: `apps/backend/src/database/schema.ts` (Drizzle table def), repository at `apps/backend/src/database/repositories/audit-log.repository.ts`, action vocabulary at `apps/backend/src/lib/constants/audit-actions.ts`.

#### Schema

Table `audit_log` (`schema.ts:160`):

| Column                      | Type                   | Purpose                                                     |
| --------------------------- | ---------------------- | ----------------------------------------------------------- |
| `id`                        | text PK (uuid)         | Row identifier (`crypto.randomUUID()`)                      |
| `created_at`                | integer (unix seconds) | When the action happened (`unixepoch()` default)            |
| `action`                    | text                   | Dotted enum (see vocabulary below)                          |
| `target_type`               | text                   | One of `election` / `position` / `candidate` / `user`       |
| `target_id`                 | text                   | UUID of the affected resource                               |
| `actor_account_id_snapshot` | text                   | Denormalised `accounts.id` of the actor at write time       |
| `actor_username_snapshot`   | text                   | Denormalised `accounts.username` of the actor at write time |
| `description`               | text (nullable)        | Free-form context (e.g. `draft → open` for transitions)     |

Indexes:

- `(created_at DESC, id DESC)` (`idx_audit_log_created_at_id_desc`) — cursor pagination
- `(target_type, target_id)` (`idx_audit_log_target_type_target_id`) — per-resource audit queries
- `(actor_account_id_snapshot)` (`idx_audit_log_actor_account_id_snapshot`) — "what did this admin do"
- `(action)` (`idx_audit_log_action`) — filtering by action type

Invariant test: `apps/backend/src/database/schema-names.test.ts` (`describe("audit_log schema")`) asserts the Drizzle table exposes the 8 expected columns, the OpenAPI `AuditLogEntrySchema` mirrors them 1:1 in camelCase, `AuditLogListResponse` exposes exactly `items` + `nextCursor`, and every value in `AUDIT_ACTIONS` round-trips through the OpenAPI `action` field.

#### Action vocabulary

16 actions, organised by resource. Source of truth: `apps/backend/src/lib/constants/audit-actions.ts` — `AUDIT_ACTIONS` (Zod enum) is the same validator used by the write path (`auditLogRepo.insert`) and the read filter (`GET /audit-log?action=…`).

```
election.create          — admin creates a new election
election.update          — admin updates election metadata (name, dates)
election.transition      — admin changes election status (draft→open, open→closed, closed→archived, etc.)
position.create          — admin adds a position to an election
position.update          — admin modifies a position (name, displayOrder)
position.delete          — admin removes a position from an election
candidate.create         — admin adds a candidate to a position
candidate.update         — admin modifies a candidate (name, description, image)
candidate.deactivate     — admin soft-deletes a candidate (sets isActive=0)
user.create              — admin creates a single user account
user.update              — admin modifies a user's account fields
user.bulk_import         — admin bulk imports voter accounts
user.soft_delete         — admin soft-deletes a user (sets deletedAt)
user.restore             — admin restores a soft-deleted user
user.hard_delete         — admin permanently purges a user account
user.unlock              — admin resets a voter account lockout status
```

#### Read API endpoints (admin-only)

| Method | Path                                         | Description                                                                                                                                                                                                                          |
| ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/audit-log`                                 | Global paginated list. Query filters: `actorId`, `action`, `targetType`, `targetId`, `since`, `until`. Cursor params: `cursor` (composite `createdAt:id` base64url), `limit` (default 50, max 200). Returns `{ items, nextCursor }`. |
| `GET`  | `/elections/:id/audit`                       | Entries whose target is this election.                                                                                                                                                                                               |
| `GET`  | `/elections/:id/positions/:positionId/audit` | Entries whose target is this position.                                                                                                                                                                                               |
| `GET`  | `/candidates/:id/audit`                      | Entries whose target is this candidate.                                                                                                                                                                                              |
| `GET`  | `/users/:id/audit`                           | Entries whose target is this user.                                                                                                                                                                                                   |

All five endpoints are admin-only. Auth uses the in-handler `c.var.authUser?.role !== "admin"` guard (mirroring the elections handler pattern). Two reasons for in-handler rather than middleware:

- Hono's typed `.openapi(routeDef, middleware, handler)` overloads don't accept this 3-arg shape cleanly (TS2345).
- `router.use("/audit-log/*", requireAdmin)` hits the Workers runtime prefix-match bug documented at `routes/elections/index.ts:50`.

#### Convention: writing audit rows from new admin handlers

> **Every new admin mutation handler MUST write one `audit_log` row before returning success.** The row must capture `actorAccountIdSnapshot` and `actorUsernameSnapshot` from `c.var.authUser` BEFORE the mutation runs (so the snapshot reflects the actor at the time of action, not after any account changes). Use `description` for free-form context (e.g. transition states for `election.transition`). The audit insert must happen AFTER the mutation succeeds and BEFORE `c.json(...)` returns — failed mutations must NOT leave an audit row. **There is no try/catch around the audit insert** — failures surface as 500 (honest, visible).

#### See also

- `apps/backend/src/database/schema.ts` — Drizzle table def (`auditLog`)
- `apps/backend/src/database/repositories/audit-log.repository.ts` — repo (`auditLogRepo.insert`, paginated queries)
- `apps/backend/src/lib/constants/audit-actions.ts` — `AUDIT_ACTIONS` and `TARGET_TYPES` Zod enums
- `apps/backend/src/database/openapi-schemas.ts` — `AuditLogEntrySchema` and `AuditLogListResponse`
- `apps/backend/src/handlers/audit-log/audit-log.handler.ts` — read API handlers
- `apps/backend/src/routes/audit-log/` — `/audit-log` route defs (`routes.ts`, `index.ts`)
- `apps/backend/src/routes/elections/audit.routes.ts`, `routes/candidates/audit.routes.ts`, `routes/users/audit.routes.ts` — per-resource audit sub-routes

### Voting State Composite Endpoint

`GET /elections/state` (`/elections/state` route, handler in `handlers/elections/voting-state.handler.ts`) returns a composite response:

```typescript
interface VotingState {
  open: ElectionRow | null; // Current open election (if any)
  nextDraft: { id; name; opensAt; closesAt } | null; // Earliest upcoming draft
  lastClosed: { id; name; closesAt; results } | null; // Latest closed with results
  myVotes: { electionId; votes: Array<{ candidateId; positionId }> }; // User's votes in current open election
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
- **Lifecycle coordinators** have their own test files (e.g. `candidate-lifecycle-coordinator.test.ts`) that test transaction behavior with mocked DB.
- **`FakeBallotCaster`** in `ballot-caster.ts` can be used to test voting flows without hitting the real casting logic.
- **Always run the test suite after schema/handler changes** — DB-level invariants in `schema-names.test.ts` catch schema/API drift.

### Things to be careful about

- **CORS allowlist** is `http://localhost:3001`. The frontend's Vite dev port is set in `apps/frontend/package.json` (`vite dev --port 3001`). Keep these in sync if you change either.
- **Path alias** `@/` is configured in both `tsconfig.json` and `vitest.config.ts` (via `vite-tsconfig-paths`). Don't import via deep relative paths; use the alias.
- **`worker-configuration.d.ts`** is auto-generated by `pnpm cf-typegen` (Wrangler). Don't hand-edit.
- **Don't commit** `.env` / `.dev.vars` — gitignored. Required keys for Turso migrations: `TURSO_DATABASE_URL` (and `TURSO_AUTH_TOKEN` for remote). For local dev, `wrangler dev` reads from `.dev.vars` or `.env`. For local libSQL without Turso, set `TURSO_DATABASE_URL=file:./local.db` (SQLite file).
- **`NODE_ENV`, `LOG_LEVEL`, `TURSO_DATABASE_URL`** are set in `wrangler.jsonc` `vars` (development defaults). Production overrides go via `wrangler secret` / environment. **`TURSO_AUTH_TOKEN` must be set as a secret in production** — do not put it in `wrangler.jsonc` `vars`.
- **B2 object storage** requires three secrets for production: `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`. The `B2_PUBLIC_BASE_URL` and `B2_PUBLIC_ACCESS` are set in `wrangler.jsonc` `vars`. Candidate images are stored at `candidates/{candidateId}/{uuid}.{ext}`.
- **The `env.ts` middleware** (`src/middleware/env.ts`) is for standalone scripts (like `seed-admin.ts`), not for Worker request handlers — Workers read env from `c.env`.
- **`seed-admin.ts`** (`apps/backend/scripts/seed-admin.ts`) is a standalone script for seeding the first admin account. Run with `tsx` from the `apps/backend` directory. It reads `.env` for Turso credentials and calls `parseEnv(process.env)` — it's not part of the Worker.

## Frontend (`apps/frontend`) — SvelteKit (Active)

### Stack

- **SvelteKit 2** + **Svelte 5** (runes mode with `$props()`, `$state()`)
- **Routing:** SvelteKit file-based routing with layout groups `(public)`, `(protected)`, `(admin)`
- **Data:** SvelteKit `fetch` with cookie-based auth (session cookie `session_id`)
- **UI:** Tailwind 4 via `@tailwindcss/vite` plugin; `lucide-svelte` (icons)
- **Auth:** Session cookie based, with `authStore` writable store
- **Build output:** Built as static SPA via `@sveltejs/adapter-static` (outputs to `dist/`)
- **Typecheck:** `svelte-check` (via `pnpm check`)
- **Tests:** Vitest 3 (`pnpm test` runs `vitest run`; tests in `src/lib/**/*.test.ts`)
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
│   │   ├── audit-log.ts     # Audit log API (admin-only)
│   │   ├── elections.ts     # Election CRUD, transitions, positions
│   │   ├── candidates.ts    # Candidate list/create/update
│   │   ├── votes.ts         # Vote submission + results
│   │   ├── users.ts         # User management (admin)
│   │   ├── positions.ts     # Position CRUD
│   │   └── profile.ts       # Profile update
│   ├── cache/                # Svelte 5 runes-based cache store (single AppCache singleton)
│   │   ├── index.ts         # Builds productionApi adapter + exports the `appCache` singleton
│   │   ├── app-cache.svelte.ts   # AppCache: `get(resource, params)` → CacheEntry; `invalidate({resource, params})`
│   │   ├── cache-entry.svelte.ts # Generic CacheEntry<T> with $state, epoch-based invalidation
│   │   └── api-client.ts    # ApiClientAdapter interface (typed fetchers per resource)
│   ├── types.ts              # Type definitions
│   ├── routeGuards.ts        # Pure redirect decision functions
│   ├── userRegistration.ts   # Registration validation + mutation helpers
│   ├── election-lifecycle-client.ts # Client-side election state helpers
│   ├── voting-page-state.ts  # Voting page state machine
│   ├── voting-stepper-logic.ts # Voting stepper logic
│   ├── vote-count-utils.ts   # Vote count formatting
│   ├── mutation-feedback-utils.ts # Error extraction helpers
│   └── components/ui/        # Reusable UI components (Header, candidate-card, modal, skeleton-*, etc.)
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
- **Cache store** (`lib/cache/`): Svelte 5 runes-based caching layer with a single `appCache` singleton (exported from `index.ts`). Access a resource via `appCache.get(resource, params)` which returns a `CacheEntry<T>` — `resource` is one of `elections`, `election`, `votingState`, `positions`, `candidates`, `results`, `users`, and `params` are serialized into the cache key. `CacheEntry<T>` wraps a fetcher with `$state` reactivity, epoch-based invalidation (discards in-flight results), and no automatic TTL. After any mutation, call `appCache.invalidate({ resource, params })` (or `appCache.invalidate()` to wipe everything) so a stale value can't resurface — caches live for the browser tab lifetime.

### Testing

- Uses **Vitest** (`pnpm test` runs `vitest run`).
- Test files are in `src/lib/**/*.test.ts` alongside their modules (e.g. `routeGuards.test.ts`, `userRegistration.test.ts`, `voting-page-state.test.ts`, `voting-stepper-logic.test.ts`, `vote-count-utils.test.ts`, `adminUsers.test.ts`).
- Typecheck runs via `svelte-check` (`pnpm check`), not `tsc`.

### Things to be careful about

- **`PUBLIC_API_BASE_URL`** env variable must be set to `http://localhost:8787` in `.env`.
- **Port 3001** — frontend dev server runs on port 3001 (configured in `package.json` as `vite dev --port 3001`). CORS on the backend allows `http://localhost:3001`.
- **Favicon reference** in `app.html` points to `favicon.svg` (ensure the file exists in `static/`).
- **`@sveltejs/adapter-static`** with SPA fallback (`fallback: "404.html"`). The backend serves this output as Cloudflare Assets in production.
- **Session cookie**: Same as backend conventions (HttpOnly, SameSite=Lax).
- **`CacheEntry.fetch()` never rejects.** On a failed fetch it resolves `null` and records the message in `entry.error` (see `cache-entry.svelte.ts`); the promise is never rejected. So `await entry.fetch()` never throws, and any `.catch()`/try-catch around it is unreachable. The correct consumer pattern is `const result = await entry.fetch(); if (result) { /* use result */ } else { usersError = entry.error ?? 'Failed to load' }`. `add-candidate-modal.svelte`'s `loadUsers()` is the reference example — do NOT rely on try/catch to surface cache load failures.
- **`/users` pagination is capped at `limit=100`** (backend `ListUsersQuerySchema.max(100)`). `fetchUsers` in `lib/api/users.ts` defaults to `limit: 100`. The backend OpenAPI hook returns **422** for `limit > 100` before the repository is queried, so a higher request limit silently fails the whole list call rather than truncating — keep admin user-list requests at 100.

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

## E2E Testing (`apps/e2e`)

### Stack

- **Playwright** for browser automation
- **TypeScript** compiled by Playwright
- **Vitest-style** fixtures for DB setup

### Running E2E Tests

```bash
cd apps/e2e
pnpm test           # Run all tests (starts backend + frontend automatically)
pnpm test:ui        # Run with Playwright UI
pnpm test:headed    # Run in headed mode (visible browser)
```

### Architecture

```
apps/e2e/
├── playwright.config.ts     # Config: auto-starts backend (8787) + frontend (3001)
├── fixtures/
│   ├── db-setup.ts          # Seeds TEST_USERS and active election
│   └── page-objects/        # Page Object Models for clean test abstractions
│       ├── LoginPage.ts
│       ├── VotingPage.ts
│       └── AdminElectionsPage.ts
└── tests/
    ├── global-setup.ts      # Seeds test DB
    ├── auth/                # Login, session management
    ├── voter/               # Voting flow, UI interactions
    └── admin/               # Election lifecycle, RBAC, user archiving
```

### Conventions

- **Global setup** (`tests/global-setup.ts`) runs first and seeds the database with test users and an active election.
- **Page Objects** in `fixtures/page-objects/` encapsulate selectors and interactions.
- **`webServer` config** in `playwright.config.ts` auto-starts both apps; `reuseExistingServer: !process.env.CI` allows reusing running dev servers locally.
- **Serial execution** by default (`fullyParallel: false`, `workers: 1`). Enable `FULL_MATRIX=true` for cross-browser testing (firefox, webkit).
- **Tests run against the real frontend** (port 3001), not the backend directly.

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

## OpenSpec Workflow

The project uses an [OpenSpec](https://github.com/nicholasgasior/openspec)-style spec-driven workflow for feature development. Specs and change proposals live in `openspec/`.

### Structure

```
openspec/
├── config.yaml              # Schema: spec-driven
├── changes/                 # Active + archived changes
│   ├── archive/             # Completed changes
│   └── <change-name>/       # One directory per change
│       ├── .openspec.yaml   # Change metadata
│       ├── proposal.md      # What and why
│       ├── design.md        # How (architecture decisions)
│       ├── tasks.md         # Implementation checklist
│       └── specs/           # Delta specs (what changes per entity)
└── specs/                   # Main specs (source of truth, synced from delta specs)
```

### Workflow commands

OpenSpec is managed via agent skills in `.augment/skills/` and `.agent/skills/`. Key operations:

- **Explore** (`opsx-explore`): Think through ideas and investigate problems before proposing changes.
- **Propose** (`opsx-propose`): Create a new change with proposal, design, tasks, and delta specs.
- **Apply** (`opsx-apply`): Implement tasks from an active change, working through the task list.
- **Sync** (`opsx-sync`): Sync delta specs from a change into main specs (`openspec/specs/`).
- **Archive** (`opsx-archive`): Archive a completed change after implementation is done.

### Conventions

- Changes are named descriptively (e.g., `2026-06-30-cache-store-implementation`).
- Each change has a delta spec per affected entity in `specs/`.
- Main specs in `openspec/specs/` are the source of truth after sync.
- Plans in `docs/superpowers/plans/` complement OpenSpec changes.
