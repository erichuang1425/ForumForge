import { Collection, type StorageBackend } from "@forumforge/storage";
import type { ForumForgePost } from "@forumforge/core";
import { threadKey } from "./readHistory";

/**
 * "Save comments" — local saved-post tracking.
 *
 * ForumForge lets the reader save any useful post from a thread. A saved post is
 * a SNAPSHOT (the post content frozen at save time) plus where it came from, so
 * the saved item stays stable even if the page later changes, and can be
 * revisited or exported to Markdown later (a separate Phase 1 item).
 *
 * Saved posts are local-first and on-device by default (see docs/PRIVACY.md):
 * nothing about what the reader keeps leaves their browser.
 */

/** A saved post: the snapshot plus the thread it was saved from. */
export type SavedPost = {
  /** Fragment-normalized thread key (see {@link threadKey}) the post belongs to. */
  threadKey: string;
  /** The page URL as the reader saw it, for returning to the original thread. */
  threadUrl: string;
  /** Thread title when known — for listing saved posts and Markdown export. */
  threadTitle?: string;
  /** ISO timestamp of when the post was saved. */
  savedAt: string;
  /** Snapshot of the saved post, frozen at save time. */
  post: ForumForgePost;
};

/** Optional provenance/timing for a save. `now` is injectable for tests. */
export type SaveOptions = {
  threadTitle?: string;
  now?: Date;
};

/**
 * The storage key for a saved post. A post id is unique only WITHIN a thread, so
 * we namespace it by the thread key to keep the same post id in two different
 * threads from colliding. The thread key is a normalized URL — `new URL().href`
 * percent-encodes any space — so a plain space cleanly separates the two parts.
 */
export function savedKey(url: string, postId: string): string {
  return `${threadKey(url)} ${postId}`;
}

/**
 * Records and queries locally saved posts over any {@link StorageBackend}.
 * Construct one for the panel session.
 */
export class SavedPosts {
  private readonly saved: Collection<SavedPost>;

  constructor(backend: StorageBackend) {
    this.saved = new Collection<SavedPost>(backend, "saved");
  }

  /** Save a snapshot of `post` from the thread at `url`, replacing any prior copy. */
  async save(url: string, post: ForumForgePost, options: SaveOptions = {}): Promise<void> {
    const record: SavedPost = {
      threadKey: threadKey(url),
      threadUrl: url,
      savedAt: (options.now ?? new Date()).toISOString(),
      post,
    };
    if (options.threadTitle) record.threadTitle = options.threadTitle;
    await this.saved.set(savedKey(url, post.id), record);
  }

  /** Remove the saved copy of post `postId` from the thread at `url`. No-op if absent. */
  remove(url: string, postId: string): Promise<void> {
    return this.saved.delete(savedKey(url, postId));
  }

  /** Whether post `postId` from the thread at `url` is currently saved. */
  isSaved(url: string, postId: string): Promise<boolean> {
    return this.saved.has(savedKey(url, postId));
  }

  /**
   * Toggle the saved state of `post` from the thread at `url`, returning the new
   * state (`true` when it is now saved). Lets the UI flip a single button without
   * tracking the prior state itself.
   */
  async toggle(url: string, post: ForumForgePost, options: SaveOptions = {}): Promise<boolean> {
    if (await this.isSaved(url, post.id)) {
      await this.remove(url, post.id);
      return false;
    }
    await this.save(url, post, options);
    return true;
  }

  /** The ids of every saved post belonging to the thread at `url`. */
  async savedIdsFor(url: string): Promise<Set<string>> {
    const prefix = `${threadKey(url)} `;
    const ids = await this.saved.ids();
    const result = new Set<string>();
    for (const id of ids) {
      if (id.startsWith(prefix)) result.add(id.slice(prefix.length));
    }
    return result;
  }

  /** Every saved post across all threads, most recently saved first. */
  async all(): Promise<SavedPost[]> {
    const records = await this.saved.values();
    return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}
