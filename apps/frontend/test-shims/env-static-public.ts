/**
 * Test-time stub for SvelteKit's virtual `$env/static/public` module.
 *
 * SvelteKit's Vite plugin resolves `$env/*` to inlined string literals at
 * build time, so this file is never bundled into production output. The
 * `tsx` loader used by the test runner does not have access to SvelteKit's
 * virtual modules, so we provide a runtime value here.
 *
 * The mapping is declared in `apps/frontend/tsconfig.json` under
 * `compilerOptions.paths`. SvelteKit's Vite plugin handles `$env/*`
 * resolution before tsconfig paths are consulted, so production builds
 * remain unaffected.
 */
export const PUBLIC_API_BASE_URL = process.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787";
