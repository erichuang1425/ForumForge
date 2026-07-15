import type { ForumForgePost } from "@forumforge/core";
import { EXTRACT_REQUEST, isExtractResponse } from "./messaging";
import { renderThread, setSaveButtonState, setNoteState } from "./render";
import { ChromeStorageBackend } from "./storage";
import { ReadHistory } from "./readHistory";
import { SavedPosts } from "./savedPosts";
import { UserNotes } from "./userNotes";
import { savedPostsToMarkdown } from "./markdown";
import {
  CLEAR_LOCAL_DATA_FAILURE,
  CLEAR_LOCAL_DATA_PROGRESS,
  CLEAR_LOCAL_DATA_SUCCESS,
  LocalDataFocusRecovery,
  resetRenderedLocalData,
  runClearLocalData,
  setRenderedPersistenceControlsDisabled,
} from "./localDataUi";
import {
  InvalidStorageGenerationError,
  InvalidStorageSchemaVersionError,
  STORAGE_CLEAR_STATE_KEY,
  StorageClearInProgressError,
  StorageCoordinator,
  type StorageClearState,
  UnsupportedStorageSchemaVersionError,
} from "./storageSchema";

/** The built content script, injected on demand into the active tab. */
const CONTENT_SCRIPT = "content.js";

/** One on-device backend shared by every per-feature store in the panel. */
const backend = new ChromeStorageBackend();

/** Gates every feature access behind schema preparation and clear serialization. */
const storageCoordinator = new StorageCoordinator(backend);

/** Per-thread read history, persisted on-device via chrome.storage.local. */
const readHistory = new ReadHistory(backend);

/** Locally saved posts, persisted on-device via chrome.storage.local. */
const savedPosts = new SavedPosts(backend);

/** Private per-author notes, persisted on-device via chrome.storage.local. */
const userNotes = new UserNotes(backend);

/**
 * The thread currently shown in the panel, kept so a Save click can map a post
 * id back to the post (its frozen snapshot) and the page it came from. Null
 * until the first successful read.
 */
let currentThread: { url: string; title?: string; postsById: Map<string, ForumForgePost> } | null =
  null;

/** Incrementing token used to discard a pending extraction when local data is cleared. */
let readRevision = 0;

/** Changes only for clear lifecycle events, not ordinary thread rereads. */
let storageLifecycleRevision = 0;

/** Prevent duplicate confirmation/deletion flows from the same panel. */
let isClearingLocalData = false;

/** Keep pending handlers inert while any panel's storage lifecycle is blocked. */
let isPersistenceBlocked = false;

/** Last clear state observed in this panel; `failed` also covers invalid metadata. */
let observedClearStatus: "clearing" | "failed" | undefined;

/** Restores focus only when another panel disabled or hid the active control. */
const observedClearFocus = new LocalDataFocusRecovery();

function persistenceIsBlocked(): boolean {
  return isClearingLocalData || isPersistenceBlocked;
}

/**
 * Side panel UI: on the user's click, inject the content script into the active
 * tab, ask it to extract the thread, and render the result into a clean view.
 *
 * Injection uses `activeTab`, which is granted for the tab the user invoked
 * ForumForge on — so the panel only ever reads the page the user explicitly
 * pointed it at.
 */
async function readActiveThread(): Promise<void> {
  const revision = ++readRevision;
  const status = requireElement("#ff-status");
  const output = requireElement("#ff-output");
  output.replaceChildren();
  status.textContent = "Reading this thread…";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (revision !== readRevision) return;
    if (tab?.id === undefined) {
      status.textContent = "No active tab to read.";
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [CONTENT_SCRIPT],
    });
    if (revision !== readRevision) return;
    const response = await chrome.tabs.sendMessage(tab.id, EXTRACT_REQUEST);
    if (revision !== readRevision) return;

    if (!isExtractResponse(response)) {
      status.textContent = "No response from the page.";
      return;
    }
    if (response.type === "forumforge/error") {
      status.textContent = `Could not read this thread: ${response.message}`;
      return;
    }

    const posts = response.thread.posts;
    const count = posts.length;

    // Mark posts new since the reader's last visit, flag ones already saved, and
    // attach any notes about their authors. All three are convenience layers —
    // if persistence fails, still show the thread.
    let newPostIds = new Set<string>();
    let savedPostIds = new Set<string>();
    let notes = new Map<string, string>();
    let storageError: unknown;
    if (tab.url) {
      const threadUrl = tab.url;
      currentThread = {
        url: threadUrl,
        title: response.thread.title,
        postsById: new Map(posts.map((post) => [post.id, post])),
      };
      try {
        await storageCoordinator.run(async () => {
          try {
            ({ newIds: newPostIds } = await readHistory.visit(threadUrl, posts));
          } catch (error) {
            console.error("ForumForge: read history unavailable:", error);
          }
          try {
            savedPostIds = await savedPosts.savedIdsFor(threadUrl);
          } catch (error) {
            console.error("ForumForge: saved posts unavailable:", error);
          }
          try {
            notes = await userNotes.notesFor(threadUrl);
          } catch (error) {
            console.error("ForumForge: user notes unavailable:", error);
          }
        });
        if (revision !== readRevision) return;
        isPersistenceBlocked = false;
        observedClearStatus = undefined;
      } catch (error) {
        if (revision !== readRevision) return;
        console.error("ForumForge: local storage unavailable:", error);
        isPersistenceBlocked = true;
        observedClearStatus = "failed";
        storageError = error;
      }
    } else {
      // No URL means no provenance to save against; render read-only.
      currentThread = null;
    }

    if (revision !== readRevision) return;
    const counts = describeCounts(count, newPostIds.size);
    status.textContent = storageError
      ? `${counts}. ${describeStoragePreparationError(storageError)}`
      : counts;
    output.append(
      renderThread(document, response.thread, { newPostIds, savedPostIds, userNotes: notes }),
    );
    if (storageError || persistenceIsBlocked()) {
      setRenderedPersistenceControlsDisabled(output, true);
    } else {
      // Reconcile the global action after any rerender, including one that
      // overtook a pending Save handler.
      void refreshExportButton();
    }
  } catch (error) {
    if (revision !== readRevision) return;
    // executeScript rejects on pages extensions may not touch (chrome://, the
    // Web Store, PDF viewer). Surface that plainly rather than failing silently.
    status.textContent = "Can't read this page — try it on a forum thread.";
    console.error("ForumForge:", error);
  }
}

/** Status text: post count, plus how many are new since the last visit. */
function describeCounts(count: number, newCount: number): string {
  const posts = count === 1 ? "1 post" : `${count} posts`;
  return newCount > 0 ? `${posts} · ${newCount} new` : posts;
}

/**
 * Toggle the saved state of the post a clicked Save button belongs to. Optimistic
 * UI would be wrong here — the button reflects the state storage actually
 * reached, so a failed write leaves the label honest.
 */
async function onSaveClick(button: HTMLElement): Promise<void> {
  const revision = readRevision;
  const postId = button.getAttribute("data-post-id");
  if (!postId || !currentThread) return;
  const thread = currentThread;
  const post = thread.postsById.get(postId);
  if (!post) return;

  button.toggleAttribute("disabled", true);
  try {
    const isSaved = await storageCoordinator.run(() =>
      savedPosts.toggle(thread.url, post, {
        threadTitle: thread.title,
      }),
    );
    if (revision !== readRevision || persistenceIsBlocked()) {
      // The post view may have been replaced, but the persisted save still
      // changes the global export inventory.
      void refreshExportButton();
      return;
    }
    setSaveButtonState(button, isSaved);
    // The export action covers every saved post, so its availability tracks
    // whether any save now exists — not just this thread's.
    void refreshExportButton();
  } catch (error) {
    console.error("ForumForge: could not update saved post:", error);
    if (revision === readRevision && !persistenceIsBlocked()) {
      requireElement("#ff-status").textContent =
        "Couldn't update the saved post. Local storage may be unavailable.";
    }
  } finally {
    button.toggleAttribute("disabled", persistenceIsBlocked());
  }
}

/**
 * Enable "Export saved" only when there is at least one saved post anywhere, so
 * the action never produces an empty note. Called on load and after every save.
 */
async function refreshExportButton(): Promise<void> {
  const lifecycleRevision = storageLifecycleRevision;
  const button = document.querySelector<HTMLButtonElement>("#ff-export");
  if (!button) return;
  try {
    const saved = await storageCoordinator.run(() => savedPosts.all());
    button.disabled =
      lifecycleRevision !== storageLifecycleRevision ||
      persistenceIsBlocked() ||
      saved.length === 0;
  } catch (error) {
    console.error("ForumForge: could not check saved posts:", error);
    button.disabled = true;
  }
}

/**
 * Export every saved post to a Markdown file the reader downloads. Local-first:
 * it reads only on-device saves and builds the file in the panel — nothing
 * leaves the browser, and the download uses the page's own anchor, so no new
 * permission is needed.
 */
async function exportSavedPosts(): Promise<void> {
  const lifecycleRevision = storageLifecycleRevision;
  const status = requireElement("#ff-status");
  let saved;
  try {
    saved = await storageCoordinator.run(() => savedPosts.all());
  } catch (error) {
    console.error("ForumForge: could not read saved posts for export:", error);
    if (lifecycleRevision === storageLifecycleRevision && !persistenceIsBlocked()) {
      status.textContent = "Couldn't read saved posts to export.";
    }
    return;
  }
  if (lifecycleRevision !== storageLifecycleRevision || persistenceIsBlocked()) return;
  if (saved.length === 0) {
    status.textContent = "No saved posts to export yet.";
    return;
  }

  const markdown = savedPostsToMarkdown(saved);
  downloadText(markdown, exportFilename(new Date()), "text/markdown");
  status.textContent = `Exported ${saved.length === 1 ? "1 saved post" : `${saved.length} saved posts`}.`;
}

/** A date-stamped, filesystem-safe export filename, e.g. forumforge-saved-2026-06-23.md. */
function exportFilename(now: Date): string {
  const date = now.toISOString().slice(0, 10);
  return `forumforge-saved-${date}.md`;
}

/**
 * Trigger a client-side download of `text` via a temporary object URL and
 * anchor. Kept here (not in the pure markdown module) because it touches the DOM
 * and `URL`. The object URL is revoked once the click is dispatched.
 */
function downloadText(text: string, filename: string, mimeType: string): void {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Expand or collapse the note editor a clicked "Note" toggle owns. */
function onNoteToggle(button: HTMLElement): void {
  const post = button.closest<HTMLElement>(".ff-post");
  const editor = post?.querySelector<HTMLElement>(".ff-post__note");
  if (!editor) return;
  const open = editor.hidden;
  editor.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) editor.querySelector<HTMLTextAreaElement>(".ff-post__note-input")?.focus();
}

/**
 * Persist the note typed for a post's author, then reflect it on EVERY post by
 * that author so their editors and annotated flags stay in sync. Like Save, the
 * UI follows what storage actually reached, so a failed write stays honest.
 */
async function onNoteSave(button: HTMLElement): Promise<void> {
  const revision = readRevision;
  if (!currentThread) return;
  const thread = currentThread;
  const editor = button.closest<HTMLElement>(".ff-post__note");
  const author = editor?.getAttribute("data-author");
  const input = editor?.querySelector<HTMLTextAreaElement>(".ff-post__note-input");
  if (author === null || author === undefined || !input) return;

  const note = input.value;
  button.toggleAttribute("disabled", true);
  try {
    await storageCoordinator.run(() => userNotes.set(thread.url, author, note));
    if (revision !== readRevision || persistenceIsBlocked()) return;
    const trimmed = note.trim();
    for (const region of document.querySelectorAll<HTMLElement>(".ff-post__note")) {
      if (region.getAttribute("data-author") !== author) continue;
      const post = region.closest<HTMLElement>(".ff-post");
      if (post) setNoteState(post, trimmed);
    }
  } catch (error) {
    console.error("ForumForge: could not save note:", error);
    if (revision === readRevision && !persistenceIsBlocked()) {
      requireElement("#ff-status").textContent =
        "Couldn't save the note. Local storage may be unavailable.";
    }
  } finally {
    button.toggleAttribute("disabled", persistenceIsBlocked());
  }
}

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`ForumForge: missing element ${selector}`);
  return element;
}

/** Keep every data-producing control inert while the serialized clear is active. */
function setLocalDataControlsDisabled(disabled: boolean): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("#ff-extract, #ff-clear-data")) {
    button.disabled = disabled;
  }
  setRenderedPersistenceControlsDisabled(document, disabled);
  if (disabled) {
    const exportButton = document.querySelector<HTMLButtonElement>("#ff-export");
    if (exportButton) exportButton.disabled = true;
  }
}

/** Apply the observed lifecycle without disabling the retry action after failure. */
function syncLocalDataControlsToLifecycle(): void {
  if (observedClearStatus === "clearing") {
    setLocalDataControlsDisabled(true);
    return;
  }

  setLocalDataControlsDisabled(false);
  if (isPersistenceBlocked) {
    setRenderedPersistenceControlsDisabled(document, true);
    const exportButton = document.querySelector<HTMLButtonElement>("#ff-export");
    if (exportButton) exportButton.disabled = true;
  }
}

/**
 * Confirm, serialize, and reflect a local-data deletion. The native confirmation
 * and polite live status region expose the interaction through browser semantics;
 * their real assistive-technology behavior remains a manual release check.
 */
async function clearAllLocalData(): Promise<void> {
  if (isClearingLocalData) return;
  const status = requireElement("#ff-status");
  const clearButton = requireElement("#ff-clear-data") as HTMLButtonElement;
  await runClearLocalData({
    confirm: (message) => window.confirm(message),
    clear: () => storageCoordinator.clear(),
    onStart: () => {
      isClearingLocalData = true;
      isPersistenceBlocked = true;
      observedClearStatus = "clearing";
      readRevision += 1;
      storageLifecycleRevision += 1;
      setLocalDataControlsDisabled(true);
      status.textContent = CLEAR_LOCAL_DATA_PROGRESS;
    },
    onSuccess: () => {
      resetRenderedLocalData(document);
      const exportButton = document.querySelector<HTMLButtonElement>("#ff-export");
      if (exportButton) exportButton.disabled = true;
      status.textContent = CLEAR_LOCAL_DATA_SUCCESS;
    },
    onFailure: (error) => {
      console.error("ForumForge: could not clear all local data:", error);
      isPersistenceBlocked = true;
      observedClearStatus = "failed";
      status.textContent = CLEAR_LOCAL_DATA_FAILURE;
    },
    onFinish: () => {
      isClearingLocalData = false;
      syncLocalDataControlsToLifecycle();
      clearButton.focus();
    },
  });
}

/** Reconcile this panel as another extension window clears or retries local data. */
function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local") return;
  const change = changes[STORAGE_CLEAR_STATE_KEY];
  if (!change) return;

  readRevision += 1;
  storageLifecycleRevision += 1;
  const exportButton = document.querySelector<HTMLButtonElement>("#ff-export");
  const status = requireElement("#ff-status");
  const clearButton = requireElement("#ff-clear-data");
  const nextState = change.newValue;

  if (nextState !== undefined) {
    if (!isClearingLocalData) observedClearFocus.capture(document.activeElement);
    const isClearing =
      typeof nextState === "object" &&
      nextState !== null &&
      (nextState as StorageClearState).status === "clearing";
    isPersistenceBlocked = true;
    observedClearStatus = isClearing ? "clearing" : "failed";
    if (isClearingLocalData) return;
    if (isClearing) {
      setLocalDataControlsDisabled(true);
      status.textContent = "Local user data is being cleared in another ForumForge panel\u2026";
      return;
    }

    // A failed or malformed state blocks persistence until an explicit retry.
    setLocalDataControlsDisabled(false);
    setRenderedPersistenceControlsDisabled(document, true);
    if (exportButton) exportButton.disabled = true;
    status.textContent =
      "A local-data clear did not finish. Some data may remain; retry Clear local user data.";
    observedClearFocus.restore(clearButton);
    return;
  }

  if (change.oldValue === undefined) return;
  if (!isClearingLocalData) observedClearFocus.capture(document.activeElement);
  isPersistenceBlocked = false;
  observedClearStatus = undefined;
  if (isClearingLocalData) return;
  resetRenderedLocalData(document);
  setLocalDataControlsDisabled(false);
  if (exportButton) exportButton.disabled = true;
  status.textContent = "Cleared read history, saved posts, and private author notes.";
  observedClearFocus.restore(clearButton);
}

function describeStoragePreparationError(error: unknown): string {
  if (error instanceof StorageClearInProgressError) {
    return "A local-data clear is in progress or needs a retry. Use Clear local user data below.";
  }
  if (error instanceof InvalidStorageGenerationError) {
    return "Local data has invalid clear metadata. Clear it below to recover.";
  }
  if (error instanceof UnsupportedStorageSchemaVersionError) {
    return "Local data is from a newer ForumForge version. Update ForumForge or clear it below.";
  }
  if (error instanceof InvalidStorageSchemaVersionError) {
    return "Local data has an invalid storage version. Clear it below to recover.";
  }
  return "Local data is temporarily unavailable. Reload the panel or clear it below.";
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.onChanged.addListener(onStorageChanged);

  requireElement("#ff-extract").addEventListener("click", () => {
    void readActiveThread();
  });

  requireElement("#ff-export").addEventListener("click", () => {
    void exportSavedPosts();
  });

  requireElement("#ff-clear-data").addEventListener("click", () => {
    void clearAllLocalData();
  });

  // Prepare/migrate storage before the first feature read or write. Extraction
  // still works read-only when preparation is blocked by invalid/newer data.
  void storageCoordinator
    .prepare()
    .then(() => {
      if (observedClearStatus === undefined) isPersistenceBlocked = false;
      return refreshExportButton();
    })
    .catch((error: unknown) => {
      isPersistenceBlocked = true;
      observedClearStatus = "failed";
      requireElement("#ff-status").textContent = describeStoragePreparationError(error);
      const exportButton = document.querySelector<HTMLButtonElement>("#ff-export");
      if (exportButton) exportButton.disabled = true;
    });

  // One delegated listener on the persistent output container survives each
  // re-render (the container stays; only its children are replaced).
  requireElement("#ff-output").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const saveButton = target.closest<HTMLElement>(".ff-post__save");
    if (saveButton) {
      void onSaveClick(saveButton);
      return;
    }
    const noteToggle = target.closest<HTMLElement>(".ff-post__note-toggle");
    if (noteToggle) {
      onNoteToggle(noteToggle);
      return;
    }
    const noteSave = target.closest<HTMLElement>(".ff-post__note-save");
    if (noteSave) void onNoteSave(noteSave);
  });
});
