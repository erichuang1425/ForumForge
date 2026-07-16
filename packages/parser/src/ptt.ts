import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import type { ForumReaction } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type PttExtractOptions = ExtractOptions;

const ARTICLE_SELECTOR = "#main-content.bbs-screen.bbs-content";
const REQUIRED_META_LABELS = ["作者", "看板", "標題", "時間"] as const;
const STATION_FOOTER = /^※\s*發信站:\s*批踢踢實業坊/u;
const ARTICLE_FOOTER = /^(?:--|※\s*(?:發信站|文章網址|編輯|轉錄者)\s*:)/u;
const TITLE_SUFFIX = /\s+-\s+看板\s+.+?\s+-\s+批踢踢實業坊\s*$/u;

function findArticle(root: ParentNode): Element | undefined {
  const candidate = root as ParentNode & { matches?: (selector: string) => boolean };
  if (candidate.matches?.(ARTICLE_SELECTOR)) return root as unknown as Element;
  return root.querySelector(ARTICLE_SELECTOR) ?? undefined;
}

function normalizedLabel(value: string | null | undefined): string {
  return normalizeWhitespace(value ?? "").replace(/[：:]$/u, "");
}

function metadata(article: Element): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of article.querySelectorAll(":scope > .article-metaline")) {
    const label = normalizedLabel(row.querySelector(".article-meta-tag")?.textContent);
    const value = normalizeWhitespace(row.querySelector(".article-meta-value")?.textContent ?? "");
    if (label && value && !result.has(label)) result.set(label, value);
  }
  return result;
}

/**
 * PTT article pages have a uniquely signed content shell: four Chinese
 * metadata labels and the station footer inside `#main-content`. Requiring all
 * of those signals keeps board indexes and unrelated compact chat layouts on
 * the generic fallback.
 */
export function isPttPage(root: ParentNode): boolean {
  const article = findArticle(root);
  if (!article) return false;
  const meta = metadata(article);
  if (!REQUIRED_META_LABELS.every((label) => meta.has(label))) return false;
  return Array.from(article.querySelectorAll(":scope > .f2")).some((element) =>
    STATION_FOOTER.test(normalizeWhitespace(element.textContent ?? "")),
  );
}

function extractTitle(root: ParentNode, meta: ReadonlyMap<string, string>): string | undefined {
  const fromMeta = meta.get("標題");
  if (fromMeta) return fromMeta;
  const documentTitle = normalizeWhitespace(root.querySelector("title")?.textContent ?? "");
  return documentTitle.replace(TITLE_SUFFIX, "") || undefined;
}

function accountFromAuthor(author: string | undefined): string | undefined {
  return author?.match(/^([^\s(]+)/u)?.[1];
}

function extractLinks(root: ParentNode, baseUrl?: string): string[] {
  return Array.from(root.querySelectorAll("a[href]"))
    .map((anchor) => anchor.getAttribute("href"))
    .filter((href): href is string => Boolean(href?.trim()))
    .map((href) => resolveUrl(href, baseUrl));
}

function articleBody(article: Element): { text: string; html: string; links: string[] } {
  const clone = article.cloneNode(true) as Element;
  for (const element of clone.querySelectorAll(
    ":scope > .article-metaline, :scope > .article-metaline-right, :scope > .push",
  )) {
    element.remove();
  }
  for (const element of clone.querySelectorAll(":scope > .f2")) {
    if (ARTICLE_FOOTER.test(normalizeWhitespace(element.textContent ?? ""))) element.remove();
  }
  return {
    text: cleanText(clone.textContent ?? ""),
    html: clone.innerHTML,
    links: extractLinks(clone),
  };
}

function stripLeadingColon(root: Node): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 3) {
      child.textContent = (child.textContent ?? "").replace(/^\s*[：:]\s*/u, "");
      return;
    }
    stripLeadingColon(child);
    if (normalizeWhitespace(child.textContent ?? "")) return;
  }
}

function pushContent(push: Element): { text: string; html?: string } {
  const tag = normalizeWhitespace(push.querySelector(".push-tag")?.textContent ?? "");
  const content = push.querySelector(".push-content");
  const body = normalizeWhitespace(content?.textContent ?? "").replace(/^[：:]\s*/u, "");
  const text = normalizeWhitespace([tag, body].filter(Boolean).join(" "));
  const document = push.ownerDocument;
  if (!document || (!tag && !content)) return { text };

  const wrapper = document.createElement("span");
  if (tag) {
    const label = document.createElement("span");
    label.className = "ptt-push-tag";
    label.textContent = tag;
    wrapper.append(label);
  }
  if (content) {
    const clone = content.cloneNode(true) as Element;
    stripLeadingColon(clone);
    if (tag && normalizeWhitespace(clone.textContent ?? "")) wrapper.append(" ");
    for (const child of Array.from(clone.childNodes)) wrapper.append(child);
  }
  return { text, html: wrapper.innerHTML || undefined };
}

function pushReaction(push: Element): ForumReaction | undefined {
  const tag = normalizeWhitespace(push.querySelector(".push-tag")?.textContent ?? "");
  if (tag === "\u63a8") return "push";
  if (tag === "\u5653") return "boo";
  if (tag === "\u2192") return "neutral";
  return undefined;
}

/** Best-effort extraction for a PTT article and its flat push-reply stream. */
export function extractThreadPtt(
  root: ParentNode,
  options: PttExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const article = findArticle(root);
  const meta = article ? metadata(article) : new Map<string, string>();
  const author = meta.get("作者");
  const opAccount = accountFromAuthor(author);
  const body = article ? articleBody(article) : { text: "", html: "", links: [] };

  const articlePost = createPost({
    id: "article",
    author,
    role: author ? "op" : undefined,
    timestamp: meta.get("時間"),
    contentText: body.text,
    contentHtml: body.html,
    permalink: baseUrl,
    depth: 0,
    kind: "article",
    links: body.links.map((href) => resolveUrl(href, baseUrl)),
  });

  const pushPosts = article
    ? Array.from(article.querySelectorAll(":scope > .push")).map((push, index) => {
        const pushAuthor = normalizeWhitespace(
          push.querySelector(".push-userid")?.textContent ?? "",
        );
        const content = pushContent(push);
        const contentElement = push.querySelector(".push-content");
        return createPost({
          id: `push-${index + 1}`,
          author: pushAuthor || undefined,
          role: pushAuthor && opAccount && pushAuthor === opAccount ? "op" : undefined,
          timestamp:
            normalizeWhitespace(push.querySelector(".push-ipdatetime")?.textContent ?? "") ||
            undefined,
          contentText: content.text,
          contentHtml: content.html,
          permalink: baseUrl,
          parentId: "article",
          depth: 1,
          kind: "comment",
          reaction: pushReaction(push),
          links: contentElement ? extractLinks(contentElement, baseUrl) : [],
        });
      })
    : [];

  const result: ExtractedThread = {
    layout: "ptt",
    source: "ptt",
    posts: ensureUniquePostIds([articlePost, ...pushPosts]),
  };
  const title = extractTitle(root, meta);
  if (title) result.title = title;
  if (baseUrl) result.baseUrl = baseUrl;
  return result;
}
