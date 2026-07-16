import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadArca, isArcaPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "arca-thread.html"), "utf8");
const baseUrl = "https://arca.live/b/tools/700";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadArca(document as unknown as ParentNode, { baseUrl });
}

describe("isArcaPage", () => {
  it("detects a coherent board article with a canonical numeric link", () => {
    const { document } = parseHTML(html);
    expect(isArcaPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not select an Arca channel list", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div class="article-list"><div class="vrow"><span class="vcol col-title">Topic</span></div></div>
    </body></html>`);
    expect(isArcaPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects a lookalike article whose canonical link has no numeric id", () => {
    const { document } = parseHTML(
      html.replace('href="/b/tools/700"', 'href="/b/tools/not-an-article"'),
    );
    expect(isArcaPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadArca", () => {
  it("extracts the article and loaded comments with stable numeric ids", () => {
    const thread = extract();
    expect(thread).toMatchObject({ layout: "article-comments", source: "arca" });
    expect(thread.posts.map((post) => post.kind)).toEqual([
      "article",
      "comment",
      "comment",
      "comment",
      "comment",
    ]);
    expect(thread.title).toBe("낡은 라디오 수리 기록");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["700", "701", "702", "703", "704"]);
  });

  it("preserves Korean article metadata and safe body links", () => {
    const [article] = extract().posts;
    expect(article).toMatchObject({
      author: "ivy",
      authorUrl: "https://arca.live/u/@ivy",
      role: "op",
      timestamp: "2026-07-16T03:00:00.000Z",
      contentText: expect.stringContaining("접점을 닦으니 잡음이 줄었습니다."),
      permalink: baseUrl,
      links: ["https://arca.live/b/tools/699"],
    });
  });

  it("preserves native nesting without treating fixed users as staff", () => {
    const [, manager, nested, , opReply] = extract().posts;
    expect(manager).toMatchObject({ id: "701", role: "mod", parentId: "700", depth: 1 });
    expect(nested).toMatchObject({ id: "702", parentId: "701", depth: 2 });
    expect(opReply).toMatchObject({ id: "704", role: "op", parentId: "700", depth: 1 });
  });

  it("gives media-only comments a local placeholder without exposing a source URL", () => {
    const mediaOnly = extract().posts[2];
    expect(mediaOnly).toMatchObject({
      author: "ada",
      contentText: "[Media omitted — open the original thread to view it.]",
      contentHtml: expect.stringContaining("<img"),
    });
    expect(mediaOnly?.links).toBeUndefined();
    expect(mediaOnly?.contentHtml).not.toContain("src=");
  });

  it("degrades a deleted comment without borrowing adjacent identity or time", () => {
    const deleted = extract().posts[3];
    expect(deleted).toMatchObject({
      id: "703",
      author: "Unknown",
      contentText: "",
      parentId: "700",
      depth: 1,
      permalink: "https://arca.live/b/tools/700#c_703",
    });
    expect(deleted?.timestamp).toBeUndefined();
    expect(deleted?.role).toBeUndefined();
  });
});
