import { describe, it, expect } from "vitest";
import { MemoryStorageBackend } from "@forumforge/storage";
import type { ForumForgePost } from "@forumforge/core";
import { SavedPosts, savedKey, type SavedPost } from "../src/savedPosts";

const post = (id: string, extra: Partial<ForumForgePost> = {}): ForumForgePost => ({
  id,
  author: "ada",
  contentText: `body ${id}`,
  ...extra,
});

describe("savedKey", () => {
  it("namespaces a post id by its fragment-normalized thread", () => {
    // The post-anchor fragment is dropped (same thread), the post id is kept.
    expect(savedKey("https://f.example/t/5#post-9", "9")).toBe("https://f.example/t/5 9");
  });

  it("keeps the same post id in different threads distinct", () => {
    expect(savedKey("https://f.example/t/1", "p1")).not.toBe(
      savedKey("https://f.example/t/2", "p1"),
    );
  });
});

describe("SavedPosts", () => {
  const url = "https://forum.example.com/t/5";

  it("saves a frozen snapshot with provenance and reports it saved", async () => {
    const backend = new MemoryStorageBackend();
    const saved = new SavedPosts(backend);
    const when = new Date("2026-06-23T09:00:00.000Z");

    expect(await saved.isSaved(url, "1")).toBe(false);
    await saved.save(url, post("1", { contentText: "the useful fix" }), {
      threadTitle: "Monitor no signal",
      now: when,
    });

    expect(await saved.isSaved(url, "1")).toBe(true);
    const stored = await backend.get<SavedPost>("saved:https://forum.example.com/t/5 1");
    expect(stored?.threadTitle).toBe("Monitor no signal");
    expect(stored?.threadUrl).toBe(url);
    expect(stored?.savedAt).toBe("2026-06-23T09:00:00.000Z");
    expect(stored?.post.contentText).toBe("the useful fix");
  });

  it("toggles saved state on and off", async () => {
    const saved = new SavedPosts(new MemoryStorageBackend());
    expect(await saved.toggle(url, post("1"))).toBe(true);
    expect(await saved.isSaved(url, "1")).toBe(true);
    expect(await saved.toggle(url, post("1"))).toBe(false);
    expect(await saved.isSaved(url, "1")).toBe(false);
  });

  it("removing an unsaved post is a no-op", async () => {
    const saved = new SavedPosts(new MemoryStorageBackend());
    await expect(saved.remove(url, "nope")).resolves.toBeUndefined();
  });

  it("lists saved ids only for the asked-for thread", async () => {
    const saved = new SavedPosts(new MemoryStorageBackend());
    await saved.save(url, post("1"));
    await saved.save(url, post("2"));
    await saved.save("https://forum.example.com/t/6", post("1"));

    const ids = await saved.savedIdsFor(url);
    expect([...ids].sort()).toEqual(["1", "2"]);
  });

  it("returns the same saved ids whatever post anchor the URL carries", async () => {
    const saved = new SavedPosts(new MemoryStorageBackend());
    await saved.save(`${url}#post-1`, post("1"));
    expect([...(await saved.savedIdsFor(`${url}#post-99`))]).toEqual(["1"]);
  });

  it("lists every saved post most-recently-saved first", async () => {
    const saved = new SavedPosts(new MemoryStorageBackend());
    await saved.save(url, post("1"), { now: new Date("2026-06-23T09:00:00.000Z") });
    await saved.save(url, post("2"), { now: new Date("2026-06-23T10:00:00.000Z") });

    expect((await saved.all()).map((record) => record.post.id)).toEqual(["2", "1"]);
  });
});
