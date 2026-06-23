import { describe, it, expect } from "vitest";
import { MemoryStorageBackend } from "@forumforge/storage";
import {
  ReadHistory,
  threadKey,
  selectNewIds,
  mergeSeenIds,
  type ThreadReadState,
} from "../src/readHistory";

const posts = (...ids: string[]) => ids.map((id) => ({ id }));

describe("threadKey", () => {
  it("drops the fragment but keeps the query", () => {
    expect(threadKey("https://forum.example.com/t/5?page=2#post-9")).toBe(
      "https://forum.example.com/t/5?page=2",
    );
  });

  it("treats the same page with different post anchors as one thread", () => {
    expect(threadKey("https://f.example/t/5#post-1")).toBe(
      threadKey("https://f.example/t/5#post-42"),
    );
  });

  it("keeps a client-side route fragment so SPA threads stay distinct", () => {
    // On forums whose thread route lives in the hash, dropping it would collapse
    // every thread under one path into a single key.
    expect(threadKey("https://site.example/#/thread/42")).toBe(
      "https://site.example/#/thread/42",
    );
    expect(threadKey("https://site.example/#/thread/42")).not.toBe(
      threadKey("https://site.example/#/thread/7"),
    );
  });

  it("returns the input unchanged when it isn't a valid URL", () => {
    expect(threadKey("not a url")).toBe("not a url");
  });
});

describe("selectNewIds / mergeSeenIds", () => {
  it("marks nothing new on the first visit (no prior state)", () => {
    expect(selectNewIds(posts("1", "2"), undefined).size).toBe(0);
  });

  it("marks only ids unseen in the prior visit", () => {
    const prior: ThreadReadState = { seenIds: ["1", "2"], lastVisitedAt: "t" };
    expect([...selectNewIds(posts("1", "2", "3"), prior)]).toEqual(["3"]);
  });

  it("accumulates seen ids in first-seen order without duplicates", () => {
    const prior: ThreadReadState = { seenIds: ["1", "2"], lastVisitedAt: "t" };
    expect(mergeSeenIds(posts("2", "3"), prior)).toEqual(["1", "2", "3"]);
  });
});

describe("ReadHistory", () => {
  it("reports no new posts on the first visit, then new posts on the next", async () => {
    const history = new ReadHistory(new MemoryStorageBackend());
    const url = "https://forum.example.com/t/5";

    const first = await history.visit(url, posts("1", "2"));
    expect(first.isFirstVisit).toBe(true);
    expect(first.newIds.size).toBe(0);

    // A reply ("3") arrives before the second visit.
    const second = await history.visit(url, posts("1", "2", "3"));
    expect(second.isFirstVisit).toBe(false);
    expect([...second.newIds]).toEqual(["3"]);

    // Re-reading the same posts shows nothing new.
    const third = await history.visit(url, posts("1", "2", "3"));
    expect(third.newIds.size).toBe(0);
  });

  it("tracks each thread URL independently", async () => {
    const history = new ReadHistory(new MemoryStorageBackend());
    await history.visit("https://f.example/t/1", posts("a"));
    const other = await history.visit("https://f.example/t/2", posts("b"));
    expect(other.isFirstVisit).toBe(true);
    expect(other.newIds.size).toBe(0);
  });

  it("persists the last-visit time", async () => {
    const backend = new MemoryStorageBackend();
    const history = new ReadHistory(backend);
    const when = new Date("2026-06-21T12:00:00.000Z");
    await history.visit("https://f.example/t/9", posts("x"), when);

    const stored = await backend.get<ThreadReadState>(
      "readHistory:https://f.example/t/9",
    );
    expect(stored?.lastVisitedAt).toBe("2026-06-21T12:00:00.000Z");
    expect(stored?.seenIds).toEqual(["x"]);
  });
});
