import {
  TOGGLE_READER_REQUEST,
  isOpenLibraryRequest,
  type LibraryResult,
} from "./messaging";

/** The built content script, injected only after an explicit toolbar click. */
const CONTENT_SCRIPT = "content.js";

/**
 * Inject ForumForge into the tab covered by the toolbar click's `activeTab`
 * grant, then target the exact top-level document returned by Chrome. This
 * keeps the compact launcher and immersive reader on-demand: no host access and
 * no always-on content script are introduced.
 */
async function toggleReader(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [CONTENT_SCRIPT],
  });
  const documentId = results.find((result) => result.frameId === 0)?.documentId;
  if (!documentId) throw new Error("ForumForge: top-level page document was not injected");
  await chrome.tabs.sendMessage(tab.id, TOGGLE_READER_REQUEST, { documentId });
}

chrome.action.onClicked.addListener((tab) => {
  void toggleReader(tab).catch((error: unknown) => {
    console.error("ForumForge: failed to open the page reader", error);
  });
});

/**
 * The immersive reader keeps the side panel as a secondary local library and
 * privacy utility. Only its namespaced, runtime-validated request can open it,
 * and it must originate from a tab so the panel remains scoped to that tab.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isOpenLibraryRequest(message)) return;
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    const response: LibraryResult = { type: "forumforge/library-result", opened: false };
    sendResponse(response);
    return;
  }

  void chrome.sidePanel.open({ tabId }).then(
    () => {
      const response: LibraryResult = { type: "forumforge/library-result", opened: true };
      sendResponse(response);
    },
    (error: unknown) => {
      console.error("ForumForge: failed to open the local library", error);
      const response: LibraryResult = { type: "forumforge/library-result", opened: false };
      sendResponse(response);
    },
  );
  return true;
});

export {};
