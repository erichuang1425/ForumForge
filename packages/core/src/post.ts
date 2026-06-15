/**
 * The ForumForge post model — the contract every layer agrees on.
 *
 * Adapters and the parser PRODUCE posts; storage, UI, and (later) intelligence
 * features CONSUME them. Keep this shape minimal and stable: a change here
 * ripples through every package. See AGENTS.md → "The post model is the contract".
 */

/** An author's role in a thread, as far as an adapter can determine it. */
export type ForumRole = "op" | "user" | "mod" | "admin";

export type ForumForgePost = {
  /** Stable id, unique within a thread. Generated when the forum exposes none. */
  id: string;
  /** Display name of the author. "Unknown" when it can't be determined. */
  author: string;
  /** Link to the author's profile, when the page exposes one. */
  authorUrl?: string;
  /** The author's role in the thread, when known. */
  role?: ForumRole;
  /** Raw timestamp string as shown on the page (not parsed into a Date here). */
  timestamp?: string;
  /** Plain-text post body. Always present (may be an empty string). */
  contentText: string;
  /**
   * Raw HTML of the post body, when captured. UNTRUSTED input: it must be
   * sanitized before it is ever rendered. See SECURITY.md.
   */
  contentHtml?: string;
  /** Direct link to this specific post. */
  permalink?: string;
  /** id of the post this one replies to, for nested threads. */
  parentId?: string;
  /** Reply depth (0 = top level), for nested threads. */
  depth?: number;
  /** Outbound links found in the post body, de-duplicated, first-seen order. */
  links?: string[];
};
