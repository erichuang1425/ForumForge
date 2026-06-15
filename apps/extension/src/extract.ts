import { extractThreadGeneric, type ExtractedThread } from "@forumforge/parser";

/**
 * Extract the thread from a page's document.
 *
 * Today this always uses the generic fallback parser. This function is the seam
 * where a site-specific adapter will be selected first (Phase 2), with the
 * generic extractor as the fallback. Keeping it here means the content script
 * never imports the parser directly, and the selection logic has one home.
 *
 * The content script calls this against the live `document`; tests call it
 * against a parsed fixture document.
 */
export function extractThreadFromDocument(doc: Document): ExtractedThread {
  return extractThreadGeneric(doc);
}
