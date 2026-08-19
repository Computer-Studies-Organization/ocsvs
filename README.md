# OCSVS

The Computer Studies Organization's voting platform: a SvelteKit 2/Svelte 5 frontend backed by a Hono API on Cloudflare Workers and Turso/libSQL.

## Development

Requires Node.js 20.16–20.x or 22.3+ and pnpm 9+.

```bash
pnpm install
pnpm dev
```

The frontend runs on port 3001 and the Worker API on port 8787.

For development without remote Turso, Turnstile, B2, Google Fonts, or Sentry:

```bash
pnpm dev:offline
```

This starts or reuses `turso dev` on `http://127.0.0.1:8080`, applies offline migrations, and uses process-local candidate images. See [ONBOARDING.md](./ONBOARDING.md) for prerequisites and E2E commands.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

See [ONBOARDING.md](./ONBOARDING.md) for environment setup, database commands, end-to-end tests, and deployment.
