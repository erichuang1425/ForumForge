import type { ExtractedThread } from "@forumforge/parser";
import {
  setNoteState,
  setSaveButtonState,
  type RenderOptions,
} from "./render";
import { renderPageThread } from "./pageThreadRenderer";
import { PAGE_READER_STYLES } from "./pageReaderStyles";

export type PageReaderCallbacks = {
  onSave?(postId: string): Promise<boolean>;
  onNoteSave?(author: string, note: string): Promise<void>;
  onOpenLibrary?(): Promise<boolean>;
  onRefresh?(): void;
};

export type PageReaderOptions = RenderOptions & {
  sourceUrl: string;
  callbacks?: PageReaderCallbacks;
  persistenceDisabled?: boolean;
  storageNotice?: string;
};

export type PageReaderView = {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  mount(): void;
  open(): void;
  close(): void;
  destroy(): void;
  isOpen(): boolean;
  resetLocalState(): void;
  setPersistenceDisabled(disabled: boolean): void;
  setStatus(message: string, state?: "idle" | "success" | "error"): void;
};

const HOST_TAG = "forumforge-reader";

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

function button(doc: Document, className: string, text: string): HTMLButtonElement {
  const control = element(doc, "button", className, text);
  control.type = "button";
  return control;
}

function sourceLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname || "Original forum";
  } catch {
    return "Original forum";
  }
}

function participantCount(thread: ExtractedThread): number {
  return new Set(thread.posts.map((post) => post.author.trim().toLocaleLowerCase())).size;
}

function scrollToPost(root: ParentNode, selector: string): void {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target || typeof target.scrollIntoView !== "function") return;
  const reduceMotion =
    target.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

function isElementTarget(value: EventTarget | null): value is Element {
  return typeof value === "object" && value !== null && "closest" in value;
}

function isRenderedFocusControl(control: HTMLElement): boolean {
  if (control.closest("[hidden]")) return false;
  if (typeof control.getClientRects === "function" && control.getClientRects().length === 0) {
    return false;
  }
  const visibility = control.ownerDocument.defaultView?.getComputedStyle?.(control).visibility;
  return visibility !== "hidden" && visibility !== "collapse";
}

/**
 * Build the complete on-page reading studio in a closed shadow root. The caller
 * owns storage and extraction callbacks; this view owns layout, focus, local UI
 * state, and the compact edge launcher.
 */
export function createPageReaderView(
  doc: Document,
  thread: ExtractedThread,
  options: PageReaderOptions,
): PageReaderView {
  const callbacks = options.callbacks ?? {};
  const host = doc.createElement(HOST_TAG);
  const documentLanguage = doc.documentElement.lang.trim();
  if (documentLanguage) host.lang = documentLanguage;
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "0", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  host.style.setProperty("pointer-events", "none", "important");
  const shadow = host.attachShadow({ mode: "closed" });

  const style = doc.createElement("style");
  style.textContent = PAGE_READER_STYLES;

  const launcher = button(doc, "ff-launcher", "");
  launcher.setAttribute("aria-label", "Open ForumForge reader");
  launcher.setAttribute("aria-expanded", "false");
  launcher.setAttribute("aria-controls", "ff-page-reader");
  launcher.title = "Read this thread with ForumForge";
  const launcherMark = element(doc, "span", "ff-launcher__mark");
  launcherMark.setAttribute("aria-hidden", "true");
  launcher.append(launcherMark);

  const reader = element(doc, "section", "ff-reader");
  reader.id = "ff-page-reader";
  reader.hidden = true;
  const dialog = element(doc, "div", "ff-reader__dialog");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "ff-reader-title");

  const topbar = element(doc, "header", "ff-reader__topbar");
  const brand = element(doc, "div", "ff-reader__brand");
  const brandMark = element(doc, "span", "ff-reader__brand-mark", "F");
  brandMark.setAttribute("aria-hidden", "true");
  const brandCopy = element(doc, "div", "ff-reader__brand-copy");
  brandCopy.append(
    element(doc, "p", "ff-reader__app-name", "ForumForge Reader"),
    element(doc, "p", "ff-reader__source", sourceLabel(options.sourceUrl)),
  );
  brand.append(brandMark, brandCopy);

  const topActions = element(doc, "div", "ff-reader__top-actions");
  const refresh = button(doc, "ff-reader__button ff-reader__refresh", "Refresh thread");
  const topLibrary = button(
    doc,
    "ff-reader__button ff-reader__library ff-reader__top-library",
    "Local library",
  );
  const close = button(doc, "ff-reader__button ff-reader__close", "Return to forum");
  close.setAttribute("aria-label", "Close ForumForge and return to the original forum");
  topActions.append(refresh, topLibrary, close);
  topbar.append(brand, topActions);

  const viewport = element(doc, "div", "ff-reader__viewport");
  const workspace = element(doc, "div", "ff-reader__workspace");
  const rail = element(doc, "aside", "ff-reader__rail");
  rail.setAttribute("aria-label", "Thread overview");
  const title = element(
    doc,
    "h1",
    "ff-reader__rail-title",
    thread.title || "This discussion",
  );
  title.id = "ff-reader-title";
  const postCount = thread.posts.length;
  const peopleCount = participantCount(thread);
  const dek = element(
    doc,
    "p",
    "ff-reader__dek",
    postCount === 0
      ? "A quiet page so far. ForumForge could not find a readable conversation here."
      : "A focused view of the conversation, with the forum chrome set aside.",
  );
  const metrics = element(doc, "div", "ff-reader__metrics");
  const postsMetric = element(doc, "div", "ff-reader__metric ff-reader__metric--posts");
  postsMetric.append(
    element(doc, "strong", "", String(postCount)),
    element(doc, "span", "", postCount === 1 ? "Post" : "Posts"),
  );
  const peopleMetric = element(doc, "div", "ff-reader__metric ff-reader__metric--people");
  peopleMetric.append(
    element(doc, "strong", "", String(peopleCount)),
    element(doc, "span", "", peopleCount === 1 ? "Voice" : "Voices"),
  );
  metrics.append(postsMetric, peopleMetric);

  const jumpList = element(doc, "nav", "ff-reader__jump-list");
  jumpList.setAttribute("aria-label", "Jump through conversation");
  const jumpStart = button(doc, "ff-reader__jump", "");
  jumpStart.append(element(doc, "span", "", "Opening post"), element(doc, "span", "", "↑"));
  const jumpLatest = button(doc, "ff-reader__jump", "");
  jumpLatest.append(element(doc, "span", "", "Latest reply"), element(doc, "span", "", "↓"));
  jumpList.append(jumpStart, jumpLatest);
  if ((options.newPostIds?.size ?? 0) > 0) {
    const jumpNew = button(doc, "ff-reader__jump ff-reader__jump--new", "");
    jumpNew.append(
      element(doc, "span", "", "First unread"),
      element(doc, "span", "", `${options.newPostIds?.size ?? 0} new`),
    );
    jumpNew.addEventListener("click", () => scrollToPost(shadow, ".ff-post[data-new='true']"));
    jumpList.append(jumpNew);
  }
  rail.append(
    element(doc, "p", "ff-reader__eyebrow", "Thread reader"),
    title,
    dek,
    metrics,
    jumpList,
  );

  const main = element(doc, "main", "ff-reader__main");
  main.tabIndex = -1;
  const intro = element(doc, "div", "ff-reader__intro");
  intro.append(
    element(doc, "h2", "", "Conversation"),
    element(doc, "p", "", postCount === 1 ? "1 contribution" : `${postCount} contributions`),
  );
  const status = element(doc, "p", "ff-reader__status", options.storageNotice ?? "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const rendered = renderPageThread(doc, thread, {
    newPostIds: options.newPostIds,
    savedPostIds: options.savedPostIds,
    userNotes: options.userNotes,
    showTitle: false,
  });
  main.append(intro, status, rendered);

  const tools = element(doc, "aside", "ff-reader__tools");
  tools.setAttribute("aria-label", "Reading tools");
  const toolsCard = element(doc, "section", "ff-reader__tools-card");
  const toolsList = element(doc, "ul", "ff-reader__tools-list");
  for (const text of [
    "Read history marks what changed",
    "Saved posts remain searchable",
    "Author notes stay private",
  ]) {
    toolsList.append(element(doc, "li", "", text));
  }
  const toolsLibrary = button(doc, "ff-reader__library", "Open local library");
  toolsCard.append(
    element(doc, "p", "ff-reader__tools-label", "Stays on this device"),
    element(doc, "h2", "", "Your reading layer"),
    element(
      doc,
      "p",
      "",
      "ForumForge reorganizes this page locally. It does not send the thread anywhere.",
    ),
    toolsList,
    toolsLibrary,
  );
  tools.append(toolsCard);

  workspace.append(rail, main, tools);
  viewport.append(workspace);
  dialog.append(topbar, viewport);
  reader.append(dialog);
  shadow.append(style, launcher, reader);

  let open = false;
  let mounted = false;
  let previousFocus: HTMLElement | null = null;
  let previousOverflow = "";
  let previousBodyInert = false;
  let persistenceDisabled = options.persistenceDisabled ?? false;

  function setStatus(
    message: string,
    state: "idle" | "success" | "error" = "idle",
  ): void {
    status.textContent = message;
    status.setAttribute("data-state", state);
  }

  function setPersistenceDisabled(disabled: boolean): void {
    persistenceDisabled = disabled;
    for (const control of shadow.querySelectorAll<HTMLButtonElement>(
      ".ff-post__save, .ff-post__note-toggle, .ff-post__note-save",
    )) {
      control.disabled = disabled;
    }
    for (const input of shadow.querySelectorAll<HTMLTextAreaElement>(".ff-post__note-input")) {
      input.disabled = disabled;
    }
  }

  function resetLocalState(): void {
    for (const save of shadow.querySelectorAll<HTMLElement>(".ff-post__save")) {
      setSaveButtonState(save, false);
    }
    for (const post of shadow.querySelectorAll<HTMLElement>(".ff-post")) {
      setNoteState(post, "");
      const editor = post.querySelector<HTMLElement>(".ff-post__note");
      const toggle = post.querySelector<HTMLElement>(".ff-post__note-toggle");
      if (editor) editor.hidden = true;
      toggle?.setAttribute("aria-expanded", "false");
      post.removeAttribute("data-new");
    }
  }

  function openReader(): void {
    if (open) return;
    open = true;
    previousFocus = doc.activeElement as HTMLElement | null;
    previousOverflow = doc.documentElement.style.overflow;
    previousBodyInert = doc.body.inert;
    doc.documentElement.style.overflow = "hidden";
    doc.body.inert = true;
    reader.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    launcher.setAttribute("aria-label", "Close ForumForge reader");
    close.focus();
  }

  function closeReader(): void {
    if (!open) return;
    open = false;
    reader.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open ForumForge reader");
    doc.documentElement.style.overflow = previousOverflow;
    doc.body.inert = previousBodyInert;
    if (
      previousFocus &&
      previousFocus !== doc.body &&
      previousFocus !== doc.documentElement &&
      previousFocus.isConnected &&
      typeof previousFocus.focus === "function"
    ) {
      previousFocus.focus();
    } else {
      launcher.focus();
    }
  }

  launcher.addEventListener("click", () => {
    if (open) closeReader();
    else openReader();
  });
  close.addEventListener("click", closeReader);
  refresh.addEventListener("click", () => callbacks.onRefresh?.());
  jumpStart.addEventListener("click", () =>
    scrollToPost(shadow, ".ff-post[data-source-index='0']"),
  );
  jumpLatest.addEventListener("click", () =>
    scrollToPost(shadow, `.ff-post[data-source-index='${Math.max(0, postCount - 1)}']`),
  );

  shadow.addEventListener("click", (event) => {
    if (!isElementTarget(event.target)) return;
    const save = event.target.closest<HTMLButtonElement>(".ff-post__save");
    if (save && callbacks.onSave) {
      const postId = save.getAttribute("data-post-id");
      if (!postId) return;
      save.disabled = true;
      void callbacks.onSave(postId).then(
        (saved) => {
          setSaveButtonState(save, saved);
          setStatus(saved ? "Saved locally." : "Removed from saved posts.", "success");
        },
        () => setStatus("Couldn't update this saved post.", "error"),
      ).finally(() => {
        save.disabled = persistenceDisabled;
      });
      return;
    }

    const noteToggle = event.target.closest<HTMLButtonElement>(".ff-post__note-toggle");
    if (noteToggle) {
      const post = noteToggle.closest<HTMLElement>(".ff-post");
      const editor = post?.querySelector<HTMLElement>(".ff-post__note");
      if (!editor) return;
      const expanded = editor.hidden;
      editor.hidden = !expanded;
      noteToggle.setAttribute("aria-expanded", String(expanded));
      if (expanded) editor.querySelector<HTMLTextAreaElement>(".ff-post__note-input")?.focus();
      return;
    }

    const noteSave = event.target.closest<HTMLButtonElement>(".ff-post__note-save");
    if (noteSave && callbacks.onNoteSave) {
      const editor = noteSave.closest<HTMLElement>(".ff-post__note");
      const author = editor?.getAttribute("data-author");
      const input = editor?.querySelector<HTMLTextAreaElement>(".ff-post__note-input");
      if (author === null || author === undefined || !input) return;
      const note = input.value;
      noteSave.disabled = true;
      void callbacks.onNoteSave(author, note).then(
        () => {
          for (const post of shadow.querySelectorAll<HTMLElement>(".ff-post")) {
            const matching = post.querySelector<HTMLElement>(".ff-post__note");
            if (matching?.getAttribute("data-author") !== author) continue;
            if (matching) setNoteState(post, note);
          }
          setStatus(note.trim() ? "Private author note saved." : "Private author note removed.", "success");
        },
        () => setStatus("Couldn't save this private note.", "error"),
      ).finally(() => {
        noteSave.disabled = persistenceDisabled;
      });
      return;
    }

    const library = event.target.closest<HTMLButtonElement>(".ff-reader__library");
    if (library && callbacks.onOpenLibrary) {
      library.disabled = true;
      void callbacks.onOpenLibrary().then(
        (opened) => {
          if (!opened) setStatus("Couldn't open the local library.", "error");
        },
        () => setStatus("Couldn't open the local library.", "error"),
      ).finally(() => {
        library.disabled = false;
      });
    }
  });

  shadow.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (!open) return;
    if (keyEvent.key === "Escape") {
      keyEvent.preventDefault();
      closeReader();
      return;
    }
    if (keyEvent.key !== "Tab") return;
    const controls = Array.from(
      shadow.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], textarea:not([disabled]), [tabindex='0']",
      ),
    ).filter(isRenderedFocusControl);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first || !last) return;
    if (keyEvent.shiftKey && shadow.activeElement === first) {
      keyEvent.preventDefault();
      last.focus();
    } else if (!keyEvent.shiftKey && shadow.activeElement === last) {
      keyEvent.preventDefault();
      first.focus();
    }
  });

  if (persistenceDisabled) setPersistenceDisabled(true);

  return {
    host,
    shadow,
    mount() {
      if (mounted) return;
      mounted = true;
      doc.documentElement.append(host);
    },
    open: openReader,
    close: closeReader,
    destroy() {
      closeReader();
      host.remove();
      mounted = false;
    },
    isOpen: () => open,
    resetLocalState,
    setPersistenceDisabled,
    setStatus,
  };
}
