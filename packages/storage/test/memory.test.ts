import { describe, it, expect } from "vitest";
import { MemoryStorageBackend } from "../src/index";

describe("MemoryStorageBackend", () => {
  it("returns undefined for a key that was never set", async () => {
    const backend = new MemoryStorageBackend();
    expect(await backend.get("missing")).toBeUndefined();
  });

  it("round-trips a stored value", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("greeting", "hello");
    expect(await backend.get<string>("greeting")).toBe("hello");
  });

  it("overwrites an existing value", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("n", 1);
    await backend.set("n", 2);
    expect(await backend.get<number>("n")).toBe(2);
  });

  it("removes a key and treats removing an absent key as a no-op", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("k", "v");
    await backend.remove("k");
    expect(await backend.get("k")).toBeUndefined();
    await expect(backend.remove("k")).resolves.toBeUndefined();
  });

  it("lists every stored key", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("a", 1);
    await backend.set("b", 2);
    expect((await backend.keys()).sort()).toEqual(["a", "b"]);
  });

  it("stores primitives and arrays", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("bool", true);
    await backend.set("list", [1, 2, 3]);
    expect(await backend.get<boolean>("bool")).toBe(true);
    expect(await backend.get<number[]>("list")).toEqual([1, 2, 3]);
  });

  it("isolates stored objects from the caller's reference on write", async () => {
    const backend = new MemoryStorageBackend();
    const value = { count: 1 };
    await backend.set("obj", value);
    value.count = 99; // mutate after storing
    expect((await backend.get<{ count: number }>("obj"))?.count).toBe(1);
  });

  it("isolates stored objects from the caller's reference on read", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set("obj", { count: 1 });
    const read = await backend.get<{ count: number }>("obj");
    if (read) read.count = 99; // mutate what we read back
    expect((await backend.get<{ count: number }>("obj"))?.count).toBe(1);
  });
});
