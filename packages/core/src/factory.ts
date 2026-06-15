import type { ForumForgePost, ForumRole } from "./post";
import { cleanText, dedupeLinks, normalizeWhitespace } from "./text";

const ROLES: readonly ForumRole[] = ["op", "user", "mod", "admin"];

/** Loose, adapter-friendly input: everything optional. Required fields are filled in. */
export type PostInput = Partial<ForumForgePost>;

let fallbackCounter = 0;

function generateId(): string {
  // Prefer the platform's UUID; fall back to a monotonic id in non-crypto envs.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  fallbackCounter += 1;
  return `ffp-${Date.now().toString(36)}-${fallbackCounter}`;
}

/** FNV-1a (32-bit): small, dependency-free, and stable across environments. */
function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Derive a STABLE id for a post the forum gave no id of its own. The same post
 * must keep the same id across reloads — read-history, new-post detection,
 * saved-comment state, and `parentId` references all key on it — so we hash the
 * post's own stable signal (permalink, author, timestamp, content) instead of
 * generating a fresh random id on every extraction. Only when there is no stable
 * signal at all do we fall back to a unique generated id, so that distinct empty
 * posts don't collapse onto one shared key.
 */
function deriveFallbackId(input: PostInput): string {
  const parts = [
    input.permalink?.trim() ?? "",
    input.author ? normalizeWhitespace(input.author) : "",
    input.timestamp?.trim() ?? "",
    cleanText(input.contentText),
  ];
  if (parts.every((part) => part === "")) return generateId();
  // NUL separator keeps field boundaries unambiguous, so adjacent fields can't
  // shift across each other and collide ("a b" + "c" vs "a" + "b c").
  return `ffp-${hashString(parts.join("\u0000"))}`;
}

/**
 * Build a normalized ForumForgePost from loose adapter output. Missing required
 * fields degrade gracefully (a missing selector should not crash): missing id →
 * derived from stable content (or generated when there is none), missing author →
 * "Unknown", missing content → empty string.
 */
export function createPost(input: PostInput): ForumForgePost {
  const post: ForumForgePost = {
    id: input.id?.trim() || deriveFallbackId(input),
    author: normalizeWhitespace(input.author ?? "") || "Unknown",
    contentText: cleanText(input.contentText),
  };

  if (input.authorUrl?.trim()) post.authorUrl = input.authorUrl.trim();
  if (input.role && ROLES.includes(input.role)) post.role = input.role;
  if (input.timestamp?.trim()) post.timestamp = input.timestamp.trim();
  if (input.contentHtml?.trim()) post.contentHtml = input.contentHtml;
  if (input.permalink?.trim()) post.permalink = input.permalink.trim();
  if (input.parentId?.trim()) post.parentId = input.parentId.trim();
  if (typeof input.depth === "number" && input.depth >= 0) {
    post.depth = Math.floor(input.depth);
  }

  const links = dedupeLinks(input.links);
  if (links.length > 0) post.links = links;

  return post;
}

/** Runtime guard: does `value` satisfy the required shape of a ForumForgePost? */
export function isForumForgePost(value: unknown): value is ForumForgePost {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.author === "string" &&
    typeof v.contentText === "string"
  );
}
