import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { extractThreadFromDocument } from "../src/extract";

// A small, hand-authored thread — never a live site (see docs/FIXTURES.md).
const HTML = `<!doctype html>
<html><body>
  <h1>Speaker crackle after firmware update</h1>
  <article class="post"><div class="username">ada</div>
    <time>2026-02-01</time>
    <div class="post-body">Anyone else hearing crackle since v2.1?</div>
  </article>
  <article class="post"><div class="username">grace</div>
    <time>2026-02-02</time>
    <div class="post-body">Rolling back to v2.0 fixed it for me.</div>
  </article>
</body></html>`;

function extract() {
  const { document } = parseHTML(HTML);
  return extractThreadFromDocument(document as unknown as Document);
}

describe("extractThreadFromDocument", () => {
  it("delegates to the generic parser to read the thread", () => {
    const thread = extract();
    expect(thread.title).toBe("Speaker crackle after firmware update");
    expect(thread.posts).toHaveLength(2);
    expect(thread.posts.map((p) => p.author)).toEqual(["ada", "grace"]);
  });

  it("marks the thread starter as OP", () => {
    expect(extract().posts[0]?.role).toBe("op");
  });
});
