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

**The `chrome.storage` backend now exists** — but in the extension, not this
package. `apps/extension/src/storage.ts` implements `StorageBackend` over
`chrome.storage.local`, landed with the first feature that needed persistence
("new posts since last visit"). Keeping the browser backend in the extension
keeps `@forumforge/storage` runtime-dependency-free and browser-agnostic; the
backing `StorageArea` is injected, so it's unit-tested with a fake area (no real
browser needed). The deferral was about not stubbing ahead of a consumer, not
about where it ultimately lives.

**Gotcha:** `Promise.all(ids.map(id => get(id)))` over an unconstrained generic
`T` makes tsc widen to `Awaited<T> | undefined` and a `record is T` filter then
fails to typecheck. Derive `values()` from `entries()` (whose inner value is cast
to `[string, T | undefined]`) instead of filtering a bare `Promise.all` result.
