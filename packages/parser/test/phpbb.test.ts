import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadPhpBB, isPhpBBPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "phpbb-thread.html"), "utf8");
const baseUrl = "https://board.example.test/viewtopic.php?t=42";

function extract(options: { baseUrl?: string } = { baseUrl }) {
  const { document } = parseHTML(html);
  return extractThreadPhpBB(document as unknown as ParentNode, options);
}

describe("isPhpBBPage", () => {
  it("detects a prosilver topic page from the body and post structure", () => {
    const { document } = parseHTML(html);
    expect(isPhpBBPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag a phpBB forum index that shares generic post-like class names", () => {
    const { document } = parseHTML(`<!doctype html><html><body id="phpbb" class="section-viewforum">
      <div id="page-body"><div id="p1" class="post"><div class="postbody">
        <div class="content">A forum description, not a post.</div>
      </div></div></div>
    </body></html>`);
    expect(isPhpBBPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag an unrelated topic page that only imitates the generic classes", () => {
    const { document } = parseHTML(`<!doctype html><html><body class="section-viewtopic">
      <div id="page-body"><div id="p1" class="post"><div class="postbody">
        <div class="content">Unrelated content.</div>
      </div></div></div>
    </body></html>`);
    expect(isPhpBBPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadPhpBB", () => {
  it("extracts the topic title and every numeric post container", () => {
    const thread = extract();
    expect(thread.title).toBe("Calibrating a pocket sensor");
    expect(thread.posts).toHaveLength(4);
    expect(thread.posts.map((post) => post.id)).toEqual(["401", "402", "403", "404"]);
  });

  it("can extract from the page-body subtree supplied by a caller", () => {
    const { document } = parseHTML(html);
    const pageBody = document.querySelector("#page-body");
    expect(pageBody).not.toBeNull();
    const thread = extractThreadPhpBB(pageBody as ParentNode, { baseUrl });
    expect(thread.title).toBe("Calibrating a pocket sensor");
    expect(thread.posts).toHaveLength(4);
  });

  it("captures authors, timestamps, profile URLs, and permalinks", () => {
    const [first] = extract().posts;
    expect(first?.author).toBe("ada");
    expect(first?.timestamp).toBe("2026-05-01T09:00:00+00:00");
    expect(first?.authorUrl).toBe(
      "https://board.example.test/memberlist.php?mode=viewprofile&u=11",
    );
    expect(first?.permalink).toBe("https://board.example.test/viewtopic.php?p=401#p401");
  });

  it("captures cleaned body text, raw body HTML, and body links only", () => {
    const [first] = extract().posts;
    expect(first?.contentText).toContain("baseline drifts");
    expect(first?.contentHtml).toContain("reference card");
    expect(first?.links).toEqual(["https://example.test/reference"]);
  });

  it("does not infer OP from display order or a repeated author", () => {
    const posts = extract().posts;
    expect(posts[0]?.role).toBeUndefined();
    expect(posts[2]?.author).toBe("ada");
    expect(posts[2]?.role).toBeUndefined();
  });

  it("extracts explicit moderator and administrator ranks", () => {
    const posts = extract().posts;
    expect(posts[1]?.role).toBe("mod");
    expect(posts[3]?.role).toBe("admin");
  });

  it("keeps OP unset across later-page, direct-post, filter, and sort URLs", () => {
    const urls = [
      "https://board.example.test/viewtopic.php?t=42&start=25",
      "https://board.example.test/viewtopic.php?p=403#p403",
      "https://board.example.test/viewtopic.php?t=42&st=7",
      "https://board.example.test/viewtopic.php?t=42&sk=t&sd=d",
    ];

    for (const baseUrl of urls) {
      const posts = extract({ baseUrl }).posts;
      expect(posts[0]?.role).toBeUndefined();
      expect(posts[2]?.role).toBeUndefined();
      expect(posts[1]?.role).toBe("mod");
    }
  });

  it("keeps OP unset when no base URL is available", () => {
    const posts = extract({
      baseUrl: undefined,
    }).posts;
    expect(posts[0]?.role).toBeUndefined();
    expect(posts[2]?.role).toBeUndefined();
  });

  it("degrades missing author, timestamp, and content fields without pulling in profile text", () => {
    const { document } = parseHTML(`<!doctype html><html><body id="phpbb" class="section-viewtopic">
      <div id="page-body"><h2 class="topic-title">Sparse topic</h2>
        <div id="p900" class="post"><dl class="postprofile"><dd>profile metadata</dd></dl>
          <div class="postbody"><h3><a href="#p900">Sparse topic</a></h3></div>
        </div>
      </div>
    </body></html>`);
    expect(isPhpBBPage(document as unknown as ParentNode)).toBe(true);
    const thread = extractThreadPhpBB(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "900", author: "Unknown", contentText: "" });
    expect(thread.posts[0]?.timestamp).toBeUndefined();
    expect(thread.posts[0]?.contentHtml).toBeUndefined();
    expect(thread.posts[0]?.links).toBeUndefined();
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });
});
