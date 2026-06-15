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

  it("never injects untrusted post HTML, only text", () => {
    const thread: ExtractedThread = {
      posts: [
        {
          id: "x",
          author: "<img src=x onerror=alert(1)>",
          contentText: "<script>alert(1)</script> hi",
          contentHtml: "<img src=x onerror=alert(1)>",
        },
      ],
    };
    const view = renderThread(freshDocument(), thread);

    // The malicious markup must appear as inert text, never as live nodes.
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("script")).toBeNull();
    expect(view.querySelector(".ff-post__body")?.textContent).toBe("<script>alert(1)</script> hi");
    expect(view.querySelector(".ff-post__author")?.textContent).toBe("<img src=x onerror=alert(1)>");
  });
});
