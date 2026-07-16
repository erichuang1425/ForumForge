import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type PhpBBExtractOptions = ExtractOptions;

const POST_SELECTOR = ".post[id^='p']";
const POST_ID = /^p(\d+)$/;

function findPageBody(root: ParentNode): ParentNode | null {
  const isPageBody = (root as ParentNode & { id?: unknown }).id === "page-body";
  return isPageBody ? root : root.querySelector("#page-body");
}

function findPostElements(root: ParentNode): Element[] {
  const pageBody = findPageBody(root);
  if (!pageBody) return [];
  return Array.from(pageBody.querySelectorAll(POST_SELECTOR)).filter((post) =>
    POST_ID.test(post.id),
  );
}

/**
 * phpBB's default prosilver template identifies the application and page type
 * on `<body>`. Requiring both that signature and a numeric post container with
 * a phpBB post body keeps detection away from forum indexes and unrelated pages
 * that happen to use generic class names such as `.post` or `.content`.
 */
export function isPhpBBPage(root: ParentNode): boolean {
  const body = root.querySelector("body#phpbb.section-viewtopic");
  if (!body) return false;
  return findPostElements(body).some((post) => post.querySelector(".postbody") !== null);
}

function extractTitle(root: ParentNode): string | undefined {
  const pageBody = findPageBody(root);
  const candidates = [
    pageBody?.querySelector("h2.topic-title a")?.textContent,
    pageBody?.querySelector("h2.topic-title")?.textContent,
    root.querySelector("title")?.textContent,
  ];
  for (const candidate of candidates) {
    const title = candidate ? normalizeWhitespace(candidate) : "";
    if (title) return title;
  }
  return undefined;
}

function extractAuthor(post: Element, baseUrl?: string): { author?: string; authorUrl?: string } {
  const selectors = [
    ".postprofile .username-coloured",
    ".postprofile .username",
    ".postbody .author .username-coloured",
    ".postbody .author .username",
  ];
  for (const selector of selectors) {
    const element = post.querySelector(selector);
    const author = element?.textContent ? normalizeWhitespace(element.textContent) : "";
    if (!element || !author) continue;
    const anchor = element.tagName.toLowerCase() === "a" ? element : element.querySelector("a");
    const href = anchor?.getAttribute("href");
    return { author, authorUrl: href ? resolveUrl(href, baseUrl) : undefined };
  }
  return {};
}

function extractTimestamp(post: Element): string | undefined {
  const element = post.querySelector(".postbody .author time");
  if (!element) return undefined;
  const datetime = element.getAttribute("datetime");
  const text = element.textContent ? normalizeWhitespace(element.textContent) : "";
  return (datetime && datetime.trim()) || text || undefined;
}

function extractContent(post: Element): { text: string; html?: string; scope?: Element } {
  const element = post.querySelector(".postbody .content");
  if (!element) return { text: "" };
  return {
    text: element.textContent ? cleanText(element.textContent) : "",
    html: element.innerHTML,
    scope: element,
  };
}

function extractPermalink(post: Element, postId: string, baseUrl?: string): string | undefined {
  const fragment = `#p${postId}`;
  const href = Array.from(post.querySelectorAll(".postbody a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .find((candidate): candidate is string => Boolean(candidate?.trim().endsWith(fragment)));
  return href ? resolveUrl(href, baseUrl) : undefined;
}

function extractLinks(scope: Element | undefined, baseUrl?: string): string[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function explicitRole(post: Element): ForumRole | undefined {
  const profile = post.querySelector(".postprofile");
  if (!profile) return undefined;
  const rankNodes = Array.from(profile.querySelectorAll(".profile-rank, .rank"));
  const rankText = rankNodes
    .flatMap((element) => [
      element.textContent ?? "",
      element.getAttribute("title") ?? "",
      ...Array.from(element.querySelectorAll("[title], [alt]")).flatMap((child) => [
        child.getAttribute("title") ?? "",
        child.getAttribute("alt") ?? "",
      ]),
    ])
    .join(" ");

  if (/\b(admin|administrator|founder)\b/i.test(rankText)) return "admin";
  if (/\b(moderator|mod|staff)\b/i.test(rankText)) return "mod";
  return undefined;
}

/** Best-effort extraction for phpBB topic pages using the stable prosilver DOM contract. */
export function extractThreadPhpBB(
  root: ParentNode,
  options: PhpBBExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);

  const postElements = findPostElements(root);
  const posts = ensureUniquePostIds(
    postElements.map((post) => {
      const postId = POST_ID.exec(post.id)?.[1];
      const { author, authorUrl } = extractAuthor(post, baseUrl);
      const { text, html, scope } = extractContent(post);
      return createPost({
        id: postId,
        author,
        authorUrl,
        role: explicitRole(post),
        timestamp: extractTimestamp(post),
        contentText: text,
        contentHtml: html,
        permalink: postId ? extractPermalink(post, postId, baseUrl) : undefined,
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
