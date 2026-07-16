import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type XenForoExtractOptions = ExtractOptions;

const APP_SELECTOR = "html#XF[data-xf^='2.3'][data-app='public']";
const THREAD_VIEW_SELECTOR = "body[data-template*='thread_view']";
const SUPPORTED_VERSION = /^2\.3(?:\.|$)/;
const POST_SELECTOR = "article.message[data-content^='post-']";
const POST_CONTENT_ID = /^post-(\d+)$/;

function findAppRoot(root: ParentNode): Element | null {
  const candidate = root as Element;
  if (typeof candidate.matches === "function" && candidate.matches(APP_SELECTOR)) return candidate;
  return root.querySelector(APP_SELECTOR);
}

function postId(post: Element): string | undefined {
  return POST_CONTENT_ID.exec(post.getAttribute("data-content") ?? "")?.[1];
}

function findThreadView(app: Element): ParentNode | null {
  const body = app.querySelector(THREAD_VIEW_SELECTOR);
  if (body) return body;
  // Official XenForo 2.3 pages currently mirror the body template marker onto
  // `<html>` after startup. The body marker is canonical, but accepting the
  // observed mirror keeps detection stable if the body marker is unavailable.
  return app.matches("[data-template*='thread_view']") ? app : null;
}

function findPostElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(POST_SELECTOR)).filter((post) => {
    const id = postId(post);
    return (
      id !== undefined &&
      post.id === `js-post-${id}` &&
      post.querySelector(".message-inner .message-cell--main") !== null
    );
  });
}

/**
 * Detect only a public XenForo thread view with a coherent stock post shell.
 * Generic `.message` classes alone are deliberately insufficient: they are
 * common outside forums and on other XenForo page types.
 */
export function isXenForoPage(root: ParentNode): boolean {
  const app = findAppRoot(root);
  if (!app) return false;
  if (!SUPPORTED_VERSION.test(app.getAttribute("data-xf") ?? "")) return false;
  const threadView = findThreadView(app);
  if (!threadView) return false;

  return findPostElements(threadView).length > 0;
}

function extractTitle(root: ParentNode): string | undefined {
  const candidates = [
    root.querySelector("h1.p-title-value")?.textContent,
    root.querySelector(".p-title-value")?.textContent,
    root.querySelector("title")?.textContent,
  ];
  for (const candidate of candidates) {
    const title = candidate ? normalizeWhitespace(candidate) : "";
    if (title) return title;
  }
  return undefined;
}

function extractAuthor(post: Element, baseUrl?: string): { author?: string; authorUrl?: string } {
  const element = post.querySelector(
    ".message-userDetails .message-name .username, .message-name .username, " +
      ".message-articleUserInfo .username",
  );
  const visibleAuthor = element?.textContent ? normalizeWhitespace(element.textContent) : "";
  const declaredAuthor = normalizeWhitespace(post.getAttribute("data-author") ?? "");
  const author = visibleAuthor || declaredAuthor || undefined;
  const href = element?.getAttribute("href");
  return { author, authorUrl: href ? resolveUrl(href, baseUrl) : undefined };
}

function extractTimestamp(post: Element): string | undefined {
  const element = post.querySelector(".message-attribution-main time.u-dt");
  if (!element) return undefined;
  const datetime = element.getAttribute("datetime");
  const text = element.textContent ? normalizeWhitespace(element.textContent) : "";
  return (datetime && datetime.trim()) || text || undefined;
}

function extractContent(post: Element): { text: string; html?: string; scope?: Element } {
  const element = post.querySelector(".message-body .bbWrapper");
  if (!element) return { text: "" };
  return {
    text: element.textContent ? cleanText(element.textContent) : "",
    html: element.innerHTML,
    scope: element,
  };
}

function extractPermalink(post: Element, baseUrl?: string): string | undefined {
  const anchor = Array.from(post.querySelectorAll(".message-attribution-main a[href]")).find(
    (candidate) => candidate.querySelector("time.u-dt") !== null,
  );
  const href = anchor?.getAttribute("href");
  return href && href.trim() ? resolveUrl(href, baseUrl) : undefined;
}

function extractLinks(scope: Element | undefined, baseUrl?: string): string[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function explicitStaffRole(post: Element): ForumRole | undefined {
  const profile = post.querySelector(".message-cell--user, .message-articleUserInfo");
  if (!profile) return undefined;
  const nodes = Array.from(
    profile.querySelectorAll(
      ".message-userTitle, .userTitle, .userBanner, .username [class*='username--']",
    ),
  );
  const roleText = nodes
    .flatMap((element) => [
      element.textContent ?? "",
      element.className,
      element.getAttribute("title") ?? "",
      element.getAttribute("aria-label") ?? "",
    ])
    .join(" ");

  if (/\b(admin|administrator)\b/i.test(roleText)) return "admin";
  if (/\b(moderator|mod)\b/i.test(roleText)) return "mod";
  return undefined;
}

/** Best-effort extraction for XenForo 2.3 public thread views using the default DOM contract. */
export function extractThreadXenForo(
  root: ParentNode,
  options: XenForoExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);

  const posts = ensureUniquePostIds(
    findPostElements(root).map((post) => {
      const { author, authorUrl } = extractAuthor(post, baseUrl);
      const { text, html, scope } = extractContent(post);
      return createPost({
        id: postId(post),
        author,
        authorUrl,
        // XenForo 2.3's stock public markup does not expose a reliable OP
        // marker. Display order is unsafe across sorting, direct-post views,
        // and pagination, so only explicit staff evidence is assigned here.
        role: explicitStaffRole(post),
        timestamp: extractTimestamp(post),
        contentText: text,
        contentHtml: html,
        permalink: extractPermalink(post, baseUrl),
        links: extractLinks(scope, baseUrl),
      });
    }),
  );

  const result: ExtractedThread = { posts };
  const title = extractTitle(root);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
