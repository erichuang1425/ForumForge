import { createPost, normalizeWhitespace, cleanText } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import type { ExtractedThread, ExtractOptions } from "./types";
import { resolveUrl, documentBaseUrl } from "./url";

export type DiscourseExtractOptions = ExtractOptions;

const ROLE_KEYWORDS: { pattern: RegExp; role: ForumRole }[] = [
  { pattern: /\b(admin|administrator)\b/i, role: "admin" },
  { pattern: /\b(moderator|staff)\b/i, role: "mod" },
];

/** Discourse declares itself via this meta tag on every page, server-rendered or not. */
export function isDiscoursePage(root: ParentNode): boolean {
  const content = root.querySelector("meta[name='generator']")?.getAttribute("content") ?? "";
  return /\bDiscourse\b/i.test(content);
}

function extractTitle(root: ParentNode): string | undefined {
  const candidates = [root.querySelector("h1 a")?.textContent, root.querySelector("h1")?.textContent, root.querySelector("title")?.textContent];
  for (const candidate of candidates) {
    const text = candidate ? normalizeWhitespace(candidate) : "";
    if (text) return text;
  }
  return undefined;
}

function extractAuthor(post: Element, baseUrl?: string): { author?: string; authorUrl?: string } {
  const el = post.querySelector(".names .username");
  const text = el?.textContent ? normalizeWhitespace(el.textContent) : "";
  if (!el || !text) return {};
  const anchor = el.tagName.toLowerCase() === "a" ? el : el.querySelector("a");
  const href = anchor?.getAttribute("href");
  return { author: text, authorUrl: href ? resolveUrl(href, baseUrl) : undefined };
}

/**
 * Discourse renders timestamps as `<span class="relative-date" data-time="<epoch-ms>"
 * title="<long date>">` (see `autoUpdatingRelativeAge` in Discourse's own
 * `lib/formatter.js`) — there's no `<time datetime>` element to read.
 */
function extractTimestamp(post: Element): string | undefined {
  const el = post.querySelector(".post-date .relative-date");
  if (!el) return undefined;
  const dataTime = el.getAttribute("data-time");
  const ms = dataTime ? Number.parseInt(dataTime, 10) : NaN;
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const title = el.getAttribute("title");
  const text = el.textContent ? normalizeWhitespace(el.textContent) : "";
  return (title && title.trim()) || text || undefined;
}

function extractPermalink(post: Element, baseUrl?: string): string | undefined {
  const href = post.querySelector(".post-date a[href]")?.getAttribute("href");
  return href && href.trim() ? resolveUrl(href, baseUrl) : undefined;
}

function extractContent(post: Element): { text: string; html?: string } {
  const el = post.querySelector(".cooked");
  if (!el) return { text: post.textContent ? cleanText(post.textContent) : "" };
  const text = el.textContent ? cleanText(el.textContent) : "";
  return { text, html: el.innerHTML };
}

function extractLinks(post: Element, baseUrl?: string): string[] {
  const scope = post.querySelector(".cooked") ?? post;
  return Array.from(scope.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function pickId(post: Element): string | undefined {
  const postNumber = post.getAttribute("data-post-number");
  if (postNumber && postNumber.trim()) return postNumber.trim();
  const id = post.getAttribute("id");
  return id ? id.replace(/^post_/, "") : undefined;
}

/** `topic-owner` is Discourse's own class for the original poster; staff badges win over it. */
function resolveRole(post: Element): ForumRole | undefined {
  const badge = post.querySelector(".names .user-title, .names [class*='staff'], .names [class*='badge']");
  // Some themes signal staff/admin purely via class (icon-only badges), so check
  // the class name too, not just the badge's visible text.
  const haystack = `${badge?.textContent ?? ""} ${badge?.className ?? ""}`;
  for (const { pattern, role } of ROLE_KEYWORDS) {
    if (pattern.test(haystack)) return role;
  }
  if (post.classList.contains("topic-owner")) return "op";
  return undefined;
}

/**
 * Best-effort extraction of a Discourse topic page. Discourse's post structure
 * is consistent across forums (it's the same software everywhere), so this
 * targets Discourse's own class names directly rather than the generic
 * parser's heuristic selector lists.
 */
export function extractThreadDiscourse(
  root: ParentNode,
  options: DiscourseExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  // `.topic-post` is the outer wrapper div Discourse renders around each post;
  // the nested `<article>` only carries `boxed onscreen-post`, never `topic-post`
  // itself, so selecting `article.topic-post` matches nothing on a real forum.
  const posts = Array.from(root.querySelectorAll(".topic-post")).map((el) => {
    const { author, authorUrl } = extractAuthor(el, baseUrl);
    const { text, html } = extractContent(el);
    return createPost({
      id: pickId(el),
      author,
      authorUrl,
      role: resolveRole(el),
      timestamp: extractTimestamp(el),
      contentText: text,
      contentHtml: html,
      permalink: extractPermalink(el, baseUrl),
      links: extractLinks(el, baseUrl),
    });
  });

  const result: ExtractedThread = { posts };
  const title = extractTitle(root);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
