# OCSVS

The Computer Studies Organization's voting platform: a SvelteKit 2/Svelte 5 frontend backed by a Hono API on Cloudflare Workers and Turso/libSQL.

## Development

Requires Node.js 20.16–20.x or 22.3+ and pnpm 9+.

```bash
pnpm install
pnpm dev
```

The frontend runs on port 3001 and the Worker API on port 8787.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

See [ONBOARDING.md](./ONBOARDING.md) for environment setup, database commands, end-to-end tests, and deployment.
