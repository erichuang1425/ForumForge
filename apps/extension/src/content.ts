import type { ForumForgePost } from "@forumforge/core";
import { extractThreadFromDocument } from "./extract";
import {
  OPEN_LIBRARY_REQUEST,
  isExtractRequest,
  isLibraryResult,
  isToggleReaderRequest,
  type ExtractResponse,
} from "./messaging";
import { createPageReaderView, type PageReaderView } from "./pageReader";
import { ChromeStorageBackend } from "./storage";
import { ReadHistory } from "./readHistory";
import { SavedPosts } from "./savedPosts";
import { UserNotes } from "./userNotes";
import {
  STORAGE_CLEAR_STATE_KEY,
  StorageCoordinator,
  type StorageClearState,
} from "./storageSchema";

/**
 * Content script: extracts a thread and hosts ForumForge's on-page reader.
 *
 * It is injected only after the user clicks the toolbar action. The script owns
 * a compact edge launcher and a closed-shadow-root reading studio, while the
 * source page remains untouched underneath it. No standing host permission or
 * always-on content script is used.
 */

declare global {
  interface Window {
    /** Guards against duplicate listeners when Chrome reinjects this bundle. */
    __forumforgeContentReady?: boolean;
  }
}

const backend = new ChromeStorageBackend();
const storageCoordinator = new StorageCoordinator(backend);
const readHistory = new ReadHistory(backend);
const savedPosts = new SavedPosts(backend);
const userNotes = new UserNotes(backend);

let reader: PageReaderView | null = null;
let readerUrl: string | null = null;
let readerRevision = 0;
let persistenceBlocked = false;

function respondWithThread(sendResponse: (response?: unknown) => void): void {
  let response: ExtractResponse;
  try {
    response = {
      type: "forumforge/thread",
      thread: extractThreadFromDocument(document),
    };
  } catch (error) {
    response = {
      type: "forumforge/error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  sendResponse(response);
}

async function loadLocalReadingState(
  url: string,
  posts: ForumForgePost[],
): Promise<{
  newPostIds: Set<string>;
  savedPostIds: Set<string>;
  notes: Map<string, string>;
  notice?: string;
}> {
  let newPostIds = new Set<string>();
  let savedPostIds = new Set<string>();
  let notes = new Map<string, string>();
  try {
    await storageCoordinator.run(async () => {
      try {
        ({ newIds: newPostIds } = await readHistory.visit(url, posts));
      } catch (error) {
        console.error("ForumForge: page-reader history unavailable", error);
      }
      try {
        savedPostIds = await savedPosts.savedIdsFor(url);
      } catch (error) {
        console.error("ForumForge: page-reader saves unavailable", error);
      }
      try {
        notes = await userNotes.notesFor(url);
      } catch (error) {
        console.error("ForumForge: page-reader notes unavailable", error);
      }
    });
    persistenceBlocked = false;
    return { newPostIds, savedPostIds, notes };
  } catch (error) {
    console.error("ForumForge: page-reader local storage unavailable", error);
    persistenceBlocked = true;
    return {
      newPostIds,
      savedPostIds,
      notes,
      notice: "Reading is available, but local saves and notes need attention in the library.",
    };
  }
}

async function buildReader(): Promise<void> {
  const revision = ++readerRevision;
  const sourceUrl = window.location.href;
  const thread = extractThreadFromDocument(document);
  const state = await loadLocalReadingState(sourceUrl, thread.posts);
  if (revision !== readerRevision) return;

  reader?.destroy();
  const postsById = new Map(thread.posts.map((post) => [post.id, post]));
  const view = createPageReaderView(document, thread, {
    sourceUrl,
    newPostIds: state.newPostIds,
    savedPostIds: state.savedPostIds,
    userNotes: state.notes,
    persistenceDisabled: persistenceBlocked,
    storageNotice: state.notice,
    callbacks: {
      async onSave(postId) {
        if (persistenceBlocked) throw new Error("ForumForge persistence is blocked");
        const post = postsById.get(postId);
        if (!post) throw new Error("ForumForge post is no longer available");
        return storageCoordinator.run(() =>
          savedPosts.toggle(sourceUrl, post, { threadTitle: thread.title }),
        );
      },
      async onNoteSave(author, note) {
        if (persistenceBlocked) throw new Error("ForumForge persistence is blocked");
        await storageCoordinator.run(() => userNotes.set(sourceUrl, author, note));
      },
      async onOpenLibrary() {
        const response = await chrome.runtime.sendMessage(OPEN_LIBRARY_REQUEST);
        return isLibraryResult(response) && response.opened;
      },
      onRefresh() {
        void rebuildReader();
      },
    },
  });
  reader = view;
  readerUrl = sourceUrl;
  view.mount();
  view.open();
}

async function rebuildReader(): Promise<void> {
  reader?.setStatus("Refreshing this conversation…");
  reader?.destroy();
  reader = null;
  readerUrl = null;
  await buildReader();
}

function toggleReader(): void {
  if (reader && readerUrl === window.location.href) {
    if (reader.isOpen()) reader.close();
    else reader.open();
    return;
  }
  void rebuildReader().catch((error: unknown) => {
    console.error("ForumForge: failed to build the page reader", error);
  });
}

function onStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local") return;
  const change = changes[STORAGE_CLEAR_STATE_KEY];
  if (!change || !reader) return;
  readerRevision += 1;

  if (change.newValue !== undefined) {
    persistenceBlocked = true;
    reader.setPersistenceDisabled(true);
    const state = change.newValue as Partial<StorageClearState>;
    reader.setStatus(
      state?.status === "clearing"
        ? "Local reading data is being cleared…"
        : "A local-data clear needs a retry in the library.",
      state?.status === "clearing" ? "idle" : "error",
    );
    return;
  }

  if (change.oldValue === undefined) return;
  persistenceBlocked = false;
  reader.resetLocalState();
  reader.setPersistenceDisabled(false);
  reader.setStatus("Cleared local read history, saved posts, and private notes.", "success");
}

if (!window.__forumforgeContentReady) {
  window.__forumforgeContentReady = true;
  chrome.storage.onChanged.addListener(onStorageChanged);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isExtractRequest(message)) {
      respondWithThread(sendResponse);
      return;
    }
    if (isToggleReaderRequest(message)) toggleReader();
  });
}
