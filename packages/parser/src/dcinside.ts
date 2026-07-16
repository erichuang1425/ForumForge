import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type DcInsideExtractOptions = ExtractOptions;

const COMMENT_ELEMENT_ID = /^comment_li_(\d+)$/;
const REPLY_ELEMENT_ID = /^reply_li_(\d+)$/;
const REPLY_LIST_ID = /^reply_list_(\d+)$/;
const MEDIA_SELECTOR = "img, picture, source, audio, video, iframe, embed, object";
const MEDIA_PLACEHOLDER = "[Media omitted — open the original thread to view it.]";

type Identity = {
  author?: string;
  authorUrl?: string;
  key?: string;
};

type CommentRecord = {
  element: Element;
  id: string;
  info: Element;
  reply: boolean;
};

function matchingElement(root: ParentNode, selector: string): Element | undefined {
  const candidate = root as ParentNode & { matches?: (value: string) => boolean };
  return candidate.matches?.(selector) ? (root as unknown as Element) : undefined;
}

function findView(root: ParentNode): Element | undefined {
  return matchingElement(root, ".view_content_wrap") ??
    root.querySelector(".view_content_wrap") ??
    undefined;
}

function articleId(view: Element): string | undefined {
  const signals = Array.from(view.querySelectorAll(".btn_recommend_box [data-no]"))
    .map((element) => element.getAttribute("data-no")?.trim() ?? "");
  if (signals.length === 0 || signals.some((id) => !/^\d+$/.test(id))) return undefined;
  const ids = new Set(signals);
  return ids.size === 1 ? signals[0] : undefined;
}

function pageScope(view: Element): ParentNode {
  return view.parentElement ?? view;
}

/**
 * DC Inside list and article pages reuse dense `ub-*` table classes. Detection
 * therefore requires the full gallery-view header/body shell and one coherent
 * numeric article identity from its recommendation controls before selecting
 * this adapter.
 */
export function isDcInsidePage(root: ParentNode): boolean {
  const view = findView(root);
  return Boolean(
    view &&
      articleId(view) &&
      view.querySelector(".gallview_head.ub-content .title_subject") &&
      view.querySelector(".gallview_head .gall_writer.ub-writer") &&
      view.querySelector(".gallview_contents .writing_view_box .write_div"),
  );
}

function extractIdentity(root: ParentNode, baseUrl?: string): Identity {
  const writer = root.querySelector(".gall_writer.ub-writer, .gall_writer");
  if (!writer) return {};
  const nickname =
    normalizeWhitespace(writer.getAttribute("data-nick") ?? "") ||
    normalizeWhitespace(writer.querySelector(".nickname")?.textContent ?? "") ||
    undefined;
  const uid = writer.getAttribute("data-uid")?.trim() || undefined;
  const ip = writer.getAttribute("data-ip")?.trim() || undefined;
  const href = writer.querySelector("a[href]")?.getAttribute("href")?.trim();
  return {
    author: nickname ? (ip ? `${nickname} (${ip})` : nickname) : undefined,
    authorUrl: href ? resolveUrl(href, baseUrl) : undefined,
    key: uid ? `uid:${uid}` : nickname ? `anon:${nickname}\u0000${ip ?? ""}` : undefined,
  };
}

function extractTimestamp(root: ParentNode, selector: string): string | undefined {
  const element = root.querySelector(selector);
  const title = element?.getAttribute("title")?.trim();
  if (title) return title;
  return normalizeWhitespace(element?.textContent ?? "") || undefined;
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

function commentRecord(element: Element, expectedArticleId: string): CommentRecord | undefined {
  const elementId = element.getAttribute("id") ?? "";
  const commentId = COMMENT_ELEMENT_ID.exec(elementId)?.[1];
  const replyId = REPLY_ELEMENT_ID.exec(elementId)?.[1];
  const id = commentId ?? replyId;
  const reply = Boolean(replyId);
  if (!id) return undefined;
  const info = element.querySelector(reply ? ":scope > .reply_info" : ":scope > .cmt_info");
  if (!info || info.getAttribute("data-no")?.trim() !== id) return undefined;
  const infoArticleId = info.getAttribute("data-article-no")?.trim();
  if (!reply && infoArticleId && infoArticleId !== expectedArticleId) return undefined;
  return { element, id, info, reply };
}

function loadedComments(scope: ParentNode, expectedArticleId: string): CommentRecord[] {
  const wrapper = Array.from(scope.querySelectorAll(".view_comment .comment_wrap[id]")).find(
    (element) => element.getAttribute("id") === `comment_wrap_${expectedArticleId}`,
  );
  if (!wrapper) return [];
  return Array.from(
    wrapper.querySelectorAll(
      ".comment_box li[id^='comment_li_'], .comment_box li[id^='reply_li_']",
    ),
  )
    .map((element) => commentRecord(element, expectedArticleId))
    .filter((record): record is CommentRecord => Boolean(record));
}

function replyParentId(
  record: CommentRecord,
  expectedArticleId: string,
  knownIds: ReadonlySet<string>,
): string {
  if (!record.reply) return expectedArticleId;
  const listId = record.element.closest(".reply_list")?.getAttribute("id") ?? "";
  const candidate = REPLY_LIST_ID.exec(listId)?.[1];
  return candidate && knownIds.has(candidate) ? candidate : expectedArticleId;
}

/**
 * Best-effort extraction for one DC Inside gallery article. Comments are read
 * only when the site's own script has already rendered them into the page; the
 * adapter never calls DC Inside's comment endpoint.
 */
export function extractThreadDcInside(
  root: ParentNode,
  options: DcInsideExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const view = findView(root);
  const id = view ? articleId(view) : undefined;
  if (!view || !id) {
    const empty: ExtractedThread = {
      layout: "article-comments",
      source: "dc-inside",
      posts: [],
    };
    if (baseUrl) empty.baseUrl = baseUrl;
    return empty;
  }

  const head = view.querySelector(".gallview_head");
  const opIdentity = head ? extractIdentity(head, baseUrl) : {};
  const body = extractContent(
    view.querySelector(".gallview_contents .writing_view_box .write_div"),
    baseUrl,
  );
  const articlePost = createPost({
    id,
    author: opIdentity.author,
    authorUrl: opIdentity.authorUrl,
    role: opIdentity.author ? "op" : undefined,
    timestamp: head ? extractTimestamp(head, ".gall_date") : undefined,
    contentText: body.text,
    contentHtml: body.html,
    permalink: baseUrl,
    depth: 0,
    kind: "article",
    links: body.links,
  });

  const commentRecords = loadedComments(pageScope(view), id);
  const knownIds = new Set([id, ...commentRecords.map((record) => record.id)]);
  const comments = commentRecords.map((record) => {
    const identity = extractIdentity(record.info, baseUrl);
    const content = extractContent(
      record.info.querySelector(".usertxt, .del_reply"),
      baseUrl,
    );
    const fragment = record.reply ? `reply_li_${record.id}` : `comment_li_${record.id}`;
    return createPost({
      id: record.id,
      author: identity.author,
      authorUrl: identity.authorUrl,
      role: identity.key && opIdentity.key && identity.key === opIdentity.key ? "op" : undefined,
      timestamp: extractTimestamp(record.info, ".date_time"),
      contentText: content.text,
      contentHtml: content.html,
      permalink: baseUrl ? resolveUrl(`#${fragment}`, baseUrl) : undefined,
      parentId: replyParentId(record, id, knownIds),
      depth: record.reply ? 2 : 1,
      kind: "comment",
      links: content.links,
    });
  });

  const result: ExtractedThread = {
    layout: "article-comments",
    source: "dc-inside",
    posts: ensureUniquePostIds([articlePost, ...comments]),
  };
  const title = normalizeWhitespace(head?.querySelector(".title_subject")?.textContent ?? "");
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
