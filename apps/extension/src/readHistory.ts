import { Collection, type StorageBackend } from "@forumforge/storage";

/**
 * "New posts since last visit" — local read-history tracking.
 *
 * For each thread the user reads, ForumForge remembers which posts they have
 * already seen (by the stable post id from `@forumforge/core`) and the time of
 * the last visit. On the next visit, posts whose id wasn't seen before are
 * reported as new, so the reader can pick up where they left off. The very first
 * visit marks nothing new — there is no "last visit" to compare against yet.
 *
 * This is local-first and on-device by default (see docs/PRIVACY.md): nothing
 * about what the user reads leaves their browser.
 */

/** What we persist per thread. */
export type ThreadReadState = {
  /** Stable ids of every post seen for this thread so far. */
  seenIds: string[];
  /** ISO timestamp of the most recent visit. */
  lastVisitedAt: string;
};

/** Outcome of recording a visit. */
export type VisitResult = {
  /** Ids of posts new since the previous visit (empty on the first visit). */
  newIds: Set<string>;
  /** True when this is the first recorded visit to the thread. */
  isFirstVisit: boolean;
};

/** The least we need from a post here: its stable id. */
type HasId = { id: string };

/**
 * A stable key for a thread, derived from its page URL. The fragment (`#post-12`)
 * is dropped because it changes as the reader jumps around a thread but still
 * points at the same page. The query string is kept: many forums put the thread
 * or page number there, so it is part of the page's identity.
 *
 * Generic-phase limitation: a paginated thread's pages are tracked separately
 * (each page is its own URL). A site adapter can refine this later.
 */
export function threadKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Ids of `posts` not present in a prior visit's `seenIds`. With no prior visit
 * (`prior` undefined) nothing counts as new — a first read isn't "new since last
 * time", it just *is* the thread.
 */
export function selectNewIds(posts: ReadonlyArray<HasId>, prior?: ThreadReadState): Set<string> {
  if (!prior) return new Set();
  const seen = new Set(prior.seenIds);
  const fresh = new Set<string>();
  for (const post of posts) {
    if (!seen.has(post.id)) fresh.add(post.id);
  }
  return fresh;
}

/**
 * The seen-id set after a visit: the prior ids plus any newly present ids, in
 * first-seen order (prior ids first). For a stable page this stays the size of
 * the page; ids only accumulate when the page's posts genuinely change.
 */
export function mergeSeenIds(posts: ReadonlyArray<HasId>, prior?: ThreadReadState): string[] {
  const seen = prior ? [...prior.seenIds] : [];
  const known = new Set(seen);
  for (const post of posts) {
    if (!known.has(post.id)) {
      known.add(post.id);
      seen.push(post.id);
    }
  }
  return seen;
}

/**
 * Records and queries per-thread read history over any {@link StorageBackend}.
 * Construct one for the panel session and call {@link visit} each time a thread
 * is read.
 */
export class ReadHistory {
  private readonly threads: Collection<ThreadReadState>;

  constructor(backend: StorageBackend) {
    this.threads = new Collection<ThreadReadState>(backend, "readHistory");
  }

  /**
   * Record a visit to the thread at `url` holding `posts`, and report which
   * posts are new since the previous visit. Persists the updated read state.
   * `now` is injectable for deterministic tests.
   */
  async visit(
    url: string,
    posts: ReadonlyArray<HasId>,
    now: Date = new Date(),
  ): Promise<VisitResult> {
    const key = threadKey(url);
    const prior = await this.threads.get(key);
    const newIds = selectNewIds(posts, prior);
    await this.threads.set(key, {
      seenIds: mergeSeenIds(posts, prior),
      lastVisitedAt: now.toISOString(),
    });
    return { newIds, isFirstVisit: prior === undefined };
  }
}
