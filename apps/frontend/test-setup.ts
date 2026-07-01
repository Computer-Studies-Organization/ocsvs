// Polyfill Svelte 5 runes so `.svelte.ts` files can be imported by tsx
// in plain node tests. The Svelte compiler normally transforms `$state(x)` etc.
// into runtime calls; here we stub them as identity functions so class-field
// initializers like `data = $state(null)` evaluate to plain values. The tests
// observe final values via direct property reads, never reactivity, so the
// polyfill is sufficient.

const identity = <T>(initial: T): T => initial;

// Test-time base URL for `$env/static/public`. SvelteKit's Vite plugin
// resolves `$env/*` to inlined values at build time, but `tsx` does not —
// it falls back to the `paths` entry in tsconfig.json that points at
// `./test-shims/env-static-public.ts`, which reads from this env var.
// Setting it here (in --import order) ensures the shim picks up the test
// value before any test code or import resolves the module.
process.env.PUBLIC_API_BASE_URL ??= "http://test.local";

(globalThis as Record<string, unknown>).$state = identity;
(globalThis as Record<string, unknown>).$derived = identity;
(globalThis as Record<string, unknown>).$bindable = identity;
(globalThis as Record<string, unknown>).$effect = () => {};
(globalThis as Record<string, unknown>).$effect.pre = () => {};
(globalThis as Record<string, unknown>).$effect.root = () => {};
(globalThis as Record<string, unknown>).$props = () => ({});
(globalThis as Record<string, unknown>).$inspect = () => {};
(globalThis as Record<string, unknown>).$state.raw = identity;
(globalThis as Record<string, unknown>).$state.snapshot = (v: unknown) => v;
(globalThis as Record<string, unknown>).$state.eager = identity;
