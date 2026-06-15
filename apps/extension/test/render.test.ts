import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import type { ExtractedThread } from "@forumforge/parser";
import { renderThread } from "../src/render";

function freshDocument(): Document {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  return document as unknown as Document;
}

describe("renderThread", () => {
  it("renders the title and one list item per post", () => {
    const thread: ExtractedThread = {
      title: "Monitor no signal",
      posts: [
        { id: "1", author: "ada", role: "op", timestamp: "yesterday", contentText: "Try a new cable." },
        { id: "2", author: "grace", contentText: "That worked, thanks." },
      ],
    };
    const view = renderThread(freshDocument(), thread);

    expect(view.querySelector(".ff-thread__title")?.textContent).toBe("Monitor no signal");
    expect(view.querySelectorAll(".ff-post")).toHaveLength(2);
    expect(view.querySelector(".ff-post__author")?.textContent).toBe("ada");
    expect(view.querySelector(".ff-post__role")?.textContent).toBe("op");
    expect(view.querySelector(".ff-post[data-role='op']")).not.toBeNull();
  });

  it("shows an empty state when there are no posts", () => {
    const view = renderThread(freshDocument(), { posts: [] });
    expect(view.querySelector(".ff-empty")?.textContent).toBe("No posts found on this page.");
  });

  it("renders sanitized rich contentHtml as real elements", () => {
    const thread: ExtractedThread = {
      posts: [
        {
          id: "1",
          author: "ada",
          contentText: "Try a new cable, then update the driver.",
          contentHtml:
            '<div class="bbcode"><p>Try a <strong>new cable</strong>.</p>' +
            '<blockquote>then update the driver</blockquote></div>',
        },
      ],
    };
    const view = renderThread(freshDocument(), thread);

    expect(view.querySelector(".ff-post__body strong")?.textContent).toBe("new cable");
    expect(view.querySelector(".ff-post__body blockquote")?.textContent).toBe(
      "then update the driver",
    );
    // The layout wrapper's class is gone; only semantic markup remains.
    expect(view.querySelector(".ff-post__body [class]")).toBeNull();
  });

  it("sanitizes malicious contentHtml instead of injecting it", () => {
    const thread: ExtractedThread = {
      posts: [
        {
          id: "x",
          author: "<img src=x onerror=alert(1)>",
          contentText: "safe text",
          contentHtml: '<p onclick="x()">hi<script>alert(1)</script></p><img src=x onerror=alert(1)>',
        },
      ],
    };
    const view = renderThread(freshDocument(), thread);

    expect(view.querySelector("script")).toBeNull();
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector(".ff-post__body p")?.hasAttribute("onclick")).toBe(false);
    expect(view.querySelector(".ff-post__body")?.textContent).toBe("hi");
    // The author is always written as text, never parsed as markup.
    expect(view.querySelector(".ff-post__author")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("resolves a post's relative links against the thread base URL", () => {
    const thread: ExtractedThread = {
      baseUrl: "https://forum.example.com/thread/5",
      posts: [
        {
          id: "1",
          author: "ada",
          contentText: "see the other thread",
          contentHtml: '<p>see <a href="/thread/9#post-2">the other thread</a></p>',
        },
      ],
    };
    const view = renderThread(freshDocument(), thread);
    expect(view.querySelector(".ff-post__body a")?.getAttribute("href")).toBe(
      "https://forum.example.com/thread/9#post-2",
    );
  });

  it("falls back to plain text when contentHtml sanitizes to nothing", () => {
    const thread: ExtractedThread = {
      posts: [
        {
          id: "x",
          author: "grace",
          contentText: "the original text",
          contentHtml: "<img src=x onerror=alert(1)>",
        },
      ],
    };
    const view = renderThread(freshDocument(), thread);

    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector(".ff-post__text")?.textContent).toBe("the original text");
  });
});
