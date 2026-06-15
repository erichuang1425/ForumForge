import type { StorageBackend } from "./backend";

/**
 * Deep-clone a value so stored state can't be mutated through a caller's
 * reference. Primitives (and null/undefined) are returned as-is; objects and
 * arrays are copied. Prefer `structuredClone` — it matches how a real
 * serializing backend isolates values — and fall back to a JSON round-trip
 * where it isn't available.
 */
function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const structured = (globalThis as { structuredClone?: <V>(v: V) => V }).structuredClone;
  if (structured) return structured(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * In-memory `StorageBackend` for tests, non-browser callers, and as a default
 * fallback when no persistent backend is configured.
 *
 * Values are cloned on the way in and out, so stored state can't be changed
 * through a reference a caller still holds — the same isolation a real
 * serializing backend (chrome.storage, IndexedDB) gives you. Nothing here is
 * persisted across process restarts.
 */
export class MemoryStorageBackend implements StorageBackend {
  private readonly store = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    if (!this.store.has(key)) return Promise.resolve(undefined);
    return Promise.resolve(clone(this.store.get(key) as T));
  }

  set<T>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      return Promise.reject(
        new TypeError(
          `Cannot store undefined at "${key}"; use remove() to delete a key`,
        ),
      );
    }
    this.store.set(key, clone(value));
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.store.keys()]);
  }
}
