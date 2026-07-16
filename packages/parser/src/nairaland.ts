import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type NairalandExtractOptions = ExtractOptions;

const POST_LINK_ID = /\/post\/(\d+)(?:[/?#]|$)/i;
const TIMESTAMP = /(\d{1,2}:\d{2}(?:am|pm)\s+On\s+.+?)(?=(?:\.\s*)?Modified:|$)/i;

type PostPair = {
  body: Element;
  header: Element;
  id: string;
  permalinkHref: string;
};

function postLink(header: Element): { id: string; href: string } | undefined {
  for (const anchor of header.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    const id = href ? POST_LINK_ID.exec(href)?.[1] : undefined;
    if (href && id) return { id, href };
  }
  return undefined;
}

function findPostPairs(root: ParentNode): PostPair[] {
  const pairs: PostPair[] = [];
  for (const body of root.querySelectorAll("div.narrow")) {
    const bodyRow = body.closest("tr");
    const header = bodyRow?.previousElementSibling;
    if (!bodyRow || !header || header.tagName.toLowerCase() !== "tr") continue;
    if (header.parentElement !== bodyRow.parentElement || !header.querySelector("a.user")) continue;
    const link = postLink(header);
    if (!link) continue;
    pairs.push({ body, header, id: link.id, permalinkHref: link.href });
  }
  return pairs;
}

/**
 * Nairaland topic pages pair a metadata row containing a `.user` link and a
 * numeric `/post/{id}` permalink with the next row's `.narrow` post body.
 * Requiring that adjacency avoids mistaking its table-heavy forum indexes or
 * unrelated compact layouts for a thread.
 */
export function isNairalandPage(root: ParentNode): boolean {
  if (root.querySelector(".body h2") === null) return false;
  return findPostPairs(root).length > 0;
}

function extractTitle(root: ParentNode): string | undefined {
  const candidates = [
    root.querySelector(".body h2 > a")?.textContent,
    root.querySelector(".body h2")?.textContent,
    root.querySelector("title")?.textContent?.replace(/\s+-\s+[^-]+\s+-\s+Nigeria\s*$/i, ""),
  ];
  for (const candidate of candidates) {
    const title = candidate ? normalizeWhitespace(candidate) : "";
    if (title) return title;
  }
  return undefined;
}

function extractAuthor(
  header: Element,
  baseUrl?: string,
): { author?: string; authorUrl?: string } {
  const element = header.querySelector("a.user");
  const author = element?.textContent ? normalizeWhitespace(element.textContent) : "";
  const href = element?.getAttribute("href");
  return {
    author: author || undefined,
    authorUrl: href?.trim() ? resolveUrl(href, baseUrl) : undefined,
  };
}

function extractTimestamp(header: Element): string | undefined {
  const text = header.textContent ? normalizeWhitespace(header.textContent) : "";
  return TIMESTAMP.exec(text)?.[1]?.trim() || undefined;
}

function explicitRole(header: Element): ForumRole | undefined {
  const author = header.querySelector("a.user");
  const markerParts: string[] = [];
  let sibling = author?.nextSibling ?? null;
  while (sibling) {
    const text = sibling.textContent ?? "";
    const separator = text.indexOf(":");
    markerParts.push(separator >= 0 ? text.slice(0, separator) : text);
    if (separator >= 0) break;
    sibling = sibling.nextSibling;
  }
  const marker = markerParts.join(" ");
  if (/\(\s*op\s*\)/i.test(marker)) return "op";
  if (/\(\s*m\s*\)/i.test(marker)) return "mod";
  return undefined;
}

function extractLinks(body: Element, baseUrl?: string): string[] {
  return Array.from(body.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

/** Best-effort extraction for Nairaland topic pages using its paired table rows. */
export function extractThreadNairaland(
  root: ParentNode,
  options: NairalandExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const posts = ensureUniquePostIds(
    findPostPairs(root).map(({ body, header, id, permalinkHref }) => {
      const { author, authorUrl } = extractAuthor(header, baseUrl);
      const links = extractLinks(body, baseUrl);
      return createPost({
        id,
        author,
        authorUrl,
        role: explicitRole(header),
        timestamp: extractTimestamp(header),
        contentText: body.textContent ? cleanText(body.textContent) : "",
        contentHtml: body.innerHTML,
        permalink: resolveUrl(permalinkHref, baseUrl),
        links,
      });
    }),
  );

  const result: ExtractedThread = { posts };
  const title = extractTitle(root);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
