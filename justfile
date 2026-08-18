# OCSVS task runner. Run `just` with no args to list recipes.
# Most recipes delegate to existing pnpm scripts in package.json.
set shell := ["bash", "-c"]

# Show available recipes
default:
    @just --list

# Install all workspace deps
install:
    pnpm install

# Run both apps in parallel (frontend + backend)
dev:
    pnpm dev

# Run frontend only (SvelteKit on port 3001)
dev-fe:
    pnpm dev:frontend

# Run backend only (wrangler dev on port 8787)
dev-be:
    pnpm dev:backend

# Run both apps against the local Turso dev server without external services
dev-offline:
    pnpm dev:offline

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

# Run all tests (unit + integration)
test:
    pnpm test

# Run E2E tests via Playwright
test-e2e:
    pnpm test:e2e

# Build production frontend assets
build:
    pnpm build

# Build frontend only
build-fe:
    pnpm build:frontend

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

# Bulk import students from a PDF file
db-import-students pdf_path *args="":
    pnpm --filter @cso-voting/backend db:import-students "{{absolute_path(pdf_path)}}" {{args}}

# Deploy backend to Cloudflare Workers (wrangler deploy --minify)
deploy:
    cd apps/backend && pnpm deploy

# Remove build artifacts (dist/, .svelte-kit/, .wrangler/)
clean:
    pnpm -r clean
