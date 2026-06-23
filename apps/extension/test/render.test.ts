import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import type { ExtractedThread } from "@forumforge/parser";
import { renderThread, setSaveButtonState } from "../src/render";

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
    expect(view.querySelector(".ff-post__role")?.textContent).toBe("OP");
    expect(view.querySelector(".ff-post[data-role='op']")).not.toBeNull();
  });

  it("shows a readable badge for highlighted roles but none for plain users", () => {
    const thread: ExtractedThread = {
      posts: [
        { id: "1", author: "ada", role: "mod", contentText: "Moved to the right forum." },
        { id: "2", author: "grace", role: "user", contentText: "Thanks." },
      ],
    };
    const view = renderThread(freshDocument(), thread);
    const badges = view.querySelectorAll(".ff-post__role");

    // The moderator post is the only one with a badge; "user" is the unmarked default.
    expect(Array.from(badges).map((b) => b.textContent)).toEqual(["Mod"]);
    expect(view.querySelector(".ff-post[data-role='mod']")).not.toBeNull();
  });

  it("flags posts new since last visit with a badge and data attribute", () => {
    const thread: ExtractedThread = {
      posts: [
        { id: "1", author: "ada", contentText: "original question" },
        { id: "2", author: "grace", contentText: "a fresh reply" },
      ],
    };
    const view = renderThread(freshDocument(), thread, { newPostIds: new Set(["2"]) });

    // Only the new post is marked, and the cue carries readable text, not color alone.
    expect(view.querySelectorAll(".ff-post[data-new='true']")).toHaveLength(1);
    expect(view.querySelector(".ff-post[data-new='true'] .ff-post__author")?.textContent).toBe(
      "grace",
    );
    expect(Array.from(view.querySelectorAll(".ff-post__new")).map((b) => b.textContent)).toEqual([
      "New",
    ]);
  });

  it("marks no posts new when no ids are passed", () => {
    const thread: ExtractedThread = {
      posts: [{ id: "1", author: "ada", contentText: "hi" }],
    };
    const view = renderThread(freshDocument(), thread);
    expect(view.querySelector(".ff-post[data-new='true']")).toBeNull();
    expect(view.querySelector(".ff-post__new")).toBeNull();
  });

  it("gives every post a Save toggle carrying its id, unpressed by default", () => {
    const thread: ExtractedThread = {
      posts: [
        { id: "1", author: "ada", contentText: "first" },
        { id: "2", author: "grace", contentText: "second" },
      ],
    };
    const view = renderThread(freshDocument(), thread);
    const buttons = view.querySelectorAll<HTMLButtonElement>(".ff-post__save");

    expect(buttons).toHaveLength(2);
    expect(Array.from(buttons).map((b) => b.getAttribute("data-post-id"))).toEqual(["1", "2"]);
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual(["Save", "Save"]);
    expect(Array.from(buttons).every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(view.querySelector(".ff-post[data-post-id='1']")).not.toBeNull();
  });

  it("renders already-saved posts as pressed", () => {
    const thread: ExtractedThread = {
      posts: [
        { id: "1", author: "ada", contentText: "first" },
        { id: "2", author: "grace", contentText: "second" },
      ],
    };
    const view = renderThread(freshDocument(), thread, { savedPostIds: new Set(["2"]) });

    const saved = view.querySelector(".ff-post[data-saved='true']");
    expect(saved?.getAttribute("data-post-id")).toBe("2");
    expect(view.querySelector(".ff-post[data-post-id='2'] .ff-post__save")?.textContent).toBe(
      "Saved",
    );
    expect(
      view
        .querySelector(".ff-post[data-post-id='2'] .ff-post__save")
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(view.querySelector(".ff-post[data-post-id='1']")?.hasAttribute("data-saved")).toBe(false);
  });

  it("setSaveButtonState flips a button's label, aria-pressed and the post flag", () => {
    const view = renderThread(freshDocument(), {
      posts: [{ id: "1", author: "ada", contentText: "first" }],
    });
    const button = view.querySelector<HTMLElement>(".ff-post__save");
    const post = view.querySelector<HTMLElement>(".ff-post");
    if (!button || !post) throw new Error("expected a post with a Save button");

    setSaveButtonState(button, true);
    expect(button.textContent).toBe("Saved");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(post.getAttribute("data-saved")).toBe("true");

    setSaveButtonState(button, false);
    expect(button.textContent).toBe("Save");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(post.hasAttribute("data-saved")).toBe(false);
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
