# @forumforge/storage

ForumForge's local-first storage layer: a small asynchronous key/value contract
that keeps feature logic independent from a specific browser backend.

The current extension stores three data categories on-device:

- per-thread read history;
- saved-post snapshots and source metadata;
- private per-author notes scoped to a forum origin.

The extension implements `StorageBackend` with `chrome.storage.local` in
[`apps/extension/src/storage.ts`](../../apps/extension/src/storage.ts). No
IndexedDB, sync, remote backend, tags, per-site settings, or installed-adapter
records ship today. See [docs/PRIVACY.md](../../docs/PRIVACY.md).

## Exports

- `StorageBackend` — minimal async `get`, `set`, `remove`, and `keys`
  operations.
- `MemoryStorageBackend` — cloned in-memory values for deterministic tests and
  non-browser callers.
- `Collection<T>` — typed records in a namespaced flat key space, using
  `<namespace>:<id>` keys so features do not collide.

## Example

```ts
import { Collection, MemoryStorageBackend } from "@forumforge/storage";

const backend = new MemoryStorageBackend();
const saved = new Collection(backend, "saved");

await saved.set(post.id, post);
const all = await saved.values();
```

Production extension features receive the Chrome-backed implementation through
the same interface.

## Compatibility and migrations

The current pre-release records are unversioned. Schema versioning, migration
tests, upgrade preservation, and an in-product bulk clear control are tracked in
[#14](https://github.com/erichuang1425/ForumForge/issues/14) and must be resolved
before v0.1.

## Develop

From the repository root:

```bash
pnpm --filter @forumforge/storage test
pnpm typecheck
pnpm verify
```

This package has no runtime dependencies.
