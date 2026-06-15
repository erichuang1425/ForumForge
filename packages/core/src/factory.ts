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

/**
 * Build a normalized ForumForgePost from loose adapter output. Missing required
 * fields degrade gracefully (a missing selector should not crash): missing id →
 * generated, missing author → "Unknown", missing content → empty string.
 */
export function createPost(input: PostInput): ForumForgePost {
  const post: ForumForgePost = {
    id: input.id?.trim() || generateId(),
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
