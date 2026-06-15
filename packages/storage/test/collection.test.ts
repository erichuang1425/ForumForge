import { describe, it, expect } from "vitest";
import { Collection, MemoryStorageBackend } from "../src/index";

type Note = { text: string };

describe("Collection", () => {
  it("rejects an empty namespace", () => {
    expect(() => new Collection<Note>(new MemoryStorageBackend(), "")).toThrow();
  });

  it("round-trips records by id", async () => {
    const notes = new Collection<Note>(new MemoryStorageBackend(), "note");
    await notes.set("ada", { text: "helpful" });
    expect(await notes.get("ada")).toEqual({ text: "helpful" });
    expect(await notes.get("missing")).toBeUndefined();
  });

  it("reports presence with has and clears with delete", async () => {
    const notes = new Collection<Note>(new MemoryStorageBackend(), "note");
    expect(await notes.has("ada")).toBe(false);
    await notes.set("ada", { text: "hi" });
    expect(await notes.has("ada")).toBe(true);
    await notes.delete("ada");
    expect(await notes.has("ada")).toBe(false);
  });

  it("lists ids, values, and entries for its own records", async () => {
    const notes = new Collection<Note>(new MemoryStorageBackend(), "note");
    await notes.set("ada", { text: "a" });
    await notes.set("grace", { text: "g" });
    expect((await notes.ids()).sort()).toEqual(["ada", "grace"]);
    expect((await notes.values()).map((n) => n.text).sort()).toEqual(["a", "g"]);
    expect((await notes.entries()).sort()).toEqual([
      ["ada", { text: "a" }],
      ["grace", { text: "g" }],
    ]);
  });

  it("namespaces keys so collections sharing a backend don't collide", async () => {
    const backend = new MemoryStorageBackend();
    const notes = new Collection<Note>(backend, "note");
    const saved = new Collection<Note>(backend, "saved");

    // Same id in two collections must stay independent.
    await notes.set("101", { text: "a note" });
    await saved.set("101", { text: "a saved post" });

    expect(await notes.get("101")).toEqual({ text: "a note" });
    expect(await saved.get("101")).toEqual({ text: "a saved post" });
    expect(await notes.ids()).toEqual(["101"]);
    expect(await saved.ids()).toEqual(["101"]);

    // Deleting from one collection leaves the other intact.
    await notes.delete("101");
    expect(await notes.has("101")).toBe(false);
    expect(await saved.has("101")).toBe(true);
  });
});
