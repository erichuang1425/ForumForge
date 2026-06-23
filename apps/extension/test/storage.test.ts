import { describe, it, expect } from "vitest";
import { ChromeStorageBackend } from "../src/storage";

/**
 * A minimal fake of `chrome.storage.StorageArea` so the adapter can be tested
 * without a real browser. Mirrors the slice the backend uses: `get(key)`,
 * `get(null)` for all items, `set`, and `remove`.
 */
function fakeArea() {
  const store = new Map<string, unknown>();
  return {
    store,
    get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      if (keys === null || keys === undefined) {
        return Promise.resolve(Object.fromEntries(store));
      }
      const wanted = Array.isArray(keys) ? keys : [keys];
      const result: Record<string, unknown> = {};
      for (const key of wanted) {
        if (store.has(key)) result[key] = store.get(key);
      }
      return Promise.resolve(result);
    },
    set(items: Record<string, unknown>): Promise<void> {
      for (const [key, value] of Object.entries(items)) store.set(key, value);
      return Promise.resolve();
    },
    remove(keys: string | string[]): Promise<void> {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
      return Promise.resolve();
    },
  };
}

describe("ChromeStorageBackend", () => {
  it("round-trips a value and reports it absent after removal", async () => {
    const backend = new ChromeStorageBackend(fakeArea());
    expect(await backend.get("k")).toBeUndefined();

    await backend.set("k", { hello: "world" });
    expect(await backend.get<{ hello: string }>("k")).toEqual({ hello: "world" });

    await backend.remove("k");
    expect(await backend.get("k")).toBeUndefined();
  });

  it("lists every stored key", async () => {
    const backend = new ChromeStorageBackend(fakeArea());
    await backend.set("a", 1);
    await backend.set("b", 2);
    expect((await backend.keys()).sort()).toEqual(["a", "b"]);
  });

  it("rejects storing undefined (the absent-key sentinel)", async () => {
    const backend = new ChromeStorageBackend(fakeArea());
    await expect(backend.set("k", undefined)).rejects.toThrow(TypeError);
  });
});
