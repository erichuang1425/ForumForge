import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadVBulletin, isVBulletinPage } from "../src/vbulletin";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "vbulletin-thread.html"), "utf8");
const baseUrl = "https://board.example.test/showthread.php?42";

function extract(source = html, options: { baseUrl?: string } = { baseUrl }) {
  const { document } = parseHTML(source);
  return extractThreadVBulletin(document as unknown as ParentNode, options);
}

describe("isVBulletinPage", () => {
  it("detects a vBulletin 4 showthread page with a coherent stock postbit", () => {
    const { document } = parseHTML(html);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not flag a vBulletin forum index that lacks the showthread title", () => {
    const forumIndex = html.replace('class="threadtitle"', 'class="forumtitle"');
    const { document } = parseHTML(forumIndex);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag unrelated markup that imitates postbit classes", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <div id="pagetitle"><span class="threadtitle">Not a forum</span></div>
      <li class="postbitlegacy" id="post_1"><div class="postbody"></div>
        <a class="postcounter" href="#post1">#1</a>
      </li>
    </body></html>`);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects other vBulletin major versions", () => {
    const otherVersion = html.replace(
      'content="vBulletin 4.2.5"',
      'content="vBulletin 5.7.5"',
    );
    const { document } = parseHTML(otherVersion);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects a postbit whose numeric container and permalink disagree", () => {
    const malformed = `<!doctype html><html id="vbulletin_html"><head>
      <meta name="generator" content="vBulletin 4.2.5" /></head><body>
      <div id="pagetitle"><span class="threadtitle">Thread</span></div>
      <li class="postbitlegacy" id="post_1"><div class="postbody"></div>
        <a class="postcounter" href="showthread.php?1#post2">#1</a>
      </li></body></html>`;
    const { document } = parseHTML(malformed);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadVBulletin", () => {
  it("extracts the thread title and stable numeric post ids", () => {
    const thread = extract();
    expect(thread.title).toBe("Calibrating a pocket sensor");
    expect(thread.posts).toHaveLength(4);
    expect(thread.posts.map((post) => post.id)).toEqual(["801", "802", "803", "804"]);
  });

  it("supports both horizontal and legacy stock postbit containers", () => {
    const { document } = parseHTML(html);
    const containers = Array.from(document.querySelectorAll("#posts > li"));
    expect(containers[0]?.classList.contains("postbit")).toBe(true);
    expect(containers[1]?.classList.contains("postbitlegacy")).toBe(true);
    expect(extract().posts).toHaveLength(4);
  });

  it("captures authors, timestamps, profile URLs, and permalinks", () => {
    const [first] = extract().posts;
    expect(first?.author).toBe("ada");
    expect(first?.timestamp).toBe("Jun 10, 2026 09:00 AM");
    expect(first?.authorUrl).toBe("https://board.example.test/member.php?11");
    expect(first?.permalink).toBe("https://board.example.test/showthread.php?42#post801");
  });

  it("captures cleaned message text, raw message HTML, and message links only", () => {
    const [first] = extract().posts;
    expect(first?.contentText).toContain("baseline drifts");
    expect(first?.contentHtml).toContain("reference card");
    expect(first?.links).toEqual(["https://example.test/reference"]);
  });

  it("recognizes explicit English moderator and administrator titles", () => {
    const posts = extract().posts;
    expect(posts[1]?.role).toBe("mod");
    expect(posts[2]?.role).toBe("admin");
  });

  it("does not treat a generic staff display label as moderator authority", () => {
    const staffOnly = html.replace(">Member<", ">Staff<");
    expect(extract(staffOnly).posts[0]?.role).toBeUndefined();
  });

  it("does not infer op from the first visible author or repeated display names", () => {
    const posts = extract().posts;
    expect(posts[0]?.author).toBe("ada");
    expect(posts[0]?.role).toBeUndefined();
    expect(posts[3]?.author).toBe("ada");
    expect(posts[3]?.role).toBeUndefined();
  });

  it("degrades missing author, timestamp, and message fields without profile leakage", () => {
    const sparse = `<!doctype html><html id="vbulletin_html"><head>
      <meta name="generator" content="vBulletin 4.2.5" /></head><body>
      <div id="pagetitle"><span class="threadtitle">Sparse thread</span></div>
      <li class="postbitlegacy" id="post_900">
        <div class="posthead"><a class="postcounter" href="#post900">#1</a></div>
        <div class="postdetails"><div class="userinfo">profile metadata</div>
          <div class="postbody"></div>
        </div>
      </li></body></html>`;
    const { document } = parseHTML(sparse);
    expect(isVBulletinPage(document as unknown as ParentNode)).toBe(true);
    const thread = extractThreadVBulletin(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "900", author: "Unknown", contentText: "" });
    expect(thread.posts[0]?.timestamp).toBeUndefined();
    expect(thread.posts[0]?.contentHtml).toBeUndefined();
    expect(thread.posts[0]?.links).toBeUndefined();
  });

  it("handles malformed and unsafe URLs as untrusted parser data without throwing", () => {
    const hostile = html
      .replace('href="member.php?11"', 'href="http://["')
      .replace('href="https://example.test/reference"', 'href="javascript:alert(1)"');
    const [first] = extract(hostile, { baseUrl: "not a valid absolute URL" }).posts;
    expect(first?.authorUrl).toBe("http://[");
    expect(first?.links).toEqual(["javascript:alert(1)"]);
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });

  it("skips a post whose numeric container and permalink disagree", () => {
    const mismatched = html.replace(
      'href="showthread.php?42#post804" class="postcounter"',
      'href="showthread.php?42#post999" class="postcounter"',
    );
    expect(extract(mismatched).posts.map((post) => post.id)).toEqual(["801", "802", "803"]);
  });
});
