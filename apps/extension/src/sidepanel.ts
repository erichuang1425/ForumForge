import type { ForumForgePost } from "@forumforge/core";
import { EXTRACT_REQUEST, isExtractResponse } from "./messaging";
import { renderThread, setSaveButtonState } from "./render";
import { ChromeStorageBackend } from "./storage";
import { ReadHistory } from "./readHistory";
import { SavedPosts } from "./savedPosts";

/** The built content script, injected on demand into the active tab. */
const CONTENT_SCRIPT = "content.js";

/** One on-device backend shared by every per-feature store in the panel. */
const backend = new ChromeStorageBackend();

/** Per-thread read history, persisted on-device via chrome.storage.local. */
const readHistory = new ReadHistory(backend);

/** Locally saved posts, persisted on-device via chrome.storage.local. */
const savedPosts = new SavedPosts(backend);

/**
 * The thread currently shown in the panel, kept so a Save click can map a post
 * id back to the post (its frozen snapshot) and the page it came from. Null
 * until the first successful read.
 */
let currentThread: { url: string; title?: string; postsById: Map<string, ForumForgePost> } | null =
  null;

/**
 * Side panel UI: on the user's click, inject the content script into the active
 * tab, ask it to extract the thread, and render the result into a clean view.
 *
 * Injection uses `activeTab`, which is granted for the tab the user invoked
 * ForumForge on — so the panel only ever reads the page the user explicitly
 * pointed it at.
 */
async function readActiveThread(): Promise<void> {
  const status = requireElement("#ff-status");
  const output = requireElement("#ff-output");
  output.replaceChildren();
  status.textContent = "Reading this thread…";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) {
    status.textContent = "No active tab to read.";
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [CONTENT_SCRIPT],
    });
    const response = await chrome.tabs.sendMessage(tab.id, EXTRACT_REQUEST);

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

    // Mark posts new since the reader's last visit, and flag ones already saved.
    // Both are convenience layers — if persistence fails, still show the thread.
    let newPostIds = new Set<string>();
    let savedPostIds = new Set<string>();
    if (tab.url) {
      currentThread = {
        url: tab.url,
        title: response.thread.title,
        postsById: new Map(posts.map((post) => [post.id, post])),
      };
      try {
        ({ newIds: newPostIds } = await readHistory.visit(tab.url, posts));
      } catch (error) {
        console.error("ForumForge: read history unavailable:", error);
      }
      try {
        savedPostIds = await savedPosts.savedIdsFor(tab.url);
      } catch (error) {
        console.error("ForumForge: saved posts unavailable:", error);
      }
    } else {
      // No URL means no provenance to save against; render read-only.
      currentThread = null;
    }

    status.textContent = describeCounts(count, newPostIds.size);
    output.append(renderThread(document, response.thread, { newPostIds, savedPostIds }));
  } catch (error) {
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
  const postId = button.getAttribute("data-post-id");
  if (!postId || !currentThread) return;
  const post = currentThread.postsById.get(postId);
  if (!post) return;

  button.toggleAttribute("disabled", true);
  try {
    const isSaved = await savedPosts.toggle(currentThread.url, post, {
      threadTitle: currentThread.title,
    });
    setSaveButtonState(button, isSaved);
  } catch (error) {
    console.error("ForumForge: could not update saved post:", error);
  } finally {
    button.toggleAttribute("disabled", false);
  }
}

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`ForumForge: missing element ${selector}`);
  return element;
}

document.addEventListener("DOMContentLoaded", () => {
  requireElement("#ff-extract").addEventListener("click", () => {
    void readActiveThread();
  });

  // One delegated listener on the persistent output container survives each
  // re-render (the container stays; only its children are replaced).
  requireElement("#ff-output").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLElement>(".ff-post__save");
    if (button) void onSaveClick(button);
  });
});
