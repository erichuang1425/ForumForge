import { createPost, normalizeWhitespace, cleanText } from "@forumforge/core";
import type { ForumForgePost, ForumRole } from "@forumforge/core";

/** Result of extracting a thread: optional title plus the posts found. */
export type ExtractedThread = {
  title?: string;
  /**
   * Absolute base URL of the page the thread came from, when known. Consumers
   * use it to resolve any relative URLs still embedded in a post's
   * `contentHtml` (which is captured as raw `innerHTML`, so its hrefs are not
   * pre-resolved like `permalink`/`links`/`authorUrl` are).
   */
  baseUrl?: string;
  posts: ForumForgePost[];
};

export type GenericExtractOptions = {
  /**
   * Base URL used to resolve relative permalinks and links. In a real browser
   * the DOM resolves these already; pass it when parsing detached HTML (tests,
   * fixtures, off-DOM processing).
   */
  baseUrl?: string;
};

// Heuristic selector lists, most specific first. The generic parser is allowed
// to be imperfect — its job is best-effort extraction until a real adapter exists.
const POST_CONTAINERS = [
  "article",
  ".post",
  ".message",
  ".comment",
  ".topic-post",
  "[id^='post-']",
  "[id^='post_']",
  "li.comment",
];

const AUTHOR_SELECTORS = [
  "[itemprop='author']",
  "a[rel='author']",
  ".author",
  ".username",
  ".user",
  ".poster",
  ".fn",
];

const TIME_SELECTORS = ["time", ".date", ".timestamp", ".post-date", ".created"];

const CONTENT_SELECTORS = [
  ".post-body",
  ".message-body",
  ".post-content",
  ".entry-content",
  ".comment-body",
  "[itemprop='text']",
  ".content",
  ".body",
];

const PERMALINK_SELECTORS = [
  ".post-number a",
  "a.permalink",
  "a[href*='#post']",
  "a[href*='#p']",
];

const ROLE_NODE_SELECTORS = [".role", ".user-title", ".usertitle", ".badge", ".label", ".rank"];

const ROLE_KEYWORDS: { pattern: RegExp; role: ForumRole }[] = [
  { pattern: /\b(admin|administrator)\b/i, role: "admin" },
  { pattern: /\b(moderator|mod|staff)\b/i, role: "mod" },
  { pattern: /\b(original poster|op|topic starter|thread starter)\b/i, role: "op" },
];

function resolveUrl(href: string, baseUrl?: string): string {
  const trimmed = href.trim();
  if (!baseUrl) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

/**
 * The base URL to resolve relative links against when the caller passes none.
 * On a live page `getAttribute("href")` returns the raw, possibly-relative
 * attribute (only properties like `HTMLAnchorElement.href` are auto-resolved),
 * so we fall back to the document's own base URI. Detached documents report
 * "about:blank"; treat that as "no base" rather than resolving against it.
 */
function documentBaseUrl(root: ParentNode): string | undefined {
  const base = (root as { baseURI?: unknown }).baseURI;
  if (typeof base !== "string" || !base || base === "about:blank") return undefined;
  return base;
}

/** Pick the container selector that yields the most elements; ties favor earlier (more specific). */
function chooseContainers(root: ParentNode): Element[] {
  let best: Element[] = [];
  for (const selector of POST_CONTAINERS) {
    const found = Array.from(root.querySelectorAll(selector));
    if (found.length > best.length) best = found;
  }
  return best;
}

function extractTitle(root: ParentNode): string | undefined {
  const candidates = [
    root.querySelector("h1")?.textContent,
    root.querySelector("meta[property='og:title']")?.getAttribute("content"),
    root.querySelector("title")?.textContent,
  ];
  for (const candidate of candidates) {
    const text = candidate ? normalizeWhitespace(candidate) : "";
    if (text) return text;
  }
  return undefined;
}

function pickId(post: Element): string | undefined {
  for (const attr of ["data-post-id", "data-id", "data-post", "id"]) {
    const value = post.getAttribute(attr);
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function extractAuthor(post: Element, baseUrl?: string): { author?: string; authorUrl?: string } {
  for (const selector of AUTHOR_SELECTORS) {
    const el = post.querySelector(selector);
    const text = el?.textContent ? normalizeWhitespace(el.textContent) : "";
    if (!el || !text) continue;
    const anchor = el.tagName.toLowerCase() === "a" ? el : el.querySelector("a");
    const href = anchor?.getAttribute("href");
    return { author: text, authorUrl: href ? resolveUrl(href, baseUrl) : undefined };
  }
  return {};
}

function extractTimestamp(post: Element): string | undefined {
  for (const selector of TIME_SELECTORS) {
    const el = post.querySelector(selector);
    if (!el) continue;
    const datetime = el.getAttribute("datetime");
    const text = el.textContent ? normalizeWhitespace(el.textContent) : "";
    const value = (datetime && datetime.trim()) || text;
    if (value) return value;
  }
  return undefined;
}

function extractContent(post: Element): { text: string; html?: string; scope: Element } {
  let firstBody: Element | undefined;
  for (const selector of CONTENT_SELECTORS) {
    const el = post.querySelector(selector);
    if (!el) continue;
    firstBody ??= el;
    const text = el.textContent ? cleanText(el.textContent) : "";
    if (text) return { text, html: el.innerHTML, scope: el };
  }
  // A recognized body that holds only media (image/video/embed) yields no text,
  // but it is still the post body: keep its HTML so media-only posts aren't
  // dropped or back-filled with header/author text from the whole post.
  if (firstBody) return { text: "", html: firstBody.innerHTML, scope: firstBody };
  // No recognized body at all: degrade to whole-post text instead of crashing.
  return { text: post.textContent ? cleanText(post.textContent) : "", scope: post };
}

function extractPermalink(post: Element, baseUrl?: string): string | undefined {
  for (const selector of PERMALINK_SELECTORS) {
    const href = post.querySelector(selector)?.getAttribute("href");
    if (href && href.trim()) return resolveUrl(href, baseUrl);
  }
  return undefined;
}

function extractLinks(scope: Element, baseUrl?: string): string[] {
  return Array.from(scope.querySelectorAll("a[href]"))
    .map((a) => a.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

/** Role stated by the page itself (class names, badges, user-title labels). */
function detectExplicitRole(post: Element): ForumRole | undefined {
  const haystacks = [post.className ?? ""];
  for (const selector of ROLE_NODE_SELECTORS) {
    const text = post.querySelector(selector)?.textContent;
    if (text) haystacks.push(text);
  }
  const text = haystacks.join(" ");
  for (const { pattern, role } of ROLE_KEYWORDS) {
    if (pattern.test(text)) return role;
  }
  return undefined;
}

function resolveRole(
  post: Element,
  context: { isFirst: boolean; author?: string; opAuthor?: string },
): ForumRole | undefined {
  const explicit = detectExplicitRole(post);
  // An explicit moderator/admin label always wins over the OP heuristic.
  if (explicit === "mod" || explicit === "admin") return explicit;
  // The first post is the thread starter; later posts by that same author are
  // the OP's too, so OP-highlighting follows them through the whole thread.
  const { isFirst, author, opAuthor } = context;
  if (isFirst) return "op";
  if (opAuthor && author && author === opAuthor) return "op";
  return explicit; // an explicit "op" label, or undefined
}

/**
 * Best-effort extraction of a thread from a DOM with no site-specific adapter.
 *
 * Walks a prioritized set of common forum/comment selectors, picks the post
 * container that matches the most elements, and extracts each field defensively
 * (a missing field is skipped, never thrown). Pass `root` as a `Document` or any
 * element that contains the thread.
 */
export function extractThreadGeneric(
  root: ParentNode,
  options: GenericExtractOptions = {},
): ExtractedThread {
  // Prefer an explicit base; otherwise resolve against the live document so a
  // browser DOM also yields absolute URLs (see documentBaseUrl).
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  let opAuthor: string | undefined;
  const posts = chooseContainers(root).map((el, index) => {
    const { author, authorUrl } = extractAuthor(el, baseUrl);
    if (index === 0) opAuthor = author;
    const { text, html, scope } = extractContent(el);
    return createPost({
      id: pickId(el),
      author,
      authorUrl,
      role: resolveRole(el, { isFirst: index === 0, author, opAuthor }),
      timestamp: extractTimestamp(el),
      contentText: text,
      contentHtml: html,
      permalink: extractPermalink(el, baseUrl),
      links: extractLinks(scope, baseUrl),
    });
  });

  const result: ExtractedThread = { posts };
  const title = extractTitle(root);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
