import { describe, it, expect } from "vitest";
import { MemoryStorageBackend } from "@forumforge/storage";
import { UserNotes, noteKey, noteOrigin, type UserNote } from "../src/userNotes";

describe("noteKey / noteOrigin", () => {
  it("scopes an author by origin, ignoring path, query and fragment", () => {
    // Same forum, different thread pages — one note about the author.
    expect(noteKey("https://f.example/t/5?page=2#post-9", "ada lovelace")).toBe(
      noteKey("https://f.example/t/7", "ada lovelace"),
    );
    expect(noteOrigin("https://f.example/t/5")).toBe("https://f.example");
  });

  it("keeps the same display name on different forums distinct", () => {
    expect(noteKey("https://a.example/t/1", "ada")).not.toBe(noteKey("https://b.example/t/1", "ada"));
  });
});

describe("UserNotes", () => {
  const url = "https://forum.example.com/t/5";

  it("stores a trimmed note with provenance and reads it back", async () => {
    const backend = new MemoryStorageBackend();
    const notes = new UserNotes(backend);
    const when = new Date("2026-06-23T09:00:00.000Z");

    expect(await notes.get(url, "ada")).toBeUndefined();
    await notes.set(url, "ada", "  helpful with GPU driver issues  ", { now: when });

    expect(await notes.get(url, "ada")).toBe("helpful with GPU driver issues");
    const stored = await backend.get<UserNote>("userNotes:https://forum.example.com ada");
    expect(stored?.origin).toBe("https://forum.example.com");
    expect(stored?.author).toBe("ada");
    expect(stored?.updatedAt).toBe("2026-06-23T09:00:00.000Z");
  });

  it("saving an empty or whitespace-only note deletes it", async () => {
    const notes = new UserNotes(new MemoryStorageBackend());
    await notes.set(url, "ada", "check their pricing claims");
    expect(await notes.get(url, "ada")).toBe("check their pricing claims");

    await notes.set(url, "ada", "   ");
    expect(await notes.get(url, "ada")).toBeUndefined();
  });

  it("removing an absent note is a no-op", async () => {
    const notes = new UserNotes(new MemoryStorageBackend());
    await expect(notes.remove(url, "nobody")).resolves.toBeUndefined();
  });

  it("lists notes only for the asked-for forum, keyed by author", async () => {
    const notes = new UserNotes(new MemoryStorageBackend());
    await notes.set(url, "ada", "note A");
    await notes.set("https://forum.example.com/t/9", "grace", "note B");
    await notes.set("https://other.example.com/t/1", "ada", "elsewhere");

    const map = await notes.notesFor(url);
    expect(map.get("ada")).toBe("note A");
    expect(map.get("grace")).toBe("note B");
    expect(map.has("elsewhere")).toBe(false);
    expect(map.size).toBe(2);
  });

  it("returns the same author note whatever thread page the URL points at", async () => {
    const notes = new UserNotes(new MemoryStorageBackend());
    await notes.set(`${url}?page=1`, "ada", "stays with the author");
    expect((await notes.notesFor(`${url}?page=2#post-3`)).get("ada")).toBe("stays with the author");
  });

  it("lists every note most-recently-updated first", async () => {
    const notes = new UserNotes(new MemoryStorageBackend());
    await notes.set(url, "ada", "older", { now: new Date("2026-06-23T09:00:00.000Z") });
    await notes.set(url, "grace", "newer", { now: new Date("2026-06-23T10:00:00.000Z") });

    expect((await notes.all()).map((n) => n.author)).toEqual(["grace", "ada"]);
  });
});
