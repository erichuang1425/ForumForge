import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { extractThreadHackerNews, isHackerNewsPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "hackernews-thread.html"), "utf8");
const baseUrl = "https://news.ycombinator.com/item?id=1000";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadHackerNews(document as unknown as ParentNode, { baseUrl });
}

describe("isHackerNewsPage", () => {
  it("detects an item (thread) page via #hnmain plus op=\"item\"", () => {
    const { document } = parseHTML(html);
    expect(isHackerNewsPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag an unrelated page", () => {
    const { document } = parseHTML("<html><body><p>just some prose</p></body></html>");
    expect(isHackerNewsPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag a listing page (front page, /new, /ask), which shares #hnmain but isn't a thread", () => {
    const listingHtml = html.replace('<html lang="en" op="item">', '<html lang="en" op="news">');
    const { document } = parseHTML(listingHtml);
    expect(isHackerNewsPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadHackerNews", () => {
  it("reads the story title, stripping the ' | Hacker News' suffix", () => {
    expect(extract()).toMatchObject({
      title: "Tell HN: Something interesting",
      layout: "nested",
      source: "hacker-news",
    });
  });

  it("extracts every comment row", () => {
    expect(extract().posts).toHaveLength(4);
    expect(extract().posts.map((post) => post.kind)).toEqual([
      "comment",
      "comment",
      "comment",
      "comment",
    ]);
  });

  it("captures ids, authors, and timestamps from the title attribute", () => {
    const [first] = extract().posts;
    expect(first?.id).toBe("1001");
    expect(first?.author).toBe("bob");
    expect(first?.timestamp).toBe("2026-03-01T10:00:00");
  });

  it("resolves author links and permalinks against the base URL", () => {
    const [first] = extract().posts;
    expect(first?.authorUrl).toBe("https://news.ycombinator.com/user?id=bob");
    expect(first?.permalink).toBe("https://news.ycombinator.com/item?id=1001");
  });

  it("collects links from the comment body only, not the reply link", () => {
    const [first] = extract().posts;
    expect(first?.links).toEqual(["https://example.com/ref"]);
  });

  it("reads depth from the indent attribute", () => {
    const posts = extract().posts;
    expect(posts.map((p) => p.depth)).toEqual([0, 1, 2, 0]);
  });

  it("reconstructs parentId from depth, since HN's rows are a flat list", () => {
    const posts = extract().posts;
    expect(posts[1]?.parentId).toBe("1001"); // alice's reply, under bob
    expect(posts[2]?.parentId).toBe("1002"); // carol's reply, under alice
    expect(posts[0]?.parentId).toBeUndefined(); // top-level
    expect(posts[3]?.parentId).toBeUndefined(); // top-level sibling
  });

  it("marks comments by the story's submitter as op", () => {
    const posts = extract().posts;
    expect(posts[1]?.author).toBe("alice");
    expect(posts[1]?.role).toBe("op");
  });

  it("leaves a comment from a non-submitter without a role", () => {
    expect(extract().posts[0]?.role).toBeUndefined();
  });

  it("degrades gracefully when a comment has no author or body (deleted/flagged)", () => {
    const last = extract().posts[3];
    expect(last?.author).toBe("Unknown");
    expect(last?.contentText).toBe("");
    expect(last?.contentHtml).toBeUndefined();
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });

  it("adds no self-post entry for a link submission (no .toptext)", () => {
    expect(extract().posts).toHaveLength(4);
    expect(extract().posts[0]?.id).toBe("1001");
  });
});

describe("extractThreadHackerNews self-post text", () => {
  const selfPostHtml = readFileSync(join(here, "fixtures", "hackernews-self-post.html"), "utf8");

  function extractSelfPost() {
    const { document } = parseHTML(selfPostHtml);
    return extractThreadHackerNews(document as unknown as ParentNode, { baseUrl });
  }

  it("includes the story's self-post text as the first, OP-authored post", () => {
    const posts = extractSelfPost().posts;
    expect(posts).toHaveLength(2);
    expect(posts[0]?.id).toBe("2000");
    expect(posts[0]?.author).toBe("daniel");
    expect(posts[0]?.role).toBe("op");
    expect(posts[0]?.contentText).toContain("best way to learn Rust");
    expect(posts[0]).toMatchObject({ kind: "article", score: 10 });
  });

  it("resolves the self-post's author URL, timestamp, and permalink", () => {
    const [first] = extractSelfPost().posts;
    expect(first?.authorUrl).toBe("https://news.ycombinator.com/user?id=daniel");
    expect(first?.timestamp).toBe("2026-04-01T09:00:00");
    expect(first?.permalink).toBe("https://news.ycombinator.com/item?id=2000");
  });

  it("collects links from the self-post body", () => {
    const [first] = extractSelfPost().posts;
    expect(first?.links).toEqual(["https://example.com/rust-book"]);
  });

  it("still extracts comments that follow the self-post", () => {
    const posts = extractSelfPost().posts;
    expect(posts[1]?.id).toBe("2001");
    expect(posts[1]?.author).toBe("erin");
    expect(posts[1]?.depth).toBe(0);
  });
});
