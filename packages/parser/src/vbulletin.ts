import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type VBulletinExtractOptions = ExtractOptions;

const APP_SELECTOR = "html#vbulletin_html";
const POST_SELECTOR = "li[id^='post_']";
const POST_ID = /^post_(\d+)$/;
const VB4_GENERATOR = /^vBulletin\s+4(?:\.|\s|$)/i;

function findAppRoot(root: ParentNode): Element | null {
  const candidate = root as Element;
  if (typeof candidate.matches === "function" && candidate.matches(APP_SELECTOR)) return candidate;
  return root.querySelector(APP_SELECTOR);
}

function postId(post: Element): string | undefined {
  return POST_ID.exec(post.id)?.[1];
}

function isPostbit(post: Element): boolean {
  return post.classList.contains("postbit") || post.classList.contains("postbitlegacy");
}

function findPostElements(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(POST_SELECTOR)).filter((post) => {
    const id = postId(post);
    return (
      id !== undefined &&
      isPostbit(post) &&
      post.querySelector(".postbody") !== null &&
      matchingPermalinkHref(post, id) !== undefined
    );
  });
}

function matchingPermalinkHref(post: Element, id: string): string | undefined {
  const fragment = `#post${id}`;
  return Array.from(post.querySelectorAll("a.postcounter[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .find((href): href is string => Boolean(href?.trim().endsWith(fragment)));
}

/**
 * Detect a vBulletin 4 showthread page, not merely markup that uses generic
 * words such as "post" or "content". Branding-free installations omit the
 * generator signature and intentionally fall back to the generic parser.
 */
export function isVBulletinPage(root: ParentNode): boolean {
  const app = findAppRoot(root);
  if (!app) return false;
  const generator = app.querySelector("meta[name='generator']")?.getAttribute("content") ?? "";
  if (!VB4_GENERATOR.test(generator)) return false;
  if (app.querySelector("#pagetitle .threadtitle") === null) return false;

  return findPostElements(app).length > 0;
}

function extractTitle(root: ParentNode): string | undefined {
  const candidates = [
    root.querySelector("#pagetitle .threadtitle a")?.textContent,
    root.querySelector("#pagetitle .threadtitle")?.textContent,
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
    ".username_container a.username, .username_container .username",
  );
  const author = element?.textContent ? normalizeWhitespace(element.textContent) : "";
  const href = element?.tagName.toLowerCase() === "a" ? element.getAttribute("href") : null;
  return {
    author: author || undefined,
    authorUrl: href ? resolveUrl(href, baseUrl) : undefined,
  };
}

function extractTimestamp(post: Element): string | undefined {
  const element = post.querySelector(".posthead .postdate .date, .posthead .postdate");
  const timestamp = element?.textContent ? normalizeWhitespace(element.textContent) : "";
  return timestamp || undefined;
}

function extractContent(
  post: Element,
  id: string,
): { text: string; html?: string; scope?: Element } {
  const message = post.querySelector(`#post_message_${id}`);
  const element =
    message?.closest(".postcontent") ?? message?.querySelector(".postcontent") ?? message;
  if (!element) return { text: "" };
  return {
    text: element.textContent ? cleanText(element.textContent) : "",
    html: element.innerHTML,
    scope: element,
  };
}

function extractLinks(scope: Element | undefined, baseUrl?: string): string[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function explicitStaffRole(post: Element): ForumRole | undefined {
  const profile = post.querySelector(".userinfo, .userinfo_noavatar");
  if (!profile) return undefined;
  const nodes = Array.from(profile.querySelectorAll(".usertitle, .rank"));
  const roleText = nodes
    .flatMap((element) => [
      element.textContent ?? "",
      element.className,
      element.getAttribute("title") ?? "",
      ...Array.from(element.querySelectorAll("[title], [alt]")).flatMap((child) => [
        child.getAttribute("title") ?? "",
        child.getAttribute("alt") ?? "",
      ]),
    ])
    .join(" ");

  if (/\b(admin|administrator)\b/i.test(roleText)) return "admin";
  if (/\b(moderator|mod)\b/i.test(roleText)) return "mod";
  return undefined;
}

/** Best-effort extraction for stock/classic vBulletin 4.x showthread postbits. */
export function extractThreadVBulletin(
  root: ParentNode,
  options: VBulletinExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const posts = ensureUniquePostIds(
    findPostElements(root).map((post) => {
      const id = postId(post) as string;
      const { author, authorUrl } = extractAuthor(post, baseUrl);
      const { text, html, scope } = extractContent(post, id);
      const permalinkHref = matchingPermalinkHref(post, id);
      return createPost({
        id,
        author,
        authorUrl,
        // Stock vB4 postbits expose no reliable OP marker. Never infer this
        // from display order because threaded, sorted, and paginated views vary.
        role: explicitStaffRole(post),
        timestamp: extractTimestamp(post),
        contentText: text,
        contentHtml: html,
        permalink: permalinkHref ? resolveUrl(permalinkHref, baseUrl) : undefined,
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
