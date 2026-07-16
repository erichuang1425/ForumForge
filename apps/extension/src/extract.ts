import {
  extractThreadArca,
  extractThreadDcInside,
  extractThreadFmKorea,
  extractThreadStackOverflow,
  extractThreadGeneric,
  extractThreadDiscourse,
  extractThreadFourChan,
  extractThreadHackerNews,
  extractThreadNairaland,
  extractThreadPtt,
  extractThreadPhpBB,
  extractThreadVBulletin,
  extractThreadXenForo,
  isArcaPage,
  isDcInsidePage,
  isFmKoreaPage,
  isStackOverflowPage,
  isDiscoursePage,
  isFourChanPage,
  isHackerNewsPage,
  isNairalandPage,
  isPttPage,
  isPhpBBPage,
  isVBulletinPage,
  isXenForoPage,
  type ExtractedThread,
} from "@forumforge/parser";

/**
 * Extract the thread from a page's document.
 *
 * Picks a site-specific adapter when the page's own markup signals one: Hacker
 * News, PTT, 4chan, Arca, DC Inside, FMKorea, and Stack Overflow thread pages
 * first, then Discourse's generator marker, XenForo's versioned public-thread
 * signature, phpBB's narrow topic-page signature, and a signed vBulletin 4.x
 * showthread page. All other pages fall back to the generic best-effort parser.
 * This is the one seam where adapter selection happens, so the content script
 * never imports the parser directly.
 *
 * The content script calls this against the live `document`; tests call it
 * against a parsed fixture document.
 */
export function extractThreadFromDocument(doc: Document): ExtractedThread {
  if (isHackerNewsPage(doc)) return extractThreadHackerNews(doc);
  if (isPttPage(doc)) return extractThreadPtt(doc);
  if (isFourChanPage(doc)) return extractThreadFourChan(doc);
  if (isArcaPage(doc)) return extractThreadArca(doc);
  if (isDcInsidePage(doc)) return extractThreadDcInside(doc);
  if (isFmKoreaPage(doc)) return extractThreadFmKorea(doc);
  if (isStackOverflowPage(doc)) return extractThreadStackOverflow(doc);
  if (isDiscoursePage(doc)) return extractThreadDiscourse(doc);
  if (isXenForoPage(doc)) return extractThreadXenForo(doc);
  if (isPhpBBPage(doc)) return extractThreadPhpBB(doc);
  if (isVBulletinPage(doc)) return extractThreadVBulletin(doc);
  if (isNairalandPage(doc)) return extractThreadNairaland(doc);
  return extractThreadGeneric(doc);
}
