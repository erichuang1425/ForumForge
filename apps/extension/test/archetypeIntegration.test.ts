import { readFileSync } from "node:fs";
import type { ExtractedThread } from "@forumforge/parser";
import {
  extractThreadArca,
  extractThreadDcInside,
  extractThreadFmKorea,
  extractThreadFourChan,
  extractThreadHackerNews,
  extractThreadNairaland,
  extractThreadPtt,
  extractThreadStackOverflow,
} from "@forumforge/parser";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { renderPageThread } from "../src/pageThreadRenderer";

type Extractor = (
  root: ParentNode,
  options: { baseUrl?: string },
) => ExtractedThread;

type RenderedFixture = {
  root: HTMLElement;
  thread: ExtractedThread;
};

function renderFixture(
  fixture: string,
  baseUrl: string,
  extract: Extractor,
): RenderedFixture {
  const source = readFileSync(
    new URL(`../../../packages/parser/test/fixtures/${fixture}`, import.meta.url),
    "utf8",
  );
  const page = parseHTML(source).document;
  const thread = extract(page as unknown as ParentNode, { baseUrl });
  const panel = parseHTML("<!doctype html><html><body></body></html>").document;
  const root = renderPageThread(panel as unknown as Document, thread);
  return { root, thread };
}

function renderedPostIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".ff-post")).map(
    (post) => post.getAttribute("data-post-id") ?? "",
  );
}

function expectEveryPostExactlyOnce(root: ParentNode, thread: ExtractedThread): void {
  expect(renderedPostIds(root)).toEqual(thread.posts.map((post) => post.id));
}

function expectNoActiveEmbeddedMedia(root: ParentNode): void {
  expect(
    root.querySelector(
      "img, picture, source, video, audio, iframe, frame, object, embed, script, style, link",
    ),
  ).toBeNull();
}

describe("parser to discussion-aware reader integration", () => {
  it("keeps Nairaland's linear topic roles and post order", () => {
    const { root, thread } = renderFixture(
      "nairaland-thread.html",
      "https://www.nairaland.com/900100/restoring-pocket-radio",
      extractThreadNairaland,
    );

    expect(root.getAttribute("data-layout")).toBe("linear");
    expect(root.getAttribute("data-source")).toBe("nairaland");
    expect(root.querySelector("[data-post-id='900101'] .ff-post__role")?.textContent).toBe(
      "OP",
    );
    expect(root.querySelector("[data-post-id='900103'] .ff-post__role")?.textContent).toBe(
      "Mod",
    );
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });

  it("reconstructs Hacker News reply branches through the rendered third level", () => {
    const { root, thread } = renderFixture(
      "hackernews-thread.html",
      "https://news.ycombinator.com/item?id=1000",
      extractThreadHackerNews,
    );

    expect(root.getAttribute("data-layout")).toBe("nested");
    expect(root.getAttribute("data-source")).toBe("hacker-news");
    expect(
      root.querySelector("[data-post-id='1001'] > .ff-posts--branch [data-post-id='1002']"),
    ).not.toBeNull();
    expect(
      root.querySelector("[data-post-id='1002'] > .ff-posts--branch [data-post-id='1003']"),
    ).not.toBeNull();
    expect(root.querySelector("[data-post-id='1003']")?.getAttribute("data-visual-depth")).toBe(
      "2",
    );
    expect(root.querySelector("[data-post-id='1003'] .ff-post__branch-level")?.textContent).toBe(
      "Reply level 2",
    );
    expect(root.querySelector("[data-post-id='1002'] .ff-post__role")?.textContent).toBe(
      "OP",
    );
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });

  it("separates PTT's article from push, neutral, and boo reactions", () => {
    const { root, thread } = renderFixture(
      "ptt-thread.html",
      "https://www.ptt.cc/bbs/FixIt/M.1784164440.A.123.html",
      extractThreadPtt,
    );

    expect(root.getAttribute("data-layout")).toBe("ptt");
    expect(root.getAttribute("data-source")).toBe("ptt");
    expect(root.querySelector(".ff-page-thread__lead [data-post-id='article']")).not.toBeNull();
    expect(
      Array.from(root.querySelectorAll(".ff-page-thread__reactions .ff-post__reaction")).map(
        (reaction) => reaction.textContent,
      ),
    ).toEqual(["Push", "Neutral", "Boo"]);
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });

  it("preserves 4chan numbers, tripcodes, capcodes, quotes, and inert attachments", () => {
    const { root, thread } = renderFixture(
      "fourchan-thread.html",
      "https://boards.4chan.org/tg/thread/100/restoring-a-tabletop-radio",
      extractThreadFourChan,
    );

    expect(root.getAttribute("data-layout")).toBe("imageboard");
    expect(root.getAttribute("data-source")).toBe("4chan");
    expect(root.querySelector(".ff-post__avatar")).toBeNull();
    expect(root.querySelector("[data-post-id='100'] .ff-post__ordinal")?.textContent).toBe(
      "No. 100",
    );
    expect(root.querySelector("[data-post-id='100'] .ff-post__author")?.textContent).toBe(
      "ivy !radio",
    );
    expect(root.querySelector("[data-post-id='101'] .ff-post__role")?.textContent).toBe(
      "Mod",
    );
    expect(root.querySelector("[data-post-id='100'] .ff-post__body")?.textContent).toContain(
      "receiver.png",
    );
    expect(root.querySelector("[data-post-id='101'] .ff-post__body")?.textContent).toContain(
      ">>100",
    );
    expect(
      Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-post-id='101'] a")).some(
        (link) => link.getAttribute("href")?.endsWith("#p100") ?? false,
      ),
    ).toBe(true);
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });

  it.each([
    {
      name: "Arca.live",
      fixture: "arca-thread.html",
      baseUrl: "https://arca.live/b/tools/700",
      extract: extractThreadArca,
      source: "arca",
      articleId: "700",
      commentId: "701",
      replyId: "702",
    },
    {
      name: "DC Inside",
      fixture: "dcinside-thread.html",
      baseUrl: "https://gall.dcinside.com/board/view/?id=tools&no=800",
      extract: extractThreadDcInside,
      source: "dc-inside",
      articleId: "800",
      commentId: "801",
      replyId: "802",
    },
    {
      name: "FMKorea",
      fixture: "fmkorea-thread.html",
      baseUrl: "https://www.fmkorea.com/index.php?document_srl=9000&mid=best",
      extract: extractThreadFmKorea,
      source: "fmkorea",
      articleId: "9000",
      commentId: "9001",
      replyId: "9002",
    },
  ])("renders $name as an article with its native comment branch", (site) => {
    const { root, thread } = renderFixture(site.fixture, site.baseUrl, site.extract);

    expect(root.getAttribute("data-layout")).toBe("article-comments");
    expect(root.getAttribute("data-source")).toBe(site.source);
    expect(
      root.querySelector(`.ff-page-thread__lead [data-post-id='${site.articleId}']`),
    ).not.toBeNull();
    expect(
      root.querySelector(
        `[data-post-id='${site.commentId}'] > .ff-posts--branch [data-post-id='${site.replyId}']`,
      ),
    ).not.toBeNull();
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });

  it("keeps Stack Overflow's question, scores, accepted answer, and answer comments", () => {
    const { root, thread } = renderFixture(
      "stackoverflow-question.html",
      "https://stackoverflow.com/questions/700/how-should-i-restore-an-old-radio",
      extractThreadStackOverflow,
    );

    expect(root.getAttribute("data-layout")).toBe("qa");
    expect(root.getAttribute("data-source")).toBe("stack-overflow");
    expect(root.querySelector(".ff-page-thread__question [data-post-id='700']")).not.toBeNull();
    expect(root.querySelector("[data-post-id='700'] .ff-post__score")?.textContent).toBe(
      "12 votes",
    );
    expect(root.querySelector("[data-post-id='710'] .ff-post__accepted")?.textContent).toBe(
      "Accepted answer",
    );
    expect(root.querySelector("[data-post-id='710'] .ff-post__score")?.textContent).toBe(
      "7 votes",
    );
    expect(root.querySelector("[data-post-id='720'] .ff-post__score")?.textContent).toBe(
      "-2 votes",
    );
    expect(
      root.querySelector("[data-post-id='710'] > .ff-posts--branch [data-post-id='711']"),
    ).not.toBeNull();
    expectEveryPostExactlyOnce(root, thread);
    expectNoActiveEmbeddedMedia(root);
  });
});
