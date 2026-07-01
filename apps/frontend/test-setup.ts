// Polyfill Svelte 5 runes so `.svelte.ts` files can be imported by tsx
// in plain node tests. The Svelte compiler normally transforms `$state(x)` etc.
// into runtime calls; here we stub them as identity functions so class-field
// initializers like `data = $state(null)` evaluate to plain values. The tests
// observe final values via direct property reads, never reactivity, so the
// polyfill is sufficient.

const identity = <T>(initial: T): T => initial;

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
