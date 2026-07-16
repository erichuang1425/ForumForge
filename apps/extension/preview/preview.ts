import { createPageReaderView, type PageReaderView } from "../src/pageReader";
import {
  getPreviewStory,
  PREVIEW_STORIES,
  type PreviewState,
  type PreviewStory,
} from "./fixtures";

type PreviewControl = {
  readonly storyId: string;
  readonly state: PreviewState;
  readonly shadow: ShadowRoot;
  open(): void;
  close(): void;
};

declare global {
  interface Window {
    __FORUMFORGE_PREVIEW__: PreviewControl;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Preview shell is missing ${selector}`);
  return found;
}

function previewHref(storyId: string, state: PreviewState): string {
  const params = new URLSearchParams({ story: storyId, state });
  return `?${params.toString()}`;
}

function renderStoryNavigation(current: PreviewStory, state: PreviewState): void {
  const navigation = requiredElement<HTMLElement>("[data-preview-stories]");
  for (const story of PREVIEW_STORIES) {
    const link = document.createElement("a");
    link.href = previewHref(story.id, state);
    link.textContent = story.label;
    if (story.id === current.id) link.setAttribute("aria-current", "page");
    navigation.append(link);
  }

  const stateLink = requiredElement<HTMLAnchorElement>("[data-preview-state-link]");
  const nextState: PreviewState = state === "open" ? "launcher" : "open";
  stateLink.href = previewHref(current.id, nextState);
  stateLink.textContent = nextState === "open" ? "Open reader" : "Inspect launcher";
}

function renderLegacyBackdrop(story: PreviewStory): void {
  document.documentElement.lang = story.lang;
  document.title = `${story.label} · ForumForge visual preview`;
  document.body.dataset.story = story.id;
  document.body.dataset.layout = story.thread.layout;
  requiredElement<HTMLElement>("[data-preview-label]").textContent = story.label;
  requiredElement<HTMLElement>("[data-preview-description]").textContent = story.description;
  requiredElement<HTMLElement>("[data-forum-title]").textContent = story.thread.title ?? "Thread";
  requiredElement<HTMLElement>("[data-forum-source]").textContent = new URL(
    story.sourceUrl,
  ).hostname;

  const rows = requiredElement<HTMLElement>("[data-forum-posts]");
  for (const [index, post] of story.thread.posts.entries()) {
    const article = document.createElement("article");
    article.className = "legacy-post";
    const meta = document.createElement("p");
    meta.className = "legacy-post__meta";
    meta.textContent = `${index + 1}. ${post.author} · ${post.timestamp ?? "time unavailable"}`;
    const body = document.createElement("p");
    body.textContent = post.contentText;
    article.append(meta, body);
    rows.append(article);
  }
}

const params = new URLSearchParams(window.location.search);
const story = getPreviewStory(params.get("story"));
const state: PreviewState = params.get("state") === "launcher" ? "launcher" : "open";
const focus = params.get("focus");
renderLegacyBackdrop(story);
renderStoryNavigation(story, state);

const saved = new Set(story.savedPostIds);
const notes = new Map<string, string>(story.userNotes);
let view: PageReaderView;
view = createPageReaderView(document, story.thread, {
  sourceUrl: story.sourceUrl,
  newPostIds: new Set(story.newPostIds),
  savedPostIds: saved,
  userNotes: notes,
  storageNotice: "Deterministic local preview · no browser storage is written",
  callbacks: {
    async onSave(postId) {
      if (saved.has(postId)) saved.delete(postId);
      else saved.add(postId);
      return saved.has(postId);
    },
    async onNoteSave(author, note) {
      if (note.trim()) notes.set(author, note);
      else notes.delete(author);
    },
    async onOpenLibrary() {
      view.setStatus("The local-library window is intentionally omitted from this visual preview.");
      return true;
    },
    onRefresh() {
      view.setStatus("Preview fixture restored; no page or network request was made.", "success");
    },
  },
});
view.mount();
if (state === "open") {
  view.open();
  if (focus === "accepted-answer") {
    view.shadow
      .querySelector<HTMLElement>(".ff-post[data-accepted='true']")
      ?.scrollIntoView({ behavior: "auto", block: "center" });
  }
}

window.__FORUMFORGE_PREVIEW__ = {
  storyId: story.id,
  state,
  shadow: view.shadow,
  open: () => view.open(),
  close: () => view.close(),
};
