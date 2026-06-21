import { EXTRACT_REQUEST, isExtractResponse } from "./messaging";
import { renderThread } from "./render";
import { ChromeStorageBackend } from "./storage";
import { ReadHistory } from "./readHistory";

/** The built content script, injected on demand into the active tab. */
const CONTENT_SCRIPT = "content.js";

/** Per-thread read history, persisted on-device via chrome.storage.local. */
const readHistory = new ReadHistory(new ChromeStorageBackend());

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

    // Mark posts new since the reader's last visit. Read history is a
    // convenience layer — if persistence fails, still show the thread.
    let newPostIds = new Set<string>();
    if (tab.url) {
      try {
        ({ newIds: newPostIds } = await readHistory.visit(tab.url, posts));
      } catch (error) {
        console.error("ForumForge: read history unavailable:", error);
      }
    }

    status.textContent = describeCounts(count, newPostIds.size);
    output.append(renderThread(document, response.thread, { newPostIds }));
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

function requireElement(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`ForumForge: missing element ${selector}`);
  return element;
}

document.addEventListener("DOMContentLoaded", () => {
  requireElement("#ff-extract").addEventListener("click", () => {
    void readActiveThread();
  });
});
