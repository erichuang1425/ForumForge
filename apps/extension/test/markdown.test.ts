import { describe, it, expect } from "vitest";
import type { ForumForgePost } from "@forumforge/core";
import type { SavedPost } from "../src/savedPosts";
import { savedPostsToMarkdown } from "../src/markdown";
import { threadKey } from "../src/readHistory";

const post = (id: string, extra: Partial<ForumForgePost> = {}): ForumForgePost => ({
  id,
  author: "ada",
  contentText: `body ${id}`,
  ...extra,
});

const saved = (url: string, p: ForumForgePost, extra: Partial<SavedPost> = {}): SavedPost => ({
  threadKey: threadKey(url),
  threadUrl: url,
  savedAt: "2026-06-23T09:00:00.000Z",
  post: p,
  ...extra,
});

const when = new Date("2026-06-23T12:00:00.000Z");

describe("savedPostsToMarkdown", () => {
  it("renders an empty-state note when there is nothing saved", () => {
    const md = savedPostsToMarkdown([], { now: when });
    expect(md).toContain("# ForumForge — Saved posts");
    expect(md).toContain("_No saved posts yet._");
  });

  it("groups posts under their source thread with a heading and link", () => {
    const url = "https://f.example/t/5";
    const md = savedPostsToMarkdown(
      [
        saved(url, post("1", { contentText: "the useful fix" }), { threadTitle: "Monitor no signal" }),
        saved(url, post("2", { contentText: "another tip" }), { threadTitle: "Monitor no signal" }),
      ],
      { now: when },
    );

    expect(md).toContain("## Monitor no signal");
    expect(md).toContain("[Open thread](https://f.example/t/5)");
    expect(md).toContain("> the useful fix");
    expect(md).toContain("> another tip");
    // One thread heading for two posts from the same thread.
    expect(md.match(/^## /gm)?.length).toBe(1);
  });

  it("keeps posts from different threads in separate groups, first-seen order", () => {
    const a = "https://f.example/t/1";
    const b = "https://f.example/t/2";
    const md = savedPostsToMarkdown(
      [
        saved(a, post("1"), { threadTitle: "Thread A" }),
        saved(b, post("2"), { threadTitle: "Thread B" }),
        saved(a, post("3"), { threadTitle: "Thread A" }),
      ],
      { now: when },
    );

    const headings = md.match(/^## .*/gm);
    expect(headings).toEqual(["## Thread A", "## Thread B"]);
  });

  it("falls back to the thread URL as heading and omits the link when there is no title", () => {
    const url = "https://f.example/t/9";
    const md = savedPostsToMarkdown([saved(url, post("1"))], { now: when });
    // The URL is escaped like any other untrusted text (the dot becomes \.).
    expect(md).toContain("## https://f\\.example/t/9");
    expect(md).not.toContain("[Open thread]");
  });

  it("escapes a Markdown-bearing URL used as a heading fallback", () => {
    const md = savedPostsToMarkdown(
      [saved("https://f.example/![x](https://tracker.example/pixel)", post("1"))],
      { now: when },
    );
    expect(md).not.toContain("![x](https://tracker.example/pixel)");
  });

  it("includes author, role, timestamp and permalink in a post entry", () => {
    const md = savedPostsToMarkdown(
      [
        saved(
          "https://f.example/t/5",
          post("1", {
            author: "grace",
            role: "mod",
            timestamp: "Jan 2",
            permalink: "https://f.example/t/5#post-1",
          }),
        ),
      ],
      { now: when },
    );

    expect(md).toContain("### grace · Mod · Jan 2");
    expect(md).toContain("[Permalink](https://f.example/t/5#post-1)");
  });

  it("renders the body as a blockquote and an empty body as an em dash", () => {
    const md = savedPostsToMarkdown(
      [
        saved(
          "https://f.example/t/5",
          post("1", { contentText: "first line\n\nsecond line" }),
        ),
        saved("https://f.example/t/5", post("2", { contentText: "   " })),
      ],
      { now: when },
    );

    expect(md).toContain("> first line\n>\n> second line");
    expect(md).toContain("> —");
  });

  it("reports the post and thread counts in the subtitle", () => {
    const md = savedPostsToMarkdown(
      [
        saved("https://f.example/t/1", post("1"), { threadTitle: "A" }),
        saved("https://f.example/t/2", post("2"), { threadTitle: "B" }),
      ],
      { now: when },
    );
    expect(md).toContain("_2 posts from 2 threads · exported 2026-06-23T12:00:00.000Z._");
  });

  it("escapes Markdown/HTML in untrusted body text so it can't become active content", () => {
    const md = savedPostsToMarkdown(
      [
        saved(
          "https://f.example/t/5",
          post("1", { contentText: "see ![x](https://tracker.example/pixel) and <img src=x>" }),
        ),
      ],
      { now: when },
    );
    // Neither the image syntax nor the raw tag may survive as active Markdown/HTML.
    expect(md).not.toContain("![x](https://tracker.example/pixel)");
    expect(md).not.toContain("<img src=x>");
    expect(md).toContain("\\!\\[x\\]");
  });

  it("escapes Markdown/HTML in untrusted author names and thread titles", () => {
    const md = savedPostsToMarkdown(
      [
        saved("https://f.example/t/5", post("1", { author: "<img src=x onerror=1>" }), {
          threadTitle: "**bold** title",
        }),
      ],
      { now: when },
    );
    expect(md).not.toContain("<img src=x onerror=1>");
    expect(md).not.toContain("**bold** title");
    expect(md).toContain("## \\*\\*bold\\*\\* title");
  });

  it("contains link destinations so a URL with parentheses can't break out", () => {
    const md = savedPostsToMarkdown(
      [saved("https://f.example/t/5", post("1", { permalink: "https://f.example/p(1)" }), {
        threadTitle: "T",
      })],
      { now: when },
    );
    expect(md).toContain("[Permalink](https://f.example/p%281%29)");
  });

  it("omits a permalink whose URL scheme is not allowlisted", () => {
    const md = savedPostsToMarkdown(
      [saved("https://f.example/t/5", post("1", { permalink: "javascript:alert(1)" }))],
      { now: when },
    );
    expect(md).not.toContain("javascript:");
    expect(md).not.toContain("[Permalink]");
  });

  it("resolves a relative permalink against the thread URL", () => {
    const md = savedPostsToMarkdown(
      [saved("https://f.example/t/5", post("1", { permalink: "#post-9" }))],
      { now: when },
    );
    expect(md).toContain("[Permalink](https://f.example/t/5#post-9)");
  });
});
