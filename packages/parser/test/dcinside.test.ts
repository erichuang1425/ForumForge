import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadDcInside, isDcInsidePage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "dcinside-thread.html"), "utf8");
const baseUrl = "https://gall.dcinside.com/board/view/?id=tools&no=800";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadDcInside(document as unknown as ParentNode, { baseUrl });
}

describe("isDcInsidePage", () => {
  it("detects a coherent gallery article with a numeric article signal", () => {
    const { document } = parseHTML(html);
    expect(isDcInsidePage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not select a gallery list", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <table class="gall_list"><tr class="ub-content"><td class="gall_writer">ivy</td></tr></table>
    </body></html>`);
    expect(isDcInsidePage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects a lookalike view with a nonnumeric article identity", () => {
    const { document } = parseHTML(html.replaceAll('data-no="800"', 'data-no="topic"'));
    expect(isDcInsidePage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects conflicting article identity signals", () => {
    const { document } = parseHTML(
      html.replace(
        '</div><!-- recommendation controls -->',
        '<button data-no="999"></button></div><!-- recommendation controls -->',
      ),
    );
    expect(isDcInsidePage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects an empty article identity signal", () => {
    const { document } = parseHTML(html.replace('data-no="800"', 'data-no=""'));
    expect(isDcInsidePage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadDcInside", () => {
  it("extracts the article and already-loaded comments in DOM order", () => {
    const thread = extract();
    expect(thread.title).toBe("오래된 라디오 수리 기록");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["800", "801", "802", "803", "804"]);
  });

  it("preserves article identity, timestamp, Korean text, and body links", () => {
    const [article] = extract().posts;
    expect(article).toMatchObject({
      author: "ivy",
      authorUrl: "https://gall.dcinside.com/gallog/ivy01",
      role: "op",
      timestamp: "2026.07.16 12:00:00",
      contentText: expect.stringContaining("접점을 닦고 다이얼 끈을 다시 걸었습니다."),
      permalink: baseUrl,
      links: ["https://gall.dcinside.com/board/view/?id=tools&no=799"],
    });
  });

  it("uses the first-party comment and reply identity hierarchy", () => {
    const [, comment, reply, , opComment] = extract().posts;
    expect(comment).toMatchObject({ id: "801", author: "mira", parentId: "800", depth: 1 });
    expect(reply).toMatchObject({
      id: "802",
      author: "ㅇㅇ (123.45)",
      parentId: "801",
      depth: 2,
      contentText: "[Media omitted — open the original thread to view it.]",
    });
    expect(opComment).toMatchObject({ id: "804", role: "op", parentId: "800", depth: 1 });
  });

  it("does not borrow author, time, or role for a deleted comment", () => {
    const deleted = extract().posts[3];
    expect(deleted).toMatchObject({
      id: "803",
      author: "Unknown",
      contentText: "삭제된 댓글입니다.",
      parentId: "800",
      depth: 1,
      permalink: `${baseUrl}#comment_li_803`,
    });
    expect(deleted?.timestamp).toBeUndefined();
    expect(deleted?.role).toBeUndefined();
  });

  it("skips a rendered comment whose element and data ids disagree", () => {
    const { document } = parseHTML(html.replace('data-no="804"', 'data-no="999"'));
    const thread = extractThreadDcInside(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts.map((post) => post.id)).toEqual(["800", "801", "802", "803"]);
  });

  it("ignores a comment shell belonging to another article", () => {
    const { document } = parseHTML(html.replace('id="comment_wrap_800"', 'id="comment_wrap_999"'));
    const thread = extractThreadDcInside(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts.map((post) => post.id)).toEqual(["800"]);
  });

  it("does not retain a reply parent that is absent from the loaded thread", () => {
    const { document } = parseHTML(html.replace('id="reply_list_801"', 'id="reply_list_999"'));
    const thread = extractThreadDcInside(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts[2]?.parentId).toBe("800");
  });
});
