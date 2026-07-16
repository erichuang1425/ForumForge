import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumRole } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type FourChanExtractOptions = ExtractOptions;

const POST_ID = /^p(\d+)$/;
const MESSAGE_ID = /^m(\d+)$/;
const CONTAINER_ID = /^pc(\d+)$/;
const TITLE_SUFFIX = /\s+-\s+4chan\s*$/i;

type PostRecord = {
  container: Element;
  post: Element;
  id: string;
};

function matchingElement(root: ParentNode, selector: string): Element | undefined {
  const candidate = root as ParentNode & {
    matches?: (value: string) => boolean;
  };
  return candidate.matches?.(selector) ? (root as unknown as Element) : undefined;
}

function signedBody(root: ParentNode): Element | undefined {
  const candidate = matchingElement(root, "body.is_thread");
  const ancestor = (root as ParentNode & { closest?: (value: string) => Element | null }).closest?.(
    "body.is_thread",
  );
  const body = candidate ?? ancestor ?? root.querySelector("body.is_thread") ?? undefined;
  return body?.classList.contains("is_index") ? undefined : body;
}

function findThread(root: ParentNode): Element | undefined {
  const body = signedBody(root);
  if (!body) return undefined;
  const candidate = matchingElement(root, ".thread");
  if (candidate && candidate.closest("body.is_thread") === body) return candidate;
  return body.querySelector(".board > .thread") ?? undefined;
}

function recordFromContainer(container: Element): PostRecord | undefined {
  const post = container.querySelector(":scope > .post");
  const id = POST_ID.exec(post?.getAttribute("id") ?? "")?.[1];
  if (!post || !id) return undefined;
  const containerId = container.getAttribute("id");
  if (containerId && CONTAINER_ID.exec(containerId)?.[1] !== id) return undefined;
  return { container, post, id };
}

function findPostRecords(thread: Element): PostRecord[] {
  return Array.from(
    thread.querySelectorAll(
      ":scope > .postContainer.opContainer, :scope > .postContainer.replyContainer",
    ),
  )
    .map(recordFromContainer)
    .filter((record): record is PostRecord => Boolean(record));
}

function fragmentPostId(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  const hash = href.slice(href.lastIndexOf("#"));
  return /^#p(\d+)$/.exec(hash)?.[1];
}

function permalinkHref(record: PostRecord): string | undefined {
  for (const anchor of record.post.querySelectorAll(".postNum a[href]")) {
    const href = anchor.getAttribute("href");
    if (fragmentPostId(href) === record.id) return href?.trim() || undefined;
  }
  return undefined;
}

function hasCoherentSignature(record: PostRecord): boolean {
  const messageId = MESSAGE_ID.exec(
    record.post.querySelector(":scope > .postMessage")?.getAttribute("id") ?? "",
  )?.[1];
  return messageId === record.id && Boolean(permalinkHref(record));
}

/**
 * Dedicated 4chan extraction is limited to an explicit thread page. Board
 * indexes also contain `.thread` and `.postContainer` markup, so the signed
 * `body.is_thread` state and coherent numeric post/message/permalink ids are
 * all required before this adapter can replace the generic fallback.
 */
export function isFourChanPage(root: ParentNode): boolean {
  const thread = findThread(root);
  return thread ? findPostRecords(thread).some(hasCoherentSignature) : false;
}

function extractTitle(root: ParentNode, records: readonly PostRecord[]): string | undefined {
  const op = records.find((record) => record.container.classList.contains("opContainer"));
  const subject = normalizeWhitespace(op?.post.querySelector(".subject")?.textContent ?? "");
  if (subject) return subject;
  const documentTitle = normalizeWhitespace(root.querySelector("title")?.textContent ?? "");
  return documentTitle.replace(TITLE_SUFFIX, "") || undefined;
}

function extractAuthor(post: Element): string | undefined {
  const name = normalizeWhitespace(post.querySelector(".name")?.textContent ?? "");
  const trip = normalizeWhitespace(post.querySelector(".postertrip, .trip")?.textContent ?? "");
  return normalizeWhitespace([name, trip].filter(Boolean).join(" ")) || undefined;
}

function explicitRole(record: PostRecord): ForumRole | undefined {
  if (
    record.post.querySelector(
      ".capcodeAdmin, .capcode-admin, .capcode.admin, .capcode.id_admin",
    )
  ) {
    return "admin";
  }
  if (
    record.post.querySelector(
      ".capcodeMod, .capcode-mod, .capcode.mod, .capcode.id_mod",
    )
  ) {
    return "mod";
  }
  for (const capcode of record.post.querySelectorAll(".capcode")) {
    const text = normalizeWhitespace(capcode.textContent ?? "");
    if (/^#{0,2}\s*(?:admin|administrator)$/i.test(text)) return "admin";
    if (/^#{0,2}\s*(?:mod|moderator)$/i.test(text)) return "mod";
  }
  return record.container.classList.contains("opContainer") ? "op" : undefined;
}

function extractTimestamp(post: Element): string | undefined {
  const element = post.querySelector(".dateTime");
  if (!element) return undefined;
  const candidates = [
    element.getAttribute("datetime"),
    element.getAttribute("title"),
    element.textContent,
    element.getAttribute("data-utc"),
  ];
  for (const candidate of candidates) {
    const value = normalizeWhitespace(candidate ?? "");
    if (value) return value;
  }
  return undefined;
}

function extractLinks(elements: readonly Element[], baseUrl?: string): string[] {
  return elements.flatMap((element) =>
    Array.from(element.querySelectorAll("a[href]"))
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href): href is string => Boolean(href?.trim()))
      .map((href) => resolveUrl(href, baseUrl)),
  );
}

function extractContent(
  record: PostRecord,
  baseUrl?: string,
): { text: string; html?: string; links: string[] } {
  const fileText = record.container.querySelector(":scope > .file .fileText");
  const message = record.post.querySelector(":scope > .postMessage");
  const elements = [fileText, message].filter((element): element is Element => Boolean(element));
  const text = elements
    .map((element) => cleanText(element.textContent ?? ""))
    .filter(Boolean)
    .join("\n");
  const document = record.post.ownerDocument;
  if (!document || elements.length === 0) return { text, links: [] };

  const wrapper = document.createElement("div");
  for (const element of elements) wrapper.append(element.cloneNode(true));
  return { text, html: wrapper.innerHTML || undefined, links: extractLinks(elements, baseUrl) };
}

function quotedParentId(
  record: PostRecord,
  knownIds: ReadonlySet<string>,
): string | undefined {
  for (const quote of record.post.querySelectorAll(".postMessage .quotelink[href]")) {
    const id = fragmentPostId(quote.getAttribute("href"));
    if (id && id !== record.id && knownIds.has(id)) return id;
  }
  return undefined;
}

/** Best-effort extraction for one 4chan thread page without loading its media. */
export function extractThreadFourChan(
  root: ParentNode,
  options: FourChanExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const thread = findThread(root);
  const records = thread ? findPostRecords(thread) : [];
  const knownIds = new Set(records.map((record) => record.id));
  const opId = records.find((record) => record.container.classList.contains("opContainer"))?.id;

  const posts = ensureUniquePostIds(
    records.map((record) => {
      const isReply = record.container.classList.contains("replyContainer");
      const content = extractContent(record, baseUrl);
      const parentId = isReply ? (quotedParentId(record, knownIds) ?? opId) : undefined;
      const href = permalinkHref(record);
      return createPost({
        id: record.id,
        author: extractAuthor(record.post),
        role: explicitRole(record),
        timestamp: extractTimestamp(record.post),
        contentText: content.text,
        contentHtml: content.html,
        permalink: href ? resolveUrl(href, baseUrl) : undefined,
        parentId,
        depth: isReply ? 1 : 0,
        links: content.links,
      });
    }),
  );

  const result: ExtractedThread = { posts };
  const title = extractTitle(root, records);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
