import type { ForumForgePost } from "@forumforge/core";

/**
 * Keep the post contract's thread-local uniqueness guarantee even when a page
 * repeats its own id or two id-less posts derive the same fallback. Suffixes
 * are stable because they depend only on DOM order, and they skip every id the
 * page already supplied so an explicit id is never stolen by an earlier
 * duplicate.
 *
 * Parent references are resolved to the latest preceding occurrence of their
 * original id. That preserves trees such as Hacker News, where the extractor
 * reconstructs a parent from the most recent row at the previous depth.
 */
export function ensureUniquePostIds(posts: readonly ForumForgePost[]): ForumForgePost[] {
  const reservedIds = new Set(posts.map((post) => post.id));
  const usedIds = new Set<string>();
  const nextSuffix = new Map<string, number>();
  const latestIdByOriginal = new Map<string, string>();

  return posts.map((post) => {
    const originalId = post.id;
    let uniqueId = originalId;

    if (usedIds.has(uniqueId)) {
      let suffix = nextSuffix.get(originalId) ?? 2;
      do {
        uniqueId = `${originalId}~${suffix}`;
        suffix += 1;
      } while (reservedIds.has(uniqueId) || usedIds.has(uniqueId));
      nextSuffix.set(originalId, suffix);
    }

    const parentId = post.parentId
      ? (latestIdByOriginal.get(post.parentId) ?? post.parentId)
      : undefined;
    usedIds.add(uniqueId);
    latestIdByOriginal.set(originalId, uniqueId);

    if (uniqueId === originalId && parentId === post.parentId) return post;
    return { ...post, id: uniqueId, ...(parentId ? { parentId } : {}) };
  });
}
