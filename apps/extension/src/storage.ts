import type { StorageBackend } from "@forumforge/storage";

/**
 * The persistent `StorageBackend` the shipped extension runs on, backed by
 * `chrome.storage.local`.
 *
 * `@forumforge/storage` defines the local-first contract and ships an in-memory
 * backend for tests; this is the browser implementation that keeps the data
 * — read history today, notes and saved posts later — on the user's own device
 * across visits. Nothing here leaves the device (see docs/PRIVACY.md).
 *
 * The backing {@link chrome.storage.StorageArea} is injectable so the adapter
 * can be unit-tested against a fake area without a real browser.
 */
export class ChromeStorageBackend implements StorageBackend {
  constructor(private readonly area: chrome.storage.StorageArea = chrome.storage.local) {}

  async get<T>(key: string): Promise<T | undefined> {
    const result = await this.area.get(key);
    return result[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      // Match the contract: undefined is the sentinel `get` returns for an
      // absent key, so storing it would be indistinguishable from "nothing here".
      throw new TypeError(
        `Cannot store undefined at "${key}"; use remove() to delete a key`,
      );
    }
    await this.area.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await this.area.remove(key);
  }

  async keys(): Promise<string[]> {
    const all = await this.area.get(null);
    return Object.keys(all);
  }
}
