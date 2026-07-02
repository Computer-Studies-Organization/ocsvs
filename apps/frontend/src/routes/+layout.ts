// This app is intentionally SPA-only. The cache layer in `src/lib/cache/`
// holds a tab-scoped module-level singleton (`appCache`) that is populated by
// universal load functions and mutated by Svelte 5
// runes. Keeping the module-level state alive across navigations requires
// the layout (and therefore every route) to run on a single client-side
// runtime. SSR would either re-instantiate the caches per request (defeating
// the purpose) or require a per-request cache plumbing layer that the rest
// of the codebase does not need. No SSR-time auth checks are performed —
// the root +layout.svelte already initialises `authStore` from `/me` inside
// `onMount`, which is client-only.
export const ssr = false;
export const prerender = false;
