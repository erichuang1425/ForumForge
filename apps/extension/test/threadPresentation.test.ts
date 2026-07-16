import type { ForumForgePost } from "@forumforge/core";
import type { ExtractedThread } from "@forumforge/parser";
import { describe, expect, it } from "vitest";
import {
  MAX_VISUAL_DEPTH,
  buildThreadPresentation,
  type PresentedPost,
} from "../src/threadPresentation";

function post(id: string, parentId?: string): ForumForgePost {
  return {
    id,
    author: `Author ${id}`,
    contentText: `Post ${id}`,
    ...(parentId ? { parentId } : {}),
  };
}

function ids(nodes: readonly PresentedPost[]): string[] {
  return nodes.map((node) => node.post.id);
}

function flattenedIds(nodes: readonly PresentedPost[]): string[] {
  const result: string[] = [];
  const pending = [...nodes].reverse();
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    result.push(node.post.id);
    pending.push(...node.children.slice().reverse());
  }
  return result;
}

describe("buildThreadPresentation", () => {
  it("defaults missing layout metadata to the linear renderer", () => {
    const presentation = buildThreadPresentation({ posts: [post("1")] });
    expect(presentation.layout).toBe("linear");
    expect(presentation.source).toBeUndefined();
  });

  it("builds source-ordered parent branches without losing a post", () => {
    const thread: ExtractedThread = {
      layout: "nested",
      source: "hacker-news",
      posts: [post("1"), post("2", "1"), post("3", "2"), post("4")],
    };
    const presentation = buildThreadPresentation(thread);
    expect(ids(presentation.roots)).toEqual(["1", "4"]);
    expect(ids(presentation.roots[0]?.children ?? [])).toEqual(["2"]);
    expect(ids(presentation.roots[0]?.children[0]?.children ?? [])).toEqual(["3"]);
    expect(flattenedIds(presentation.roots)).toEqual(["1", "2", "3", "4"]);
    expect(presentation.nodes).toHaveLength(thread.posts.length);
  });

  it("flattens missing, self, and forward parents instead of guessing", () => {
    const presentation = buildThreadPresentation({
      layout: "nested",
      posts: [post("1", "missing"), post("2", "2"), post("3", "4"), post("4")],
    });
    expect(ids(presentation.roots)).toEqual(["1", "2", "3", "4"]);
    expect(presentation.nodes.every((node) => node.children.length === 0)).toBe(true);
  });

  it("caps visual indentation while retaining the complete safe branch", () => {
    const posts = Array.from({ length: 9 }, (_, index) =>
      post(String(index + 1), index === 0 ? undefined : String(index)),
    );
    const presentation = buildThreadPresentation({ layout: "nested", posts });
    expect(presentation.nodes.map((node) => node.visualDepth)).toEqual([
      0,
      1,
      2,
      3,
      4,
      4,
      4,
      4,
      4,
    ]);
    expect(MAX_VISUAL_DEPTH).toBe(4);
    expect(flattenedIds(presentation.roots)).toEqual(posts.map((item) => item.id));
  });
});
