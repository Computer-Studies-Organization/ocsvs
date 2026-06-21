# OCSVS task runner. Run `just` with no args to list recipes.
# Most recipes delegate to existing pnpm scripts in package.json.

set shell := ["bash", "-c"]

# Show available recipes
default:
    @just --list

# ----- Install ---------------------------------------------------------------

# Install all workspace dependencies
install:
    pnpm install

# ----- Dev -------------------------------------------------------------------

# Run both apps in parallel (frontend + backend)
dev:
    pnpm dev

# Run frontend only (SvelteKit on port 3001)
dev-fe:
    pnpm dev:frontend

# Run backend only (wrangler dev on port 8787)
dev-be:
    pnpm dev:backend

# ----- Quality ---------------------------------------------------------------

# Run typecheck, lint, and test (matches CI order)
check: typecheck lint test

# Typecheck all workspaces
typecheck:
    pnpm typecheck

# Lint all workspaces
lint:
    pnpm lint

# Auto-fix lint issues across all workspaces
lint-fix:
    pnpm -r lint:fix

# Run all tests
test:
    pnpm test

# ----- Build -----------------------------------------------------------------

# Build all workspaces
build:
    pnpm build

# Build frontend only
build-fe:
    pnpm build:frontend

# Build backend only
build-be:
    pnpm build:backend

# ----- Database (backend) ----------------------------------------------------

# Generate a new Drizzle migration from schema changes
db-generate:
    cd apps/backend && pnpm db:generate

# Apply pending migrations to Turso
db-migrate:
    cd apps/backend && pnpm db:migrate

# Push schema directly without migrations (dev only)
db-push:
    cd apps/backend && pnpm db:push

# Open Drizzle Studio
db-studio:
    cd apps/backend && pnpm db:studio

# Regenerate CloudflareBindings types from wrangler.jsonc
cf-typegen:
    cd apps/backend && pnpm cf-typegen

# ----- Deploy ----------------------------------------------------------------

# Deploy backend to Cloudflare Workers (wrangler deploy --minify)
deploy:
    cd apps/backend && pnpm deploy

# ----- Clean -----------------------------------------------------------------

# Remove build artifacts (dist/, .svelte-kit/, .wrangler/)
clean:
    pnpm -r clean
