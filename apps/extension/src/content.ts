import { extractThreadFromDocument } from "./extract";
import { isExtractRequest, type ExtractResponse } from "./messaging";

/**
 * Content script: extracts the thread from the page it is injected into.
 *
 * It is injected on demand (via `chrome.scripting`, gated by `activeTab`) only
 * when the user opens ForumForge on a tab — there are no standing host
 * permissions and no background access to pages the user hasn't asked about. It
 * listens for an extract request and replies with the extracted thread.
 */

declare global {
  interface Window {
    /** Guards against a second listener when the script is re-injected. */
    __forumforgeContentReady?: boolean;
  }
}

if (!window.__forumforgeContentReady) {
  window.__forumforgeContentReady = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isExtractRequest(message)) return;

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
  });
}
