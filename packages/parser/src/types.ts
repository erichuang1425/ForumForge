import type { ForumForgePost } from "@forumforge/core";

/** Result of extracting a thread: optional title plus the posts found. */
export type ExtractedThread = {
  title?: string;
  /**
   * Absolute base URL of the page the thread came from, when known. Consumers
   * use it to resolve any relative URLs still embedded in a post's
   * `contentHtml` (which is captured as raw `innerHTML`, so its hrefs are not
   * pre-resolved like `permalink`/`links`/`authorUrl` are).
   */
  baseUrl?: string;
  posts: ForumForgePost[];
};

/** Options shared by every extractor (generic and site-specific alike). */
export type ExtractOptions = {
  /**
   * Base URL used to resolve relative permalinks and links. In a real browser
   * the DOM resolves these already; pass it when parsing detached HTML (tests,
   * fixtures, off-DOM processing).
   */
  baseUrl?: string;
};
