import { Collection, type StorageBackend } from "@forumforge/storage";

/**
 * "Local user notes" — private, on-device notes attached to a username.
 *
 * The reader can jot a private note about an author ("helpful with GPU driver
 * issues", "check their sources on pricing") and see it again every time that
 * author shows up. Notes are about a *person*, not a single post, so they are
 * NOT scoped per-thread the way read history and saved posts are — a note should
 * follow the author across every thread on the forum.
 *
 * Notes are scoped per ORIGIN, though: the same display name on two different
 * forums is almost certainly two different people, so a note written on one site
 * must not leak onto a like-named stranger on another. (Within one forum a
 * display name can still be reused or impersonated — the generic phase can only
 * key on the visible name; a site adapter with a stable author id could refine
 * this later.)
 *
 * Notes are local-first and on-device by default (see docs/PRIVACY.md): nothing
 * the reader writes about anyone leaves their browser.
 */

/** A stored note about one author on one forum. */
export type UserNote = {
  /** Origin (scheme + host + port) the note's author belongs to. */
  origin: string;
  /** Author display name the note is about, as shown on the page. */
  author: string;
  /** The reader's note text. Always non-empty — an emptied note is deleted. */
  note: string;
  /** ISO timestamp of when the note was last written. */
  updatedAt: string;
};

/**
 * The origin of a page URL, used to scope notes to one forum. A bare host with
 * no scheme/port collisions across sites would be unsafe, so we use the full
 * `URL.origin` (`https://forum.example.com`). Falls back to the raw string for
 * inputs that aren't valid URLs, so a note still keys consistently.
 */
export function noteOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * The storage key for an author's note. A display name is unique only WITHIN a
 * forum, so we namespace it by the origin. An origin never contains a space, so
 * a single space cleanly separates it from the author name (which may contain
 * spaces — it is the whole remainder after the prefix).
 */
export function noteKey(url: string, author: string): string {
  return `${noteOrigin(url)} ${author}`;
}

/** Optional timing for a write. `now` is injectable for deterministic tests. */
export type NoteOptions = { now?: Date };

/**
 * Records and queries per-author notes over any {@link StorageBackend}.
 * Construct one for the panel session.
 */
export class UserNotes {
  private readonly notes: Collection<UserNote>;

  constructor(backend: StorageBackend) {
    this.notes = new Collection<UserNote>(backend, "userNotes");
  }

  /** The note text for `author` on the forum at `url`, or `undefined` if none. */
  async get(url: string, author: string): Promise<string | undefined> {
    const record = await this.notes.get(noteKey(url, author));
    return record?.note;
  }

  /**
   * Write `note` for `author` on the forum at `url`. An empty or whitespace-only
   * note REMOVES the note rather than storing a blank one, so clearing the text
   * and saving is how the reader deletes a note. The stored text is trimmed.
   */
  async set(url: string, author: string, note: string, options: NoteOptions = {}): Promise<void> {
    const trimmed = note.trim();
    if (trimmed === "") {
      await this.remove(url, author);
      return;
    }
    await this.notes.set(noteKey(url, author), {
      origin: noteOrigin(url),
      author,
      note: trimmed,
      updatedAt: (options.now ?? new Date()).toISOString(),
    });
  }

  /** Remove the note for `author` on the forum at `url`. No-op if absent. */
  remove(url: string, author: string): Promise<void> {
    return this.notes.delete(noteKey(url, author));
  }

  /**
   * Every author note on the forum at `url`, as a map of author display name to
   * note text — ready to hand to the renderer so each post shows its author's
   * note.
   */
  async notesFor(url: string): Promise<Map<string, string>> {
    const prefix = `${noteOrigin(url)} `;
    const result = new Map<string, string>();
    for (const [key, record] of await this.notes.entries()) {
      if (key.startsWith(prefix)) result.set(key.slice(prefix.length), record.note);
    }
    return result;
  }

  /** Every note across all forums, most recently updated first. */
  async all(): Promise<UserNote[]> {
    const records = await this.notes.values();
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
