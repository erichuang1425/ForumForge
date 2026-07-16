import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadPtt, isPttPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "ptt-thread.html"), "utf8");
const baseUrl = "https://www.ptt.cc/bbs/FixIt/M.1784164440.A.123.html";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadPtt(document as unknown as ParentNode, { baseUrl });
}

describe("isPttPage", () => {
  it("detects an article from its content shell, metadata labels, and station footer", () => {
    const { document } = parseHTML(html);
    expect(isPttPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag a PTT board index", () => {
    const { document } = parseHTML(`<!doctype html><html><body><div id="main-container">
      <div class="r-ent"><div class="title"><a href="/bbs/FixIt/M.1.html">Topic</a></div></div>
    </div></body></html>`);
    expect(isPttPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag a lookalike chat widget with push classes", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div id="main-content" class="bbs-screen bbs-content">
        <div class="article-metaline"><span class="article-meta-tag">Title</span>
          <span class="article-meta-value">Not PTT</span></div>
        <div class="push"><span class="push-userid">ada</span></div>
      </div></body></html>`);
    expect(isPttPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadPtt", () => {
  it("extracts the article and every push with deterministic ids", () => {
    const thread = extract();
    expect(thread.title).toBe("[討論] 修理舊收音機");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual([
      "article",
      "push-1",
      "push-2",
      "push-3",
    ]);
  });

  it("keeps article metadata out of the OP body while preserving body links", () => {
    const [article] = extract().posts;
    expect(article).toMatchObject({
      author: "ada (阿達)",
      role: "op",
      timestamp: "Thu Jul 16 09:14:00 2026",
      permalink: baseUrl,
      contentText: expect.stringContaining("頻率會慢慢偏移"),
      contentHtml: expect.stringContaining("前一篇筆記"),
      links: ["https://www.ptt.cc/bbs/FixIt/M.1000000000.A.001.html"],
    });
    expect(article?.contentText).not.toContain("批踢踢實業坊");
    expect(article?.contentText).not.toContain("先清潔接點");
    expect(article?.contentHtml).not.toContain("article-metaline");
    expect(article?.contentHtml).not.toContain("批踢踢實業坊");
    expect(article?.contentHtml).not.toContain("class=\"push\"");
  });

  it("preserves push direction, author, timestamp, and article relationship", () => {
    const [, firstPush, opPush] = extract().posts;
    expect(firstPush).toMatchObject({
      author: "bisi",
      contentText: "推 先清潔接點再換電容。",
      timestamp: "07/16 09:32",
      parentId: "article",
      depth: 1,
      permalink: baseUrl,
    });
    expect(opPush).toMatchObject({ author: "ada", role: "op" });
  });

  it("degrades an empty push without borrowing the previous reply", () => {
    const last = extract().posts.at(-1);
    expect(last).toMatchObject({
      id: "push-3",
      author: "Unknown",
      contentText: "噓",
      parentId: "article",
    });
    expect(last?.timestamp).toBeUndefined();
    expect(last?.role).toBeUndefined();
  });
});
