import { createPost, normalizeWhitespace, cleanText } from "@forumforge/core";
import type { ExtractedThread, ExtractOptions } from "./types";
import { resolveUrl, documentBaseUrl } from "./url";
import { ensureUniquePostIds } from "./ids";

export type HackerNewsExtractOptions = ExtractOptions;

const TITLE_SUFFIX = / \| Hacker News$/;

/**
 * True when the page is a Hacker News *item* (thread) page. `#hnmain` is HN's
 * own page wrapper, but it's also present on listing pages (front page, /new,
 * /ask, ...), which this extractor can't read (it only knows `tr.athing.comtr`
 * and `.toptext`). HN tags the page type on `<html op="...">`; only item pages
 * get `op="item"`, so that's the signal that distinguishes a real thread.
 */
export function isHackerNewsPage(root: ParentNode): boolean {
  if (root.querySelector("#hnmain") === null) return false;
  return root.querySelector("html")?.getAttribute("op") === "item";
}

function extractTitle(root: ParentNode): string | undefined {
  const storyTitle = root.querySelector(".titleline > a")?.textContent;
  const fromStory = storyTitle ? normalizeWhitespace(storyTitle) : "";
  if (fromStory) return fromStory;
  const docTitle = root.querySelector("title")?.textContent;
  const fromDoc = docTitle ? normalizeWhitespace(docTitle).replace(TITLE_SUFFIX, "") : "";
  return fromDoc || undefined;
}

/** The story's submitter, read from the subtext line above the comments — never a commenter's `.comhead`. */
function extractSubmitter(root: ParentNode): string | undefined {
  const text = root.querySelector(".subtext .hnuser")?.textContent;
  return text ? normalizeWhitespace(text) || undefined : undefined;
}

function extractAuthor(row: Element, baseUrl?: string): { author?: string; authorUrl?: string } {
  const el = row.querySelector(".comhead .hnuser");
  const text = el?.textContent ? normalizeWhitespace(el.textContent) : "";
  if (!text) return {};
  const href = el?.getAttribute("href");
  return { author: text, authorUrl: href ? resolveUrl(href, baseUrl) : undefined };
}

function extractTimestamp(row: Element): string | undefined {
  const el = row.querySelector(".comhead .age");
  if (!el) return undefined;
  const title = el.getAttribute("title");
  const text = el.textContent ? normalizeWhitespace(el.textContent) : "";
  return (title && title.trim()) || text || undefined;
}

function extractPermalink(row: Element, baseUrl?: string): string | undefined {
  const href = row.querySelector(".comhead .age a")?.getAttribute("href");
  return href && href.trim() ? resolveUrl(href, baseUrl) : undefined;
}

/** A deleted/flagged comment has no `.commtext` at all; degrade to an empty body rather than guessing. */
function extractContent(row: Element): { text: string; html?: string } {
  const el = row.querySelector(".commtext");
  if (!el) return { text: "" };
  const text = el.textContent ? cleanText(el.textContent) : "";
  return { text, html: el.innerHTML };
}

function extractLinks(row: Element, baseUrl?: string): string[] {
  const body = row.querySelector(".commtext");
  if (!body) return [];
  return Array.from(body.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

/** HN encodes nesting depth directly as the `indent` attribute on each row's indent cell. */
function extractDepth(row: Element): number {
  const indent = row.querySelector(".ind")?.getAttribute("indent");
  const depth = indent ? Number.parseInt(indent, 10) : 0;
  return Number.isFinite(depth) && depth > 0 ? depth : 0;
}

/**
 * A text submission (Ask HN, Show HN, or any self-post) renders its body as
 * `.toptext` above the comment rows, outside any `tr.athing.comtr` — so it's
 * never picked up by the comment-row loop. Link-only stories have no `.toptext`
 * at all, in which case there's no story post to add.
 */
function extractStoryPost(root: ParentNode, submitter: string | undefined, baseUrl?: string) {
  const toptext = root.querySelector(".toptext");
  if (!toptext) return undefined;

  const storyId = root.querySelector("tr.athing:not(.comtr)")?.getAttribute("id") ?? undefined;
  const authorHref = root.querySelector(".subtext .hnuser")?.getAttribute("href");
  const ageEl = root.querySelector(".subtext .age");
  const ageTitle = ageEl?.getAttribute("title");
  const ageText = ageEl?.textContent ? normalizeWhitespace(ageEl.textContent) : "";
  const permalinkHref = root.querySelector(".subtext .age a")?.getAttribute("href");

  return createPost({
    id: storyId,
    author: submitter,
    authorUrl: authorHref ? resolveUrl(authorHref, baseUrl) : undefined,
    role: submitter ? "op" : undefined,
    timestamp: (ageTitle && ageTitle.trim()) || ageText || undefined,
    contentText: toptext.textContent ? cleanText(toptext.textContent) : "",
    contentHtml: toptext.innerHTML,
    permalink: permalinkHref && permalinkHref.trim() ? resolveUrl(permalinkHref, baseUrl) : undefined,
    depth: 0,
    links: Array.from(toptext.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href"))
      .filter((href): href is string => Boolean(href && href.trim()))
      .map((href) => resolveUrl(href, baseUrl)),
  });
}

/**
 * Best-effort extraction of a Hacker News item page (`news.ycombinator.com/item?id=...`).
 *
 * HN's comments are a flat list of `tr.athing.comtr` rows, not a nested tree, so
 * `parentId` is reconstructed from each row's `indent` depth: the most recent row
 * seen at `depth - 1` is the parent. Comments by the story's own submitter are
 * marked `role: "op"`, the same convention the generic parser and other adapters
 * use for thread-starter highlighting.
 */
export function extractThreadHackerNews(
  root: ParentNode,
  options: HackerNewsExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const submitter = extractSubmitter(root);
  const lastIdAtDepth: string[] = [];

  const storyPost = extractStoryPost(root, submitter, baseUrl);
  const commentPosts = Array.from(root.querySelectorAll("tr.athing.comtr")).map((row) => {
    const id = row.getAttribute("id") ?? undefined;
    const depth = extractDepth(row);
    const parentId = depth > 0 ? lastIdAtDepth[depth - 1] : undefined;
    if (id) lastIdAtDepth[depth] = id;
    lastIdAtDepth.length = depth + 1; // discard stale deeper ancestors once the tree pops back up

    const { author, authorUrl } = extractAuthor(row, baseUrl);
    const { text, html } = extractContent(row);
    return createPost({
      id,
      author,
      authorUrl,
      role: author && submitter && author === submitter ? "op" : undefined,
      timestamp: extractTimestamp(row),
      contentText: text,
      contentHtml: html,
      permalink: extractPermalink(row, baseUrl),
      parentId,
      depth,
      links: extractLinks(row, baseUrl),
    });
  });

  const posts = ensureUniquePostIds(storyPost ? [storyPost, ...commentPosts] : commentPosts);
  const result: ExtractedThread = { posts };
  const title = extractTitle(root);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
