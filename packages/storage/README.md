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

## Extension storage format

The extension's current schema version is **1**. It prepares storage before any
feature read or write in
[`apps/extension/src/storageSchema.ts`](../../apps/extension/src/storageSchema.ts).

Three operational records coordinate the lifecycle. They contain no forum
content, saved post, read history, or note:

| Key | Stored value and purpose |
| --- | --- |
| `forumforge:storageSchemaVersion` | Non-negative integer; `1` after preparation |
| `forumforge:storageGeneration` | Non-negative lifecycle epoch: even is stable, odd is clearing, and absence means stable epoch `0` before the first clear |
| `forumforge:storageClearState` | `{ generation: number, status: "clearing" \| "failed" }`; transient on success and retained after failure until retry |

Schema 1 keeps the original pre-release keys and record shapes:

| Key | Stored record |
| --- | --- |
| `readHistory:<threadKey>` | `{ seenIds: string[], lastVisitedAt: string }` |
| `saved:<threadKey> <postId>` | `{ threadKey, threadUrl, threadTitle?, savedAt, post: ForumForgePost }` |
| `userNotes:<origin> <author>` | `{ origin, author, note, updatedAt }` |

`threadKey` is the normalized page URL from
[`readHistory.ts`](../../apps/extension/src/readHistory.ts): ordinary post
fragments are dropped, client-side route fragments and query strings are kept.
Notes use the full URL origin. Timestamps are ISO strings. The saved `post` is a
snapshot using the
[`ForumForgePost`](../core/src/post.ts) shape at save time.

### Version and migration rules

- No version marker means schema 0: the unversioned baseline that existed at
  commit `91fc205`. The 0-to-1 migration adopts all three record categories
  without changing their keys or values.
- Migrations are deterministic and idempotent. A step finishes its record work
  before writing the next numeric version marker, so interruption leaves the
  prior version and a retry is safe.
- Invalid metadata and versions newer than this build fail closed. ForumForge
  does not delete, guess at, or downgrade those records; extraction can still
  operate read-only and the user can explicitly clear local data.
- Feature reads/writes and deletion share an extension-origin
  [Web Lock](https://www.w3.org/TR/web-locks/), so a clear waits for storage
  work already running in another side-panel document. A clear publishes an odd
  epoch before deletion and a new even epoch only after finalization. The epoch
  captured before lock acquisition rejects work queued across a clear, while
  the clear-state record blocks new work during deletion and after failure.
- Non-ForumForge keys are never migrated. Future ForumForge records must use the
  `forumforge:` prefix and add a documented, tested migration when their shape
  changes.

### Clear-data ownership

The in-product clear action is allowlisted to the three legacy prefixes above
and non-operational `forumforge:` records. It never calls
`chrome.storage.local.clear()`. A confirmed clear publishes the next odd epoch
as `clearing`, removes every user-data key it can, normalizes the schema marker
to `1`, publishes a new even epoch, and then removes the clear-state record. The
schema and generation records remain so open panels cannot resume against an
ambiguous lifecycle. Unrelated keys are preserved.

If the initial clear-state guard cannot be stored, deletion does not start.
Otherwise every user-data removal is attempted. If any removal or finalization
step fails, the action reports failure and retains a blocking clear state
(normally marked `failed`; still `clearing` if even failure-status persistence
is unavailable). All feature writes remain blocked until an explicit retry
succeeds. Other open panels listen to `chrome.storage.onChanged`, disable stale
persistence controls during clearing or failure, and reset rendered
New/Saved/note state when the clear-state record is removed. The two-window
behavior still requires the real-Chrome release check below.

Real-Chrome upgrade and deletion evidence remains a release gate in
[`docs/TESTING.md`](../../docs/TESTING.md); the deterministic fake-backend tests
do not substitute for it.

## Develop

From the repository root:

```bash
pnpm --filter @forumforge/storage test
pnpm typecheck
pnpm verify
```

This package has no runtime dependencies.
