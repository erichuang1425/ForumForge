import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { extractThreadGeneric } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "generic-thread.html"), "utf8");
const baseUrl = "https://forum.example.com";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadGeneric(document as unknown as ParentNode, { baseUrl });
}

describe("extractThreadGeneric", () => {
  it("reads the thread title from the h1", () => {
    expect(extract().title).toBe("How to fix monitor no signal after sleep");
  });

  it("extracts every post container", () => {
    expect(extract().posts).toHaveLength(5);
  });

  it("captures ids, authors, and timestamps", () => {
    const [first] = extract().posts;
    expect(first?.id).toBe("101");
    expect(first?.author).toBe("ada");
    expect(first?.timestamp).toBe("2026-01-02T10:00:00Z");
  });

  it("resolves relative author links and permalinks against the base URL", () => {
    const [first] = extract().posts;
    expect(first?.authorUrl).toBe("https://forum.example.com/users/ada");
    expect(first?.permalink).toBe("https://forum.example.com/thread/5#post-101");
  });

  it("collects body links but not header/permalink links", () => {
    const [first] = extract().posts;
    expect(first?.links).toEqual(["https://example.com/guide"]);
  });

  it("marks the first post as the original poster", () => {
    expect(extract().posts[0]?.role).toBe("op");
  });

  it("detects a moderator from a role label", () => {
    const second = extract().posts[1];
    expect(second?.author).toBe("grace");
    expect(second?.role).toBe("mod");
  });

  it("marks a later post from the original poster as op", () => {
    const third = extract().posts[2];
    expect(third?.author).toBe("ada");
    expect(third?.role).toBe("op");
  });

  it("leaves an ordinary reply from another author without a role", () => {
    const fourth = extract().posts[3];
    expect(fourth?.author).toBe("carol");
    expect(fourth?.role).toBeUndefined();
  });

  it("keeps an image-only body instead of falling back to the whole post", () => {
    const fifth = extract().posts[4];
    expect(fifth?.author).toBe("dave");
    expect(fifth?.contentText).toBe("");
    expect(fifth?.contentHtml).toContain("<img");
  });

  it("captures cleaned plain-text content", () => {
    expect(extract().posts[0]?.contentText).toContain("no signal");
  });

  it("resolves relative URLs against the document base URI when no baseUrl is given", () => {
    const { document } = parseHTML(
      `<!doctype html><html><head>` +
        `<base href="https://forum.example.com/thread/9" />` +
        `</head><body><article class="post">` +
        `<a class="username" rel="author" href="/users/ivy">ivy</a>` +
        `<div class="post-body"><a href="/wiki/fix">wiki</a></div>` +
        `</article></body></html>`,
    );
    const [post] = extractThreadGeneric(document as unknown as ParentNode).posts;
    expect(post?.authorUrl).toBe("https://forum.example.com/users/ivy");
    expect(post?.links).toEqual(["https://forum.example.com/wiki/fix"]);
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });

  it("returns an empty thread for markup with no recognizable posts", () => {
    const { document } = parseHTML("<main><p>just some prose</p></main>");
    const result = extractThreadGeneric(document as unknown as ParentNode);
    expect(result.posts).toEqual([]);
  });
});
