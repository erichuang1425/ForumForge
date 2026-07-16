import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadStackOverflow, isStackOverflowPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "stackoverflow-question.html"), "utf8");
const baseUrl = "https://stackoverflow.com/questions/700/how-should-i-restore-an-old-radio";

function extract(markup = html) {
  const { document } = parseHTML(markup);
  return extractThreadStackOverflow(document as unknown as ParentNode, { baseUrl });
}

describe("isStackOverflowPage", () => {
  it("detects a coherent numeric question page", () => {
    const { document } = parseHTML(html);
    expect(isStackOverflowPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not select a question list", () => {
    const { document } = parseHTML(`<!doctype html><html><body>
      <h2><a class="question-hyperlink" href="/questions/700/example">Example</a></h2>
    </body></html>`);
    expect(isStackOverflowPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects a title link that disagrees with the question identity", () => {
    const { document } = parseHTML(html.replace("/questions/700/", "/questions/999/"));
    expect(isStackOverflowPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadStackOverflow", () => {
  it("extracts the question, visible comments, answers, and answer comments in reading order", () => {
    const thread = extract();
    expect(thread.title).toBe("How should I restore an old radio?");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["700", "701", "702", "710", "711", "720"]);
  });

  it("preserves question identity, timestamp, rich text, permalink, and body links", () => {
    expect(extract().posts[0]).toMatchObject({
      id: "700",
      author: "ivy",
      authorUrl: "https://stackoverflow.com/users/42/ivy",
      role: "op",
      timestamp: "2026-07-16 15:00:00Z",
      contentText: expect.stringContaining("I cleaned the contacts"),
      permalink: "https://stackoverflow.com/q/700",
      links: ["https://stackoverflow.com/questions/699/related-repair"],
      depth: 0,
    });
    expect(extract().posts[0]?.contentHtml).toContain("<code>");
  });

  it("uses exact user identity for OP comments and answers", () => {
    const [, regularComment, opComment, answer, , opAnswer] = extract().posts;
    expect(regularComment).toMatchObject({ author: "mira", parentId: "700", depth: 1 });
    expect(regularComment?.role).toBeUndefined();
    expect(opComment).toMatchObject({ author: "ivy", role: "op", parentId: "700", depth: 1 });
    expect(answer).toMatchObject({ author: "mira", parentId: "700", depth: 1 });
    expect(opAnswer).toMatchObject({ author: "ivy", role: "op", parentId: "700", depth: 1 });
  });

  it("parents answer comments to their answer and strips license text from timestamps", () => {
    expect(extract().posts[4]).toMatchObject({
      id: "711",
      author: "sol",
      timestamp: "2026-07-16 15:22:00Z",
      parentId: "710",
      depth: 2,
      permalink: `${baseUrl}#comment711_710`,
    });
  });

  it("uses local text for an otherwise unreadable media-only answer", () => {
    expect(extract().posts[5]?.contentText).toBe(
      "[Media omitted — open the original thread to view it.]",
    );
  });

  it("skips answers with incoherent identity, parent, or share permalinks", () => {
    const identity = extract(html.replace('id="answer-710"', 'id="answer-999"'));
    const parent = extract(html.replaceAll('data-parentid="700"', 'data-parentid="999"'));
    const permalink = extract(html.replace('href="/a/710"', 'href="/a/999"'));
    expect(identity.posts.map((post) => post.id)).toEqual(["700", "701", "702", "720"]);
    expect(parent.posts.map((post) => post.id)).toEqual(["700", "701", "702"]);
    expect(permalink.posts.map((post) => post.id)).toEqual(["700", "701", "702", "720"]);
  });

  it("skips comments with incoherent element or parent-post permalinks", () => {
    const element = extract(html.replace('id="comment-701"', 'id="comment-999"'));
    const parent = extract(html.replace("#comment711_710", "#comment711_999"));
    expect(element.posts.map((post) => post.id)).not.toContain("701");
    expect(parent.posts.map((post) => post.id)).not.toContain("711");
  });

  it("does not borrow identity for a deleted comment", () => {
    const markup = html
      .replace('<a class="comment-user" href="/users/88/sol">sol</a>', "")
      .replace("Start with the power supply.", "Comment removed.");
    const deleted = extract(markup).posts.find((post) => post.id === "711");
    expect(deleted).toMatchObject({ author: "Unknown", contentText: "Comment removed." });
    expect(deleted?.authorUrl).toBeUndefined();
    expect(deleted?.role).toBeUndefined();
  });
});
