import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type ArcaExtractOptions = ExtractOptions;

const ARTICLE_LINK = /(?:^|\/)b\/[^/?#]+\/(\d+)(?:[/?#]|$)/;
const COMMENT_ID = /^c_(\d+)$/;
const MEDIA_SELECTOR = "img, picture, source, audio, video, iframe, embed, object";
const MEDIA_PLACEHOLDER = "[Media omitted — open the original thread to view it.]";

type Identity = {
  author?: string;
  authorUrl?: string;
};

type CanonicalArticle = {
  href: string;
  id: string;
};

function matchingElement(root: ParentNode, selector: string): Element | undefined {
  const candidate = root as ParentNode & { matches?: (value: string) => boolean };
  return candidate.matches?.(selector) ? (root as unknown as Element) : undefined;
}

function findArticle(root: ParentNode): Element | undefined {
  return matchingElement(root, "article.board-article") ??
    root.querySelector("article.board-article") ??
    undefined;
}

function findWrapper(article: Element): Element | undefined {
  if (article.classList.contains("article-wrapper")) return article;
  return article.querySelector(".article-wrapper") ?? undefined;
}

function canonicalArticle(wrapper: Element): CanonicalArticle | undefined {
  for (const anchor of wrapper.querySelectorAll(":scope > .article-link a[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    const id = href ? ARTICLE_LINK.exec(href)?.[1] : undefined;
    if (href && id) return { href, id };
  }
  return undefined;
}

/**
 * Arca channel lists share many article-oriented class names. A dedicated
 * article requires the full board-article wrapper, readable head/body regions,
 * and a canonical `/b/{channel}/{numeric-id}` link before this adapter can
 * replace the generic fallback.
 */
export function isArcaPage(root: ParentNode): boolean {
  const article = findArticle(root);
  const wrapper = article ? findWrapper(article) : undefined;
  return Boolean(
    wrapper &&
      wrapper.querySelector(":scope > .article-head .title-row > .title") &&
      wrapper.querySelector(":scope > .article-body .article-content") &&
      canonicalArticle(wrapper),
  );
}

function extractTitle(wrapper: Element): string | undefined {
  const title = wrapper.querySelector(":scope > .article-head .title-row > .title");
  if (!title) return undefined;
  const clone = title.cloneNode(true) as Element;
  for (const decoration of clone.querySelectorAll(
    ".badge, .category-badge, .ion-android-star",
  )) {
    decoration.remove();
  }
  return normalizeWhitespace(clone.textContent ?? "") || undefined;
}

function extractIdentity(root: ParentNode, baseUrl?: string): Identity {
  const anchor = root.querySelector(".user-info > a");
  const author = normalizeWhitespace(anchor?.textContent ?? "");
  const href = anchor?.getAttribute("href")?.trim();
  return {
    author: author || undefined,
    authorUrl: href ? resolveUrl(href, baseUrl) : undefined,
  };
}

function extractTimestamp(root: ParentNode): string | undefined {
  const time = root.querySelector("time");
  const datetime = time?.getAttribute("datetime")?.trim();
  if (datetime) return datetime;
  return normalizeWhitespace(time?.textContent ?? "") || undefined;
}

function extractLinks(root: ParentNode, baseUrl?: string): string[] {
  return Array.from(root.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function extractContent(
  content: Element | null,
  baseUrl?: string,
): { text: string; html?: string; links: string[] } {
  if (!content) return { text: "", links: [] };
  const readableText = cleanText(content.textContent ?? "");
  const text = readableText || (content.querySelector(MEDIA_SELECTOR) ? MEDIA_PLACEHOLDER : "");
  return {
    text,
    html: content.innerHTML || undefined,
    links: extractLinks(content, baseUrl),
  };
}

function commentId(comment: Element | null | undefined): string | undefined {
  return COMMENT_ID.exec(comment?.getAttribute("id") ?? "")?.[1];
}

function parentComment(comment: Element): Element | undefined {
  const wrapper = comment.closest(".comment-wrapper");
  const parentWrapper = wrapper?.parentElement?.closest(".comment-wrapper");
  return parentWrapper?.querySelector(":scope > .comment-item") ?? undefined;
}

function commentDepth(comment: Element): number {
  let depth = 1;
  let wrapper = comment.closest(".comment-wrapper")?.parentElement?.closest(".comment-wrapper");
  while (wrapper) {
    depth += 1;
    wrapper = wrapper.parentElement?.closest(".comment-wrapper") ?? null;
  }
  return depth;
}

function sameIdentity(left: Identity, right: Identity): boolean {
  if (left.authorUrl && right.authorUrl) return left.authorUrl === right.authorUrl;
  return Boolean(left.author && right.author && left.author === right.author);
}

function commentRole(comment: Element, identity: Identity, opIdentity: Identity): ForumRole | undefined {
  const userInfo = comment.querySelector(".user-info");
  if (userInfo?.querySelector(".user-admin")) return "admin";
  if (userInfo?.querySelector(".user-manager")) return "mod";
  return sameIdentity(identity, opIdentity) ? "op" : undefined;
}

/** Best-effort extraction for one loaded Arca article and its visible comments. */
export function extractThreadArca(
  root: ParentNode,
  options: ArcaExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const article = findArticle(root);
  const wrapper = article ? findWrapper(article) : undefined;
  const canonical = wrapper ? canonicalArticle(wrapper) : undefined;
  if (!wrapper || !canonical) {
    const empty: ExtractedThread = {
      layout: "article-comments",
      source: "arca",
      posts: [],
    };
    if (baseUrl) empty.baseUrl = baseUrl;
    return empty;
  }

  const canonicalUrl = resolveUrl(canonical.href, baseUrl);
  const head = wrapper.querySelector(":scope > .article-head");
  const opIdentity = head ? extractIdentity(head, baseUrl) : {};
  const articleContent = extractContent(
    wrapper.querySelector(":scope > .article-body .article-content"),
    baseUrl,
  );
  const articlePost = createPost({
    id: canonical.id,
    ...opIdentity,
    role: opIdentity.author ? "op" : undefined,
    timestamp: head ? extractTimestamp(head) : undefined,
    contentText: articleContent.text,
    contentHtml: articleContent.html,
    permalink: canonicalUrl,
    depth: 0,
    kind: "article",
    links: articleContent.links,
  });

  const comments = Array.from(
    wrapper.querySelectorAll(":scope > .article-comment .comment-item[id]"),
  ).flatMap((comment) => {
    const id = commentId(comment);
    if (!id) return [];
    const identity = extractIdentity(comment, baseUrl);
    const content = extractContent(comment.querySelector(":scope > .content > .message"), baseUrl);
    const parentId = commentId(parentComment(comment)) ?? canonical.id;
    return [
      createPost({
        id,
        ...identity,
        role: commentRole(comment, identity, opIdentity),
        timestamp: extractTimestamp(comment),
        contentText: content.text,
        contentHtml: content.html,
        permalink: resolveUrl(`#c_${id}`, canonicalUrl),
        parentId,
        depth: commentDepth(comment),
        kind: "comment",
        links: content.links,
      }),
    ];
  });

  const result: ExtractedThread = {
    layout: "article-comments",
    source: "arca",
    baseUrl: baseUrl ?? canonicalUrl,
    posts: ensureUniquePostIds([articlePost, ...comments]),
  };
  const title = extractTitle(wrapper);
  if (title) result.title = title;
  return result;
}
