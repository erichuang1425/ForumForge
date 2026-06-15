import { describe, it, expect } from "vitest";
import { createPost, isForumForgePost } from "../src/index";

describe("createPost", () => {
  it("fills required fields with safe defaults", () => {
    const post = createPost({});
    expect(post.id).toBeTruthy();
    expect(post.author).toBe("Unknown");
    expect(post.contentText).toBe("");
  });

  it("keeps a provided id and trims it", () => {
    expect(createPost({ id: "  101 " }).id).toBe("101");
  });

  it("derives a stable fallback id from content when the forum exposes none", () => {
    const input = { author: "ada", timestamp: "2026-01-02T10:00:00Z", contentText: "no signal" };
    const a = createPost(input);
    const b = createPost(input);
    expect(a.id).toBe(b.id); // same post → same id across extractions
    expect(a.id).toMatch(/^ffp-/);
  });

  it("gives posts with different content different fallback ids", () => {
    const a = createPost({ author: "ada", contentText: "first" });
    const b = createPost({ author: "ada", contentText: "second" });
    expect(a.id).not.toBe(b.id);
  });

  it("generates a unique id only when there is no stable content to key on", () => {
    const a = createPost({});
    const b = createPost({});
    expect(a.id).toBeTruthy();
    expect(b.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it("normalizes author and cleans content", () => {
    const post = createPost({ author: "  Ada  Lovelace ", contentText: "hi  \r\n there" });
    expect(post.author).toBe("Ada Lovelace");
    expect(post.contentText).toBe("hi\nthere");
  });

  it("only keeps a valid role", () => {
    expect(createPost({ role: "mod" }).role).toBe("mod");
    // @ts-expect-error invalid role should be rejected at runtime
    expect(createPost({ role: "wizard" }).role).toBeUndefined();
  });

  it("floors a non-negative depth and drops negatives", () => {
    expect(createPost({ depth: 2.9 }).depth).toBe(2);
    expect(createPost({ depth: -1 }).depth).toBeUndefined();
  });

  it("de-duplicates links and omits the field when empty", () => {
    expect(createPost({ links: ["a", "a", "b"] }).links).toEqual(["a", "b"]);
    expect(createPost({ links: ["", "  "] }).links).toBeUndefined();
  });

  it("omits optional fields that were not provided", () => {
    const post = createPost({ contentText: "x" });
    expect(post.permalink).toBeUndefined();
    expect(post.timestamp).toBeUndefined();
    expect(post.authorUrl).toBeUndefined();
  });
});

describe("isForumForgePost", () => {
  it("accepts a well-formed post", () => {
    expect(isForumForgePost(createPost({ id: "1", contentText: "x" }))).toBe(true);
  });

  it("rejects non-objects and incomplete shapes", () => {
    expect(isForumForgePost(null)).toBe(false);
    expect(isForumForgePost("nope")).toBe(false);
    expect(isForumForgePost({ id: "1", author: "a" })).toBe(false);
    expect(isForumForgePost({ id: "", author: "a", contentText: "x" })).toBe(false);
  });
});
