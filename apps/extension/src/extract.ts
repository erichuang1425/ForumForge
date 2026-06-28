import {
  extractThreadGeneric,
  extractThreadDiscourse,
  extractThreadHackerNews,
  isDiscoursePage,
  isHackerNewsPage,
  type ExtractedThread,
} from "@forumforge/parser";

/**
 * Extract the thread from a page's document.
 *
 * Picks a site-specific adapter when the page's own markup signals one — a
 * Discourse `generator` meta tag, or Hacker News's `#hnmain` wrapper — and
 * falls back to the generic best-effort parser otherwise. This is the one seam
 * where adapter selection happens, so the content script never imports the
 * parser directly.
 *
 * The content script calls this against the live `document`; tests call it
 * against a parsed fixture document.
 */
export function extractThreadFromDocument(doc: Document): ExtractedThread {
  if (isHackerNewsPage(doc)) return extractThreadHackerNews(doc);
  if (isDiscoursePage(doc)) return extractThreadDiscourse(doc);
  return extractThreadGeneric(doc);
}
