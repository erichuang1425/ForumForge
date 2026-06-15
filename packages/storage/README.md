# @forumforge/storage

ForumForge's **local-first storage layer**: the on-device key/value seam that
features persist to. Everything ForumForge keeps — read history, saved posts,
local notes and tags, per-site settings, installed adapters — stays on the
user's own device by default (see [docs/PRIVACY.md](../../docs/PRIVACY.md)).

This package defines the storage **contract** and a working in-memory backend.
It deliberately does **not** include a `chrome.storage` / IndexedDB backend yet:
those need a browser to verify meaningfully, and the whole point of the seam is
that they slot in later without feature code changing. Built only when there is
real, testable work for it — no placeholder scaffolding (see
[AGENTS.md](../../AGENTS.md)).

## Exports

- `StorageBackend` — the minimal async key/value contract (`get` / `set` /
  `remove` / `keys`). The shipped extension implements this with
  `chrome.storage.local` (or IndexedDB for larger data); the rest of the app
  depends only on this interface.
- `MemoryStorageBackend` — an in-memory `StorageBackend` for tests, non-browser
  callers, and as a default fallback. Values are cloned in and out, so stored
  state can't be mutated through a caller's reference.
- `Collection<T>` — a typed, namespaced set of records keyed by id, layered over
  any backend. Because a backend is one flat key space shared by every feature,
  each collection prefixes its keys (`<namespace>:<id>`) so categories don't
  collide. Construct one per category, e.g. `new Collection(backend, "saved")`.

## Example

```ts
import { MemoryStorageBackend, Collection } from "@forumforge/storage";

const backend = new MemoryStorageBackend(); // swapped for chrome.storage later
const saved = new Collection(backend, "saved");

await saved.set(post.id, post);
const all = await saved.values();
```

## Develop

From the repo root: `pnpm test` runs the suite, `pnpm typecheck` type-checks all
packages. This package has no runtime dependencies.
