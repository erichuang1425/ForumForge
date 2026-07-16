import type { ForumForgePost } from "@forumforge/core";
import type { ExtractedThread, ThreadLayout } from "@forumforge/parser";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { renderPageThread } from "../src/pageThreadRenderer";

function post(id: string, extra: Partial<ForumForgePost> = {}): ForumForgePost {
  return {
    id,
    author: `Author ${id}`,
    contentText: `Post ${id}`,
    ...extra,
  };
}

function render(thread: ExtractedThread): HTMLElement {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  return renderPageThread(document as unknown as Document, thread);
}

function postIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".ff-post")).map(
    (item) => item.getAttribute("data-post-id") ?? "",
  );
}

describe("renderPageThread", () => {
  it("uses the readable linear fallback when layout metadata is absent", () => {
    const root = render({ posts: [post("1"), post("2")] });
    expect(root.getAttribute("data-layout")).toBe("linear");
    expect(root.querySelector(".ff-posts--linear")).not.toBeNull();
    expect(postIds(root)).toEqual(["1", "2"]);
  });

  it("separates an editorial article from its nested comments", () => {
    const root = render({
      layout: "article-comments",
      source: "arca",
      posts: [
        post("article", { kind: "article" }),
        post("comment", { kind: "comment", parentId: "article" }),
        post("reply", { kind: "comment", parentId: "comment" }),
      ],
    });
    expect(root.getAttribute("data-source")).toBe("arca");
    expect(root.querySelector(".ff-page-thread__lead [data-post-id='article']")).not.toBeNull();
    expect(root.querySelector(".ff-page-thread__comments [data-post-id='comment']")).not.toBeNull();
    expect(
      root.querySelector("[data-post-id='comment'] .ff-posts--branch [data-post-id='reply']"),
    ).not.toBeNull();
    expect(postIds(root)).toEqual(["article", "comment", "reply"]);
  });

  it("renders bounded, semantic nested branches", () => {
    const root = render({
      layout: "nested",
      source: "hacker-news",
      posts: [
        post("1", { kind: "comment" }),
        post("2", { kind: "comment", parentId: "1" }),
        post("3", { kind: "comment", parentId: "2" }),
      ],
    });
    expect(root.querySelector("[data-post-id='1'] > .ff-posts--branch")).not.toBeNull();
    expect(root.querySelector("[data-post-id='3']")?.getAttribute("data-visual-depth")).toBe(
      "2",
    );
    expect(root.textContent).toContain("Reply level 2");
    expect(postIds(root)).toEqual(["1", "2", "3"]);
  });

  it("gives PTT push, boo, and neutral rows readable non-color labels", () => {
    const root = render({
      layout: "ptt",
      source: "ptt",
      posts: [
        post("article", { kind: "article" }),
        post("1", { kind: "comment", reaction: "push", parentId: "article" }),
        post("2", { kind: "comment", reaction: "boo", parentId: "article" }),
        post("3", { kind: "comment", reaction: "neutral", parentId: "article" }),
      ],
    });
    expect(root.querySelector(".ff-page-thread__reactions")).not.toBeNull();
    expect(
      Array.from(root.querySelectorAll(".ff-post__reaction")).map((item) => item.textContent),
    ).toEqual(["Push", "Boo", "Neutral"]);
    expect(postIds(root)).toEqual(["article", "1", "2", "3"]);
  });

  it("keeps the imageboard layout compact and identifies posts by source number", () => {
    const root = render({
      layout: "imageboard",
      source: "4chan",
      posts: [
        post("100", { kind: "topic" }),
        post("101", { kind: "reply", parentId: "100" }),
      ],
    });
    expect(root.querySelector(".ff-post__avatar")).toBeNull();
    expect(root.querySelector("[data-post-id='100'] .ff-post__ordinal")?.textContent).toBe(
      "No. 100",
    );
    expect(root.querySelector(".ff-posts--imageboard")).not.toBeNull();
    expect(postIds(root)).toEqual(["100", "101"]);
  });

  it("groups a question, its comments, answers, scores, and accepted state", () => {
    const root = render({
      layout: "qa",
      source: "stack-overflow",
      posts: [
        post("q", { kind: "question", score: 12 }),
        post("qc", { kind: "comment", parentId: "q" }),
        post("a1", { kind: "answer", parentId: "q", score: 7, accepted: true }),
        post("ac", { kind: "comment", parentId: "a1" }),
        post("a2", { kind: "answer", parentId: "q", score: -2 }),
      ],
    });
    expect(root.querySelector(".ff-page-thread__question [data-post-id='q']")).not.toBeNull();
    expect(root.querySelector(".ff-page-thread__answers [data-post-id='a1']")).not.toBeNull();
    expect(root.querySelector("[data-post-id='a1'] .ff-post__accepted")?.textContent).toBe(
      "Accepted answer",
    );
    expect(root.querySelector("[data-post-id='a2'] .ff-post__score")?.textContent).toBe(
      "-2 votes",
    );
    expect(root.querySelector("[data-post-id='a1'] [data-post-id='ac']")).not.toBeNull();
    expect(postIds(root)).toEqual(["q", "qc", "a1", "ac", "a2"]);
  });

  it.each<ThreadLayout>(["linear", "article-comments", "nested", "ptt", "imageboard", "qa"])(
    "routes the %s layout without rendering untrusted media",
    (layout) => {
      const root = render({
        layout,
        posts: [
          post("1", {
            contentHtml:
              '<img src="https://tracker.invalid/pixel"><script>alert(1)</script><p>Readable</p>',
          }),
        ],
      });
      expect(root.querySelector("img, script")).toBeNull();
      expect(root.textContent).toContain("Readable");
      expect(postIds(root)).toEqual(["1"]);
    },
  );
});
