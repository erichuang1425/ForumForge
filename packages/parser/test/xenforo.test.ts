import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadXenForo, isXenForoPage } from "../src/xenforo";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "xenforo-thread.html"), "utf8");
const baseUrl = "https://community.example.test/threads/calibrating-a-pocket-sensor.42/";

function extract(source = html, options: { baseUrl?: string } = { baseUrl }) {
  const { document } = parseHTML(source);
  return extractThreadXenForo(document as unknown as ParentNode, options);
}

describe("isXenForoPage", () => {
  it("detects a public thread view with a coherent stock post shell", () => {
    const { document } = parseHTML(html);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(true);
  });

  it("accepts XenForo's observed html template-marker mirror", () => {
    const mirrored = html
      .replace('data-app="public">', 'data-app="public" data-template="thread_view">')
      .replace('<body data-template="thread_view">', "<body>");
    const { document } = parseHTML(mirrored);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(true);
  });

  it("detects and extracts a question thread without inferring OP from its vote order", () => {
    const question = html
      .replace('data-template="thread_view"', 'data-template="thread_view_type_question"')
      .replace(
        '<div class="block-body js-replyNewMessageContainer">',
        '<div class="block-body js-replyNewMessageContainer"><div class="question-vote">Votes</div>',
      );
    const { document } = parseHTML(question);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(true);
    const thread = extractThreadXenForo(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts).toHaveLength(4);
    expect(thread.posts[0]?.role).toBeUndefined();
    expect(thread.posts[2]?.role).toBeUndefined();
  });

  it.each(["2.2", "2.30"])("does not claim unsupported XenForo version %s", (version) => {
    const unsupported = html.replace('data-xf="2.3"', `data-xf="${version}"`);
    const { document } = parseHTML(unsupported);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag a XenForo forum index with generic message-like markup", () => {
    const forumIndex = html.replace(
      'data-template="thread_view"',
      'data-template="forum_view"',
    );
    const { document } = parseHTML(forumIndex);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(false);
  });

  it("does not flag an unrelated page that imitates generic message classes", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <article class="message message--post js-post" data-content="post-1" id="js-post-1">
        <div class="message-inner"><div class="message-cell--main">Not a forum thread.</div></div>
      </article>
    </body></html>`);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects a thread signature whose post id and data-content disagree", () => {
    const mismatched = html.replace('id="js-post-701"', 'id="js-post-999"');
    const { document } = parseHTML(mismatched);
    const first = document.querySelector("article.message--post");
    first?.parentNode?.replaceChildren(first);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadXenForo", () => {
  it("extracts the thread title and every numeric post container", () => {
    const thread = extract();
    expect(thread.title).toBe("Calibrating a pocket sensor");
    expect(thread.posts).toHaveLength(4);
    expect(thread.posts.map((post) => post.id)).toEqual(["701", "702", "703", "704"]);
  });

  it("captures authors, timestamps, profile URLs, and permalinks", () => {
    const [first] = extract().posts;
    expect(first?.author).toBe("ada");
    expect(first?.timestamp).toBe("2026-06-01T09:00:00+00:00");
    expect(first?.authorUrl).toBe("https://community.example.test/members/ada.11/");
    expect(first?.permalink).toBe(
      "https://community.example.test/threads/calibrating-a-pocket-sensor.42/post-701",
    );
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

  it("recognizes moderator and administrator profile labels", () => {
    const posts = extract().posts;
    expect(posts[1]?.role).toBe("mod");
    expect(posts[3]?.role).toBe("admin");
  });

  it("does not treat XenForo's staff display flag as moderator authority", () => {
    const staffOnly = html.replace("<strong>Moderator</strong>", "<strong>Staff member</strong>");
    const posts = extract(staffOnly).posts;
    expect(posts[1]?.role).toBeUndefined();
  });

  it("keeps OP unset across later-page, direct-post, and sorted URLs", () => {
    const urls = [
      "https://community.example.test/threads/calibrating-a-pocket-sensor.42/page-2",
      "https://community.example.test/posts/703/",
      "https://community.example.test/threads/calibrating-a-pocket-sensor.42/?order=post_date",
    ];

    for (const baseUrl of urls) {
      const posts = extract(html, { baseUrl }).posts;
      expect(posts[0]?.role).toBeUndefined();
      expect(posts[2]?.role).toBeUndefined();
      expect(posts[1]?.role).toBe("mod");
    }
  });

  it("handles the stock article thread's alternate author profile layout", () => {
    const article = `<!doctype html><html id="XF" data-xf="2.3" data-app="public"><body
      data-template="thread_view_type_article">
      <h1 class="p-title-value">Synthetic article thread</h1>
      <article class="message message--article js-post" data-author="ivy"
        data-content="post-950" id="js-post-950">
        <div class="message-inner"><div class="message-cell message-cell--main">
          <header class="message-attribution"><ul class="message-attribution-main"><li>
            <a href="/threads/synthetic.50/post-950"><time class="u-dt"
              datetime="2026-06-03T08:00:00+00:00">Jun 3</time></a>
          </li></ul></header>
          <article class="message-body"><div class="bbWrapper">Article body.</div></article>
        </div></div>
        <aside class="message-articleUserInfo"><div class="message-articleUserName">
          <a class="username" href="/members/ivy.50/"><span
            class="username--staff username--moderator username--admin">ivy</span></a>
        </div></aside>
      </article></body></html>`;
    const { document } = parseHTML(article);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(true);
    const [post] = extractThreadXenForo(document as unknown as ParentNode, { baseUrl }).posts;
    expect(post).toMatchObject({
      id: "950",
      author: "ivy",
      authorUrl: "https://community.example.test/members/ivy.50/",
      role: "admin",
      contentText: "Article body.",
    });
  });

  it("degrades missing author, timestamp, and body fields without pulling in profile text", () => {
    const sparse = `<!doctype html><html id="XF" data-xf="2.3" data-app="public">
      <body data-template="thread_view"><h1 class="p-title-value">Sparse thread</h1>
        <article class="message message--post js-post" data-content="post-900" id="js-post-900">
          <div class="message-inner"><aside class="message-cell message-cell--user">profile metadata</aside>
            <div class="message-cell message-cell--main"></div>
          </div>
        </article>
      </body></html>`;
    const { document } = parseHTML(sparse);
    expect(isXenForoPage(document as unknown as ParentNode)).toBe(true);
    const thread = extractThreadXenForo(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "900", author: "Unknown", contentText: "" });
    expect(thread.posts[0]?.timestamp).toBeUndefined();
    expect(thread.posts[0]?.contentHtml).toBeUndefined();
    expect(thread.posts[0]?.links).toBeUndefined();
  });

  it("handles malformed page and link URLs as inert parser data without throwing", () => {
    const hostile = html
      .replace('href="/members/ada.11/"', 'href="http://["')
      .replace('href="https://example.test/reference"', 'href="javascript:alert(1)"');
    const [first] = extract(hostile, { baseUrl: "not a valid absolute URL" }).posts;
    expect(first?.authorUrl).toBe("http://[");
    expect(first?.links).toEqual(["javascript:alert(1)"]);
    expect(first?.role).toBeUndefined();
  });

  it("exposes the resolved base URL on the thread", () => {
    expect(extract().baseUrl).toBe(baseUrl);
  });
});
