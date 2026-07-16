import {
  extractThreadGeneric,
  extractThreadDiscourse,
  extractThreadHackerNews,
  extractThreadPhpBB,
  isDiscoursePage,
  isHackerNewsPage,
  isPhpBBPage,
  type ExtractedThread,
} from "@forumforge/parser";

/**
 * Extract the thread from a page's document.
 *
 * Picks a site-specific adapter when the page's own markup signals one: Hacker
 * News item pages first, then Discourse's generator marker, then phpBB's narrow
 * topic-page signature. All other pages fall back to the generic best-effort
 * parser. This is the one seam
 * where adapter selection happens, so the content script never imports the
 * parser directly.
 *
 * The content script calls this against the live `document`; tests call it
 * against a parsed fixture document.
 */
export function extractThreadFromDocument(doc: Document): ExtractedThread {
  if (isHackerNewsPage(doc)) return extractThreadHackerNews(doc);
  if (isDiscoursePage(doc)) return extractThreadDiscourse(doc);
  if (isPhpBBPage(doc)) return extractThreadPhpBB(doc);
  return extractThreadGeneric(doc);
}
