import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { extractThreadFourChan, isFourChanPage } from "../src/index";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "fixtures", "fourchan-thread.html"), "utf8");
const baseUrl = "https://boards.4chan.org/tg/thread/100/restoring-a-tabletop-radio";

function extract() {
  const { document } = parseHTML(html);
  return extractThreadFourChan(document as unknown as ParentNode, { baseUrl });
}

describe("isFourChanPage", () => {
  it("detects a signed thread with coherent post, message, and permalink ids", () => {
    const { document } = parseHTML(html);
    expect(isFourChanPage(document as unknown as ParentNode)).toBe(true);
  });

  it("does not select a board index even when it contains thread markup", () => {
    const { document } = parseHTML(html.replace('class="is_thread board_tg"', 'class="is_index board_tg"'));
    expect(isFourChanPage(document as unknown as ParentNode)).toBe(false);
  });

  it("rejects an is_thread lookalike with mismatched numeric ids", () => {
    const { document } = parseHTML(`<!doctype html><html><body class="is_thread">
      <div class="board"><div class="thread"><div class="postContainer opContainer">
        <div class="post op" id="p10"><div class="postInfo"><span class="postNum">
          <a href="#p11">No.11</a></span></div><blockquote class="postMessage" id="m12">No</blockquote>
        </div></div></div></div></body></html>`);
    expect(isFourChanPage(document as unknown as ParentNode)).toBe(false);
  });
});

describe("extractThreadFourChan", () => {
  it("extracts the subject and every numeric post in document order", () => {
    const thread = extract();
    expect(thread.title).toBe("Restoring a tabletop radio");
    expect(thread.baseUrl).toBe(baseUrl);
    expect(thread.posts.map((post) => post.id)).toEqual(["100", "101", "102", "103"]);
  });

  it("keeps attachment metadata inert while preserving its link", () => {
    const [op] = extract().posts;
    expect(op).toMatchObject({
      author: "ivy !radio",
      role: "op",
      timestamp: "07/16/26(Thu)10:00:00",
      permalink: "https://boards.4chan.org/tg/thread/100#p100",
      contentText: expect.stringContaining("File: receiver.png (120 KB)"),
      contentHtml: expect.stringContaining("receiver.png"),
      links: [
        "https://boards.4chan.org/tg/src/100.png",
        "https://boards.4chan.org/tg/thread/90#p90",
      ],
    });
    expect(op?.contentHtml).not.toContain("<img");
  });

  it("uses explicit capcodes for roles and never infers them from a name", () => {
    const [, moderator, lookalike] = extract().posts;
    expect(moderator).toMatchObject({ author: "mira", role: "mod" });
    expect(lookalike).toMatchObject({ author: "ModeratorFan" });
    expect(lookalike?.role).toBeUndefined();
  });

  it("recognizes an explicit administrator capcode", () => {
    const { document } = parseHTML(
      html.replace('class="capcode id_mod">## Mod', 'class="capcode id_admin">## Admin'),
    );
    const thread = extractThreadFourChan(document as unknown as ParentNode, { baseUrl });
    expect(thread.posts[1]?.role).toBe("admin");
  });

  it("uses the first local quote as parent without inventing deeper nesting", () => {
    const [, firstReply, secondReply] = extract().posts;
    expect(firstReply).toMatchObject({ parentId: "100", depth: 1 });
    expect(secondReply).toMatchObject({ parentId: "101", depth: 1 });
  });

  it("degrades a deleted or empty reply without borrowing prior fields", () => {
    const missing = extract().posts.at(-1);
    expect(missing).toMatchObject({
      id: "103",
      author: "Unknown",
      contentText: "",
      permalink: "https://boards.4chan.org/tg/thread/100/restoring-a-tabletop-radio#p103",
      parentId: "100",
      depth: 1,
    });
    expect(missing?.timestamp).toBeUndefined();
    expect(missing?.role).toBeUndefined();
  });
});
