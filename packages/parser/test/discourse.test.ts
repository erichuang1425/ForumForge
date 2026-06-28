import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { extractThreadDiscourse, isDiscoursePage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "discourse-thread.html"), "utf8");
const baseUrl = "https://forum.example.com";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadDiscourse(document as unknown as ParentNode, { baseUrl });
}

describe("isDiscoursePage", () => {
  it("detects the Discourse generator meta tag", () => {
    const { document } = parseHTML(html);
    expect(isDiscoursePage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag an unrelated page", () => {
    const { document } = parseHTML("<html><head><title>x</title></head><body></body></html>");
    expect(isDiscoursePage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadDiscourse", () => {
  it("reads the thread title from the h1 link", () => {
    expect(extract().title).toBe("How to fix monitor no signal after sleep");
  });

  it("extracts every topic-post article", () => {
    expect(extract().posts).toHaveLength(4);
  });

  it("captures ids from data-post-number, authors, and timestamps", () => {
    const [first] = extract().posts;
    expect(first?.id).toBe("1");
    expect(first?.author).toBe("ada");
    expect(first?.timestamp).toBe("2026-01-02T10:00:00Z");
  });

  it("resolves relative author links and permalinks against the base URL", () => {
    const [first] = extract().posts;
    expect(first?.authorUrl).toBe("https://forum.example.com/u/ada");
    expect(first?.permalink).toBe("https://forum.example.com/t/how-to-fix-monitor-no-signal/123/1");
  });

  it("collects body links from .cooked only", () => {
    const [first] = extract().posts;
    expect(first?.links).toEqual(["https://example.com/guide"]);
  });

  it("marks every post by the topic owner as op, not just the first", () => {
    const posts = extract().posts;
    expect(posts[0]?.role).toBe("op");
    expect(posts[2]?.author).toBe("ada");
    expect(posts[2]?.role).toBe("op");
  });

  it("detects a moderator from the user-title badge", () => {
    const second = extract().posts[1];
    expect(second?.author).toBe("grace");
    expect(second?.role).toBe("mod");
  });

  it("detects an admin from a class-only badge with no visible text", () => {
    const fourth = extract().posts[3];
    expect(fourth?.author).toBe("henry");
    expect(fourth?.role).toBe("admin");
  });

  it("captures cleaned plain-text content", () => {
    expect(extract().posts[0]?.contentText).toContain("no signal");
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });
});
