import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadNairaland, isNairalandPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "nairaland-thread.html"), "utf8");
const baseUrl = "https://www.nairaland.com/900100/restoring-pocket-radio";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadNairaland(document as unknown as ParentNode, { baseUrl });
}

describe("isNairalandPage", () => {
  it("detects a topic from its numeric post permalink, user, and narrow body", () => {
    const { document } = parseHTML(html);
    expect(isNairalandPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag a forum index that only has users and narrow layout cells", () => {
    const { document } = parseHTML(`<!doctype html><html><body><div class="body">
      <h2>Technology topics</h2><table><tr><td><a class="user">ada</a></td></tr>
      <tr><td><div class="narrow">A compact topic preview.</div></td></tr></table>
    </div></body></html>`);
    expect(isNairalandPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag an unrelated table with a numeric post link but no paired header", () => {
    const { document } = parseHTML(`<!doctype html><html><body><h2>Archive</h2>
      <a class="user">ada</a><a href="/post/42">post</a>
      <table><tr><td><div class="narrow">Archived text.</div></td></tr></table>
    </body></html>`);
    expect(isNairalandPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadNairaland", () => {
  it("extracts the topic title and stable numeric post ids", () => {
    const thread = extract();
    expect(thread).toMatchObject({ layout: "linear", source: "nairaland" });
    expect(thread.title).toBe("Restoring a pocket radio");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["900101", "900102", "900103"]);
  });

  it("extracts authors, profiles, timestamps, permalinks, bodies, and body links", () => {
    const [first, second] = extract().posts;
    expect(first).toMatchObject({
      author: "ada",
      authorUrl: "https://www.nairaland.com/user/ada",
      timestamp: "9:14am On Jul 16, 2026",
      permalink: "https://www.nairaland.com/post/900101#900101",
      contentText: expect.stringContaining("tuning dial drifts"),
      contentHtml: expect.stringContaining("Earlier note"),
      links: ["https://www.nairaland.com/900100/restoring-pocket-radio"],
    });
    expect(second?.timestamp).toBe("9:32am On Jul 16, 2026");
  });

  it("uses explicit OP and moderator markers without inferring from order", () => {
    const posts = extract().posts;
    expect(posts.map((post) => post.role)).toEqual(["op", undefined, "mod"]);
  });

  it("does not treat role-like text in a topic title as an author marker", () => {
    const { document } = parseHTML(`<!doctype html><html><body><div class="body">
      <h2>Repair notes (m)</h2><table><tbody>
        <tr><td><a href="/post/78#78">Repair notes (m)</a>
          by <a class="user">ada</a>: 8:00am On Jul 16, 2026</td></tr>
        <tr><td><div class="narrow">A normal member reply.</div></td></tr>
      </tbody></table></div></body></html>`);
    const thread = extractThreadNairaland(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts[0]?.role).toBeUndefined();
  });

  it("degrades an incomplete paired post without borrowing adjacent metadata", () => {
    const { document } = parseHTML(`<!doctype html><html><body><div class="body">
      <h2>Sparse topic</h2><table summary="posts"><tbody>
        <tr><td><a href="/post/77#77">Sparse topic</a><a class="user"></a></td></tr>
        <tr><td><div class="narrow"></div></td></tr>
      </tbody></table></div></body></html>`);
    const thread = extractThreadNairaland(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts).toEqual([
      expect.objectContaining({ id: "77", author: "Unknown", contentText: "" }),
    ]);
    expect(thread.posts[0]?.timestamp).toBeUndefined();
    expect(thread.posts[0]?.role).toBeUndefined();
  });
});
