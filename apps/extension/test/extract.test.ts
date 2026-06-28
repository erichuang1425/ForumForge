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

  it("picks the Discourse adapter when the generator meta tag says so", () => {
    const html = `<!doctype html>
      <html><head><meta name="generator" content="Discourse 3.2.0" /></head>
      <body><article class="topic-post topic-owner" data-post-number="1">
        <div class="names"><a class="username" href="/u/ada"><span>ada</span></a></div>
        <div class="cooked"><p>Hello from Discourse.</p></div>
      </article></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.author).toBe("ada");
    expect(thread.posts[0]?.role).toBe("op");
  });

  it("picks the Hacker News adapter when the page has #hnmain", () => {
    const html = `<!doctype html>
      <html><body><table id="hnmain"><tr><td>
        <table class="comment-tree">
          <tr class="athing comtr" id="1">
            <td><table border="0"><tr>
              <td class="ind" indent="0"><img src="s.gif" width="0" /></td>
              <td class="default">
                <span class="comhead"><a href="user?id=bob" class="hnuser">bob</a></span>
                <div class="comment"><span class="commtext">Hello from HN.</span></div>
              </td>
            </tr></table></td>
          </tr>
        </table>
      </td></tr></table></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.author).toBe("bob");
  });
});
