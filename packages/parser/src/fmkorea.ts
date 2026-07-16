import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type FmKoreaExtractOptions = ExtractOptions;

const COMMENT_ID = /^comment_(\d+)$/;
const MEMBER_KEY = /(?:^|\s)member_(\d+)(?:\s|$)/;
const MEDIA_SELECTOR = "img, picture, source, audio, video, iframe, embed, object";
const MEDIA_PLACEHOLDER = "[Media omitted — open the original thread to view it.]";

type Identity = {
  author?: string;
  key?: string;
};

type SignedThread = {
  container: Element;
  articleBody: Element;
  id: string;
};

type CommentRecord = {
  element: Element;
  id: string;
  permalink: string;
};

function matchingElement(root: ParentNode, selector: string): Element | undefined {
  const candidate = root as ParentNode & { matches?: (value: string) => boolean };
  return candidate.matches?.(selector) ? (root as unknown as Element) : undefined;
}

function articleBody(container: Element, articleId: string): Element | undefined {
  const signature = new RegExp(`^document_${articleId}_\\d+$`);
  return Array.from(container.querySelectorAll(".rd_body article > .xe_content")).find(
    (element) => Array.from(element.classList).some((className) => signature.test(className)),
  );
}

function findSignedThread(root: ParentNode): SignedThread | undefined {
  const candidates = new Set<Element>();
  const matching = matchingElement(root, ".rd[data-docsrl]");
  if (matching) candidates.add(matching);
  for (const candidate of root.querySelectorAll(".rd[data-docsrl]")) candidates.add(candidate);

  for (const container of candidates) {
    const id = container.getAttribute("data-docsrl")?.trim() ?? "";
    if (!/^\d+$/.test(id)) continue;
    const body = articleBody(container, id);
    if (
      body &&
      container.querySelector(".rd_hd .top_area h1") &&
      container.querySelector(".rd_hd .btm_area .member_plate")
    ) {
      return { container, articleBody: body, id };
    }
  }
  return undefined;
}

/**
 * FMKorea list and article pages share board chrome. Detection requires the
 * numeric document identity, reader header, and matching document-body class
 * from one rendered article before replacing the generic fallback.
 */
export function isFmKoreaPage(root: ParentNode): boolean {
  return Boolean(findSignedThread(root));
}

function identity(root: ParentNode, selector: string): Identity {
  const plate = root.querySelector(selector);
  const author = normalizeWhitespace(plate?.textContent ?? "") || undefined;
  const memberId = MEMBER_KEY.exec(plate?.getAttribute("class") ?? "")?.[1];
  return {
    author,
    key: memberId ? `member:${memberId}` : undefined,
  };
}

function timestamp(root: ParentNode, selector: string): string | undefined {
  return normalizeWhitespace(root.querySelector(selector)?.textContent ?? "") || undefined;
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
  return {
    text: readableText || (content.querySelector(MEDIA_SELECTOR) ? MEDIA_PLACEHOLDER : ""),
    html: content.innerHTML || undefined,
    links: extractLinks(content, baseUrl),
  };
}

function parsedUrl(href: string, baseUrl?: string): URL | undefined {
  try {
    const parsed = new URL(href, baseUrl ?? "https://forumforge.invalid/");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function articlePermalink(container: Element, articleId: string, baseUrl?: string): string | undefined {
  for (const anchor of container.querySelectorAll(".document_address a[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    const parsed = href ? parsedUrl(href, baseUrl) : undefined;
    if (href && parsed?.pathname.split("/").filter(Boolean).at(-1) === articleId) {
      return resolveUrl(href, baseUrl);
    }
  }
  return baseUrl;
}

function commentPermalink(
  comment: Element,
  commentId: string,
  baseUrl?: string,
): string | undefined {
  for (const anchor of comment.querySelectorAll(":scope > .fdb_nav a[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    const parsed = href ? parsedUrl(href, baseUrl) : undefined;
    if (
      href &&
      parsed?.hash === `#comment_${commentId}` &&
      parsed.pathname.split("/").filter(Boolean).at(-1) === commentId
    ) {
      return resolveUrl(href, baseUrl);
    }
  }
  return undefined;
}

function commentWrapper(container: Element, articleId: string): Element | undefined {
  return Array.from(container.querySelectorAll(".fdb_lst[id]")).find(
    (element) => element.getAttribute("id") === `${articleId}_comment`,
  );
}

function commentRecords(
  container: Element,
  articleId: string,
  baseUrl?: string,
): CommentRecord[] {
  const wrapper = commentWrapper(container, articleId);
  if (!wrapper) return [];
  return Array.from(wrapper.querySelectorAll(".fdb_lst_ul > li.fdb_itm[id^='comment_']")).flatMap(
    (element) => {
      const id = COMMENT_ID.exec(element.getAttribute("id") ?? "")?.[1];
      const permalink = id ? commentPermalink(element, id, baseUrl) : undefined;
      return id && permalink ? [{ element, id, permalink }] : [];
    },
  );
}

function replyParent(
  record: CommentRecord,
  articleId: string,
  knownCommentIds: ReadonlySet<string>,
): { id: string; depth: number } {
  if (!record.element.classList.contains("re")) return { id: articleId, depth: 1 };
  const href = record.element.querySelector("a.findParent[href]")?.getAttribute("href")?.trim();
  const parentId = href ? parsedUrl(href)?.hash.match(/^#comment_(\d+)$/)?.[1] : undefined;
  if (parentId && parentId !== record.id && knownCommentIds.has(parentId)) {
    return { id: parentId, depth: 2 };
  }
  return { id: articleId, depth: 1 };
}

/** Extract one loaded FMKorea article and the comments present on its current page. */
export function extractThreadFmKorea(
  root: ParentNode,
  options: FmKoreaExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const signed = findSignedThread(root);
  if (!signed) return baseUrl ? { baseUrl, posts: [] } : { posts: [] };

  const { container, articleBody: bodyElement, id } = signed;
  const header = container.querySelector(".rd_hd");
  const opIdentity = header ? identity(header, ".btm_area .member_plate") : {};
  const body = extractContent(bodyElement, baseUrl);
  const permalink = articlePermalink(container, id, baseUrl);
  const article = createPost({
    id,
    author: opIdentity.author,
    role: opIdentity.author ? "op" : undefined,
    timestamp: header ? timestamp(header, ".top_area .date.m_no") : undefined,
    contentText: body.text,
    contentHtml: body.html,
    permalink,
    depth: 0,
    links: body.links,
  });

  const records = commentRecords(container, id, baseUrl);
  const knownCommentIds = new Set(records.map((record) => record.id));
  const comments = records.map((record) => {
    const commentIdentity = identity(record.element, ":scope > .meta > .member_plate");
    const content = extractContent(
      record.element.querySelector(":scope > .comment-content > .xe_content"),
      baseUrl,
    );
    const parent = replyParent(record, id, knownCommentIds);
    return createPost({
      id: record.id,
      author: commentIdentity.author,
      role:
        commentIdentity.key && opIdentity.key && commentIdentity.key === opIdentity.key
          ? "op"
          : undefined,
      timestamp: timestamp(record.element, ":scope > .meta > .date"),
      contentText: content.text,
      contentHtml: content.html,
      permalink: record.permalink,
      parentId: parent.id,
      depth: parent.depth,
      links: content.links,
    });
  });

  const result: ExtractedThread = {
    posts: ensureUniquePostIds([article, ...comments]),
  };
  const title = normalizeWhitespace(
    container.querySelector(".rd_hd .top_area h1")?.textContent ?? "",
  );
  if (title) result.title = title;
  if (baseUrl ?? permalink) result.baseUrl = baseUrl ?? permalink;
  return result;
}
