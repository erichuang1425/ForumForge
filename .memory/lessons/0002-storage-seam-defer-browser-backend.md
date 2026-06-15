# Storage is an async StorageBackend seam; defer the chrome.storage backend until the extension exists

**Type:** confirmed-approach
**Date:** 2026-06-15

`@forumforge/storage` is the Phase 0 "local storage layer." It ships the
**contract**, not a browser backend:

- `StorageBackend` — a minimal async `get`/`set`/`remove`/`keys` key/value
  interface. It is async because the real backends (`chrome.storage.local`,
  IndexedDB) are. Feature code depends only on this interface, so the persistent
  backend slots in later without touching features.
- `MemoryStorageBackend` — a real, unit-tested in-memory implementation for
  tests, non-browser callers, and as a default fallback. It **clones values in
  and out** (structuredClone, JSON fallback) so stored state can't be mutated
  through a caller's reference — the same isolation a serializing backend gives.
- `Collection<T>` — a typed, namespaced set of records keyed by id over any
  backend. A backend is ONE flat key space shared by every feature, so each
  collection prefixes keys as `<namespace>:<id>` to keep categories (saved posts,
  notes, read history, settings) from colliding. Use simple namespaces (no
  colons); ids may contain anything.

**Why no `chrome.storage` backend yet:** it needs a browser to verify
meaningfully, and writing it now would be a shallow stub — which AGENTS.md
forbids. Same discipline as the parser PR. Build it when the extension app
(which needs a bundler + browser) lands, alongside the per-feature stores
(saved comments, notes) that are Phase 1, not Phase 0.

**Gotcha:** `Promise.all(ids.map(id => get(id)))` over an unconstrained generic
`T` makes tsc widen to `Awaited<T> | undefined` and a `record is T` filter then
fails to typecheck. Derive `values()` from `entries()` (whose inner value is cast
to `[string, T | undefined]`) instead of filtering a bare `Promise.all` result.
