import { cleanText, createPost, normalizeWhitespace } from "@forumforge/core";
import { ensureUniquePostIds } from "./ids";
import type { ExtractedThread, ExtractOptions } from "./types";
import { documentBaseUrl, resolveUrl } from "./url";

export type StackOverflowExtractOptions = ExtractOptions;

const ANSWER_ELEMENT_ID = /^answer-(\d+)$/;
const COMMENT_ELEMENT_ID = /^comment-(\d+)$/;
const USER_PATH = /^\/users\/(\d+)(?:\/|$)/;
const MEDIA_SELECTOR = "img, picture, source, audio, video, iframe, embed, object";
const MEDIA_PLACEHOLDER = "[Media omitted — open the original thread to view it.]";

type Identity = {
  author?: string;
  authorUrl?: string;
  key?: string;
};

type SignedQuestion = {
  element: Element;
  id: string;
  titleAnchor: Element;
};

type SignedPost = {
  element: Element;
  id: string;
  permalink: string;
};

function matchingElement(root: ParentNode, selector: string): Element | undefined {
  const candidate = root as ParentNode & { matches?: (value: string) => boolean };
  return candidate.matches?.(selector) ? (root as unknown as Element) : undefined;
}

function parsedUrl(href: string, baseUrl?: string): URL | undefined {
  try {
    const parsed = new URL(href, baseUrl ?? "https://forumforge.invalid/");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function questionIdFromHref(href: string, baseUrl?: string): string | undefined {
  const path = parsedUrl(href, baseUrl)?.pathname ?? "";
  return /^\/questions\/(\d+)(?:\/|$)/.exec(path)?.[1];
}

function pageScope(element: Element, root: ParentNode): ParentNode {
  return element.ownerDocument ?? root;
}

function findSignedQuestion(root: ParentNode, baseUrl?: string): SignedQuestion | undefined {
  const candidates = new Set<Element>();
  const matching = matchingElement(root, "#question.question[data-questionid]");
  if (matching) candidates.add(matching);
  for (const candidate of root.querySelectorAll("#question.question[data-questionid]")) {
    candidates.add(candidate);
  }

  for (const element of candidates) {
    const id = element.getAttribute("data-questionid")?.trim() ?? "";
    if (!/^\d+$/.test(id) || !element.querySelector(":scope .s-prose.js-post-body")) continue;
    const scope = pageScope(element, root);
    const titleAnchor = Array.from(scope.querySelectorAll("h1 a.question-hyperlink[href]")).find(
      (anchor) => {
        const href = anchor.getAttribute("href")?.trim();
        return href ? questionIdFromHref(href, baseUrl) === id : false;
      },
    );
    if (titleAnchor) return { element, id, titleAnchor };
  }
  return undefined;
}

/**
 * Stack Overflow lists reuse question links, so detection requires one coherent
 * question element, numeric identity, matching title permalink, and post body.
 */
export function isStackOverflowPage(root: ParentNode): boolean {
  return Boolean(findSignedQuestion(root, documentBaseUrl(root)));
}

function coherentSharePermalink(
  post: Element,
  postId: string,
  kind: "q" | "a",
  baseUrl?: string,
): string | undefined {
  for (const anchor of post.querySelectorAll(".js-post-menu a.js-share-link[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    const parsed = href ? parsedUrl(href, baseUrl) : undefined;
    if (href && parsed?.pathname === `/${kind}/${postId}`) return resolveUrl(href, baseUrl);
  }
  return undefined;
}

function postIdentity(post: Element, baseUrl?: string): Identity {
  const author = normalizeWhitespace(post.getAttribute("data-author-username") ?? "") || undefined;
  if (!author) return {};
  for (const anchor of post.querySelectorAll(".post-signature .user-details a[href]")) {
    if (normalizeWhitespace(anchor.textContent ?? "") !== author) continue;
    const href = anchor.getAttribute("href")?.trim();
    const parsed = href ? parsedUrl(href, baseUrl) : undefined;
    const userId = parsed ? USER_PATH.exec(parsed.pathname)?.[1] : undefined;
    if (href && userId) {
      return {
        author,
        authorUrl: resolveUrl(href, baseUrl),
        key: `user:${userId}`,
      };
    }
  }
  return { author };
}

function commentIdentity(comment: Element, baseUrl?: string): Identity {
  const anchor = comment.querySelector(".comment-user[href]");
  const author = normalizeWhitespace(anchor?.textContent ?? "") || undefined;
  const href = anchor?.getAttribute("href")?.trim();
  const parsed = href ? parsedUrl(href, baseUrl) : undefined;
  const userId = parsed ? USER_PATH.exec(parsed.pathname)?.[1] : undefined;
  return {
    author,
    authorUrl: href && userId ? resolveUrl(href, baseUrl) : undefined,
    key: userId ? `user:${userId}` : undefined,
  };
}

function postTimestamp(post: Element): string | undefined {
  const created = post.querySelector('time[itemprop="dateCreated"][datetime]');
  const datetime = created?.getAttribute("datetime")?.trim();
  if (datetime) return datetime;
  const ownerCreated = post.querySelector(
    ".post-signature.owner .user-action-time .relativetime[title]",
  );
  return ownerCreated?.getAttribute("title")?.trim() || undefined;
}

function commentTimestamp(comment: Element): string | undefined {
  const raw = comment
    .querySelector(".comment-date .relativetime-clean[title]")
    ?.getAttribute("title")
    ?.trim();
  return raw?.replace(/,\s*License:.*$/i, "").trim() || undefined;
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

function signedAnswers(scope: ParentNode, questionId: string, baseUrl?: string): SignedPost[] {
  return Array.from(scope.querySelectorAll("#answers .answer[data-answerid]")).flatMap(
    (element) => {
      const id = element.getAttribute("data-answerid")?.trim() ?? "";
      const elementId = ANSWER_ELEMENT_ID.exec(element.getAttribute("id") ?? "")?.[1];
      const parentId = element.getAttribute("data-parentid")?.trim();
      const permalink = /^\d+$/.test(id)
        ? coherentSharePermalink(element, id, "a", baseUrl)
        : undefined;
      return id && elementId === id && parentId === questionId && permalink &&
        element.querySelector(":scope .s-prose.js-post-body")
        ? [{ element, id, permalink }]
        : [];
    },
  );
}

function commentPermalink(
  comment: Element,
  commentId: string,
  parentPostId: string,
  baseUrl?: string,
): string | undefined {
  for (const anchor of comment.querySelectorAll(".comment-date a.comment-link[href]")) {
    const href = anchor.getAttribute("href")?.trim();
    if (href === `#comment${commentId}_${parentPostId}`) return resolveUrl(href, baseUrl);
  }
  return undefined;
}

function commentsForPost(post: Element, postId: string, baseUrl?: string): SignedPost[] {
  const wrapper = Array.from(post.querySelectorAll(".comments[id]")).find(
    (element) => element.getAttribute("id") === `comments-${postId}`,
  );
  if (!wrapper) return [];
  return Array.from(wrapper.querySelectorAll(".comments-list > .comment[data-comment-id]")).flatMap(
    (element) => {
      const id = element.getAttribute("data-comment-id")?.trim() ?? "";
      const elementId = COMMENT_ELEMENT_ID.exec(element.getAttribute("id") ?? "")?.[1];
      const permalink = /^\d+$/.test(id)
        ? commentPermalink(element, id, postId, baseUrl)
        : undefined;
      return id && elementId === id && permalink && element.querySelector(".comment-copy")
        ? [{ element, id, permalink }]
        : [];
    },
  );
}

function sameIdentity(left: Identity, right: Identity): boolean {
  return Boolean(left.key && right.key && left.key === right.key);
}

/** Extract one loaded Stack Overflow question, answers, and visible comments. */
export function extractThreadStackOverflow(
  root: ParentNode,
  options: StackOverflowExtractOptions = {},
): ExtractedThread {
  const baseUrl = options.baseUrl ?? documentBaseUrl(root);
  const signedQuestion = findSignedQuestion(root, baseUrl);
  if (!signedQuestion) return baseUrl ? { baseUrl, posts: [] } : { posts: [] };

  const { element: questionElement, id: questionId, titleAnchor } = signedQuestion;
  const scope = pageScope(questionElement, root);
  const questionPermalink =
    coherentSharePermalink(questionElement, questionId, "q", baseUrl) ??
    resolveUrl(titleAnchor.getAttribute("href") ?? "", baseUrl);
  const opIdentity = postIdentity(questionElement, baseUrl);
  const questionContent = extractContent(
    questionElement.querySelector(":scope .s-prose.js-post-body"),
    baseUrl,
  );
  const question = createPost({
    id: questionId,
    ...opIdentity,
    role: opIdentity.author ? "op" : undefined,
    timestamp: postTimestamp(questionElement),
    contentText: questionContent.text,
    contentHtml: questionContent.html,
    permalink: questionPermalink,
    depth: 0,
    links: questionContent.links,
  });

  const mapComment = (record: SignedPost, parentId: string, depth: number) => {
    const author = commentIdentity(record.element, baseUrl);
    const content = extractContent(record.element.querySelector(".comment-copy"), baseUrl);
    return createPost({
      id: record.id,
      ...author,
      role: sameIdentity(author, opIdentity) ? "op" : undefined,
      timestamp: commentTimestamp(record.element),
      contentText: content.text,
      contentHtml: content.html,
      permalink: record.permalink,
      parentId,
      depth,
      links: content.links,
    });
  };

  const questionComments = commentsForPost(questionElement, questionId, baseUrl).map((record) =>
    mapComment(record, questionId, 1),
  );
  const answers = signedAnswers(scope, questionId, baseUrl).flatMap((record) => {
    const author = postIdentity(record.element, baseUrl);
    const content = extractContent(
      record.element.querySelector(":scope .s-prose.js-post-body"),
      baseUrl,
    );
    const answer = createPost({
      id: record.id,
      ...author,
      role: sameIdentity(author, opIdentity) ? "op" : undefined,
      timestamp: postTimestamp(record.element),
      contentText: content.text,
      contentHtml: content.html,
      permalink: record.permalink,
      parentId: questionId,
      depth: 1,
      links: content.links,
    });
    const comments = commentsForPost(record.element, record.id, baseUrl).map((comment) =>
      mapComment(comment, record.id, 2),
    );
    return [answer, ...comments];
  });

  const result: ExtractedThread = {
    baseUrl: baseUrl ?? questionPermalink,
    posts: ensureUniquePostIds([question, ...questionComments, ...answers]),
  };
  const title = normalizeWhitespace(titleAnchor.textContent ?? "");
  if (title) result.title = title;
  return result;
}
