import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadFmKorea, isFmKoreaPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "fmkorea-thread.html"), "utf8");
const baseUrl = "https://www.fmkorea.com/index.php?document_srl=9000&mid=best";

function extract(markup = html) {
  const { document } = parseHTML(markup);
  return extractThreadFmKorea(document as unknown as ParentNode, { baseUrl });
}

describe("isFmKoreaPage", () => {
  it("detects a coherent numeric article shell", () => {
    const { document } = parseHTML(html);
    expect(isFmKoreaPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not select a board list", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div class="bd"><ul><li class="document_9000">목록 글</li></ul></div>
    </body></html>`);
    expect(isFmKoreaPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects nonnumeric or mismatched document identities", () => {
    const nonnumeric = parseHTML(html.replace('data-docsrl="9000"', 'data-docsrl="topic"'));
    const mismatched = parseHTML(html.replace("document_9000_42", "document_9999_42"));
    expect(isFmKoreaPage(nonnumeric.document as unknown as ParentNode)).toBe(false);
    expect(isFmKoreaPage(mismatched.document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadFmKorea", () => {
  it("extracts the article and current comment page in DOM order", () => {
    const thread = extract();
    expect(thread).toMatchObject({ layout: "article-comments", source: "fmkorea" });
    expect(thread.posts.map((post) => post.kind)).toEqual([
      "article",
      "comment",
      "comment",
      "comment",
      "comment",
    ]);
    expect(thread.title).toBe("오래된 극장 간판 복원");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["9000", "9001", "9002", "9003", "9004"]);
  });

  it("preserves article metadata, Korean text, canonical permalink, and body links", () => {
    expect(extract().posts[0]).toMatchObject({
      id: "9000",
      author: "ivy",
      role: "op",
      timestamp: "2026.07.16 14:00",
      contentText: expect.stringContaining("낡은 글자를 닦고 빠진 전구를 교체했습니다."),
      permalink: "https://www.fmkorea.com/best/9000",
      links: ["https://www.fmkorea.com/best/8999"],
      depth: 0,
    });
  });

  it("uses exact member identity and explicit reply-parent links", () => {
    const [, comment, reply] = extract().posts;
    expect(comment).toMatchObject({ author: "mira", parentId: "9000", depth: 1 });
    expect(comment?.role).toBeUndefined();
    expect(reply).toMatchObject({
      author: "ivy",
      role: "op",
      parentId: "9001",
      depth: 2,
      permalink: "https://www.fmkorea.com/best/9000/9002#comment_9002",
    });
  });

  it("keeps deleted and media-only comments readable without borrowing identity", () => {
    const deleted = extract().posts[3];
    const media = extract().posts[4];
    expect(deleted).toMatchObject({
      author: "Unknown",
      contentText: "삭제된 댓글입니다.",
      parentId: "9000",
    });
    expect(deleted?.role).toBeUndefined();
    expect(media?.contentText).toBe("[Media omitted — open the original thread to view it.]");
  });

  it("skips a comment whose element and permalink identities disagree", () => {
    const thread = extract(html.replace("/9004#comment_9004", "/9999#comment_9999"));
    expect(thread.posts.map((post) => post.id)).toEqual(["9000", "9001", "9002", "9003"]);
  });

  it("does not retain a reply parent absent from the loaded comment page", () => {
    const thread = extract(html.replace("/9001#comment_9001\">mira", "/9999#comment_9999\">mira"));
    expect(thread.posts[2]).toMatchObject({ parentId: "9000", depth: 1 });
  });

  it("ignores a comment wrapper belonging to another article", () => {
    const thread = extract(html.replace('id="9000_comment"', 'id="9999_comment"'));
    expect(thread.posts.map((post) => post.id)).toEqual(["9000"]);
  });
});
