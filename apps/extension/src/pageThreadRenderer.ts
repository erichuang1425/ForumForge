import type { ForumForgePost, ForumPostKind, ForumReaction } from "@forumforge/core";
import type { ExtractedThread } from "@forumforge/parser";
import {
  renderPostItem,
  renderThread,
  type PostRenderState,
  type RenderOptions,
} from "./render";
import {
  buildThreadPresentation,
  type PresentedPost,
  type ThreadPresentation,
} from "./threadPresentation";

const KIND_LABELS: Record<ForumPostKind, string> = {
  topic: "Topic",
  article: "Article",
  question: "Question",
  answer: "Answer",
  comment: "Comment",
  reply: "Reply",
};

const REACTION_LABELS: Record<ForumReaction, string> = {
  push: "Push",
  boo: "Boo",
  neutral: "Neutral",
};

type RenderContext = {
  doc: Document;
  thread: ExtractedThread;
  options: RenderOptions;
  presentation: ThreadPresentation;
  rendered: Set<number>;
};

function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function initials(author: string): string {
  const words = author.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return Array.from(words[0] ?? "?").slice(0, 2).join("").toUpperCase();
  return `${Array.from(words[0] ?? "?")[0] ?? "?"}${Array.from(words.at(-1) ?? "?")[0] ?? "?"}`.toUpperCase();
}

function stateFor(options: RenderOptions, post: ForumForgePost): PostRenderState {
  return {
    isNew: options.newPostIds?.has(post.id) ?? false,
    isSaved: options.savedPostIds?.has(post.id) ?? false,
    note: options.userNotes?.get(post.author) ?? "",
  };
}

function addSemanticLabel(
  doc: Document,
  identity: HTMLElement,
  className: string,
  text: string,
): void {
  identity.append(element(doc, "span", className, text));
}

function decoratePost(context: RenderContext, item: HTMLElement, node: PresentedPost): void {
  const { doc, presentation } = context;
  const { post } = node;
  item.setAttribute("data-source-index", String(node.index));
  item.setAttribute("data-visual-depth", String(node.visualDepth));
  item.setAttribute("data-tone", String(node.index % 3));

  const identity = item.querySelector<HTMLElement>(".ff-post__identity");
  if (identity) {
    if (presentation.layout !== "imageboard") {
      const avatar = element(doc, "span", "ff-post__avatar", initials(post.author));
      avatar.setAttribute("aria-hidden", "true");
      identity.prepend(avatar);
    }
    if (post.kind && ["topic", "article", "question", "answer"].includes(post.kind)) {
      addSemanticLabel(doc, identity, "ff-post__kind", KIND_LABELS[post.kind]);
    }
    if (post.reaction) {
      addSemanticLabel(doc, identity, "ff-post__reaction", REACTION_LABELS[post.reaction]);
    }
    if (post.accepted) {
      addSemanticLabel(doc, identity, "ff-post__accepted", "Accepted answer");
    }
    if (node.visualDepth > 0 && presentation.layout === "nested") {
      addSemanticLabel(
        doc,
        identity,
        "ff-post__branch-level",
        `Reply level ${node.visualDepth}`,
      );
    }
  }

  const actions = item.querySelector<HTMLElement>(".ff-post__actions");
  if (actions) {
    if (post.score !== undefined) {
      const votes = `${post.score} ${Math.abs(post.score) === 1 ? "vote" : "votes"}`;
      actions.prepend(element(doc, "span", "ff-post__score", votes));
    }
    const ordinalText = presentation.source === "4chan" ? `No. ${post.id}` : `#${node.index + 1}`;
    const ordinal = element(doc, "span", "ff-post__ordinal", ordinalText);
    ordinal.setAttribute(
      "aria-label",
      presentation.source === "4chan" ? `Post number ${post.id}` : `Post ${node.index + 1}`,
    );
    actions.prepend(ordinal);
  }
}

function renderOne(context: RenderContext, node: PresentedPost): HTMLElement | undefined {
  if (context.rendered.has(node.index)) return undefined;
  context.rendered.add(node.index);
  const item = renderPostItem(
    context.doc,
    node.post,
    context.thread.baseUrl,
    node.index,
    stateFor(context.options, node.post),
  );
  decoratePost(context, item, node);
  return item;
}

function renderList(
  context: RenderContext,
  nodes: readonly PresentedPost[],
  className: string,
  nested: boolean,
): HTMLOListElement {
  const list = element(context.doc, "ol", `ff-posts ${className}`);
  for (const node of nodes) {
    const item = renderOne(context, node);
    if (!item) continue;
    if (nested && node.children.length > 0) {
      const children = renderList(context, node.children, "ff-posts--branch", true);
      if (children.childElementCount > 0) item.append(children);
    }
    list.append(item);
  }
  return list;
}

function appendRemaining(context: RenderContext, root: HTMLElement): void {
  const remaining = context.presentation.nodes.filter((node) => !context.rendered.has(node.index));
  if (remaining.length === 0) return;
  const fallback = element(context.doc, "section", "ff-page-thread__fallback");
  fallback.append(renderList(context, remaining, "ff-posts--fallback", false));
  root.append(fallback);
}

function renderLinear(context: RenderContext, root: HTMLElement): void {
  root.append(renderList(context, context.presentation.nodes, "ff-posts--linear", false));
}

function renderNested(context: RenderContext, root: HTMLElement): void {
  root.append(renderList(context, context.presentation.roots, "ff-posts--nested", true));
  appendRemaining(context, root);
}

function renderArticleComments(context: RenderContext, root: HTMLElement): void {
  const lead = context.presentation.nodes.find((node) => node.post.kind === "article");
  if (!lead) {
    renderLinear(context, root);
    return;
  }

  const leadSection = element(context.doc, "section", "ff-page-thread__lead");
  leadSection.setAttribute("aria-label", "Article");
  leadSection.append(renderList(context, [lead], "ff-posts--lead", false));
  root.append(leadSection);

  const commentRoots = [
    ...lead.children,
    ...context.presentation.roots.filter((node) => node !== lead),
  ];
  if (commentRoots.length > 0) {
    const comments = element(context.doc, "section", "ff-page-thread__comments");
    comments.append(
      element(context.doc, "h2", "ff-page-thread__section-title", "Discussion"),
      renderList(context, commentRoots, "ff-posts--comments", true),
    );
    root.append(comments);
  }
  appendRemaining(context, root);
}

function renderPtt(context: RenderContext, root: HTMLElement): void {
  const article = context.presentation.nodes.find((node) => node.post.kind === "article");
  if (article) {
    const lead = element(context.doc, "section", "ff-page-thread__lead ff-page-thread__lead--ptt");
    lead.setAttribute("aria-label", "PTT article");
    lead.append(renderList(context, [article], "ff-posts--lead", false));
    root.append(lead);
  }
  const pushes = context.presentation.nodes.filter((node) => node !== article);
  if (pushes.length > 0) {
    const reactions = element(context.doc, "section", "ff-page-thread__reactions");
    reactions.append(
      element(context.doc, "h2", "ff-page-thread__section-title", "Reactions"),
      renderList(context, pushes, "ff-posts--reactions", false),
    );
    root.append(reactions);
  }
  appendRemaining(context, root);
}

function renderImageboard(context: RenderContext, root: HTMLElement): void {
  root.append(renderList(context, context.presentation.nodes, "ff-posts--imageboard", false));
}

function renderQa(context: RenderContext, root: HTMLElement): void {
  const question = context.presentation.nodes.find((node) => node.post.kind === "question");
  if (!question) {
    root.append(renderList(context, context.presentation.nodes, "ff-posts--qa-fallback", false));
    return;
  }

  const questionSection = element(context.doc, "section", "ff-page-thread__question");
  questionSection.append(
    element(context.doc, "h2", "ff-page-thread__section-title", "Question"),
    renderList(context, [question], "ff-posts--question", false),
  );
  const questionComments = question.children.filter((node) => node.post.kind === "comment");
  if (questionComments.length > 0) {
    questionSection.append(
      renderList(context, questionComments, "ff-posts--question-comments", true),
    );
  }
  root.append(questionSection);

  const answers = context.presentation.nodes.filter((node) => node.post.kind === "answer");
  if (answers.length > 0) {
    const answersSection = element(context.doc, "section", "ff-page-thread__answers");
    answersSection.append(
      element(
        context.doc,
        "h2",
        "ff-page-thread__section-title",
        `${answers.length} ${answers.length === 1 ? "Answer" : "Answers"}`,
      ),
      renderList(context, answers, "ff-posts--answers", true),
    );
    root.append(answersSection);
  }
  appendRemaining(context, root);
}

/** Render the immersive reader's discussion-aware view using shared safe post primitives. */
export function renderPageThread(
  doc: Document,
  thread: ExtractedThread,
  options: RenderOptions = {},
): HTMLElement {
  const presentation = buildThreadPresentation(thread);
  const root = element(doc, "section", "ff-page-thread");
  root.setAttribute("data-layout", presentation.layout);
  if (presentation.source) root.setAttribute("data-source", presentation.source);

  if (thread.posts.length === 0) {
    root.append(renderThread(doc, thread, { ...options, showTitle: false }));
    return root;
  }

  const context: RenderContext = {
    doc,
    thread,
    options,
    presentation,
    rendered: new Set<number>(),
  };

  switch (presentation.layout) {
    case "article-comments":
      renderArticleComments(context, root);
      break;
    case "nested":
      renderNested(context, root);
      break;
    case "ptt":
      renderPtt(context, root);
      break;
    case "imageboard":
      renderImageboard(context, root);
      break;
    case "qa":
      renderQa(context, root);
      break;
    case "linear":
      renderLinear(context, root);
      break;
  }

  appendRemaining(context, root);
  return root;
}
