/**
 * The local-first storage seam.
 *
 * Everything ForumForge persists — read history, saved posts, local notes and
 * tags, per-site settings, installed adapters — is keyed data that lives on the
 * user's own device by default (see docs/PRIVACY.md). A `StorageBackend` is the
 * minimal async key/value contract those features build on.
 *
 * Keeping the contract this small is deliberate: the shipped extension will back
 * it with `chrome.storage.local` (or IndexedDB for larger data) without any of
 * the feature code changing, while tests and non-browser callers use
 * `MemoryStorageBackend`. The methods are async because the real backends are.
 */
export interface StorageBackend {
  /** Read the value at `key`, or `undefined` when nothing is stored there. */
  get<T>(key: string): Promise<T | undefined>;
  /** Write `value` at `key`, replacing any existing value. */
  set<T>(key: string, value: T): Promise<void>;
  /** Remove `key`. A no-op when the key is absent. */
  remove(key: string): Promise<void>;
  /** Every key currently stored, in no guaranteed order. */
  keys(): Promise<string[]>;
}
