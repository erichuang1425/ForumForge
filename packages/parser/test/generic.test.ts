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
    expect(extract().posts).toHaveLength(3);
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

  it("leaves an ordinary reply without a role", () => {
    expect(extract().posts[2]?.role).toBeUndefined();
  });

  it("captures cleaned plain-text content", () => {
    expect(extract().posts[0]?.contentText).toContain("no signal");
  });

  it("returns an empty thread for markup with no recognizable posts", () => {
    const { document } = parseHTML("<main><p>just some prose</p></main>");
    const result = extractThreadGeneric(document as unknown as ParentNode);
    expect(result.posts).toEqual([]);
  });
});
