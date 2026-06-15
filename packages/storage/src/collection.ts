import type { StorageBackend } from "./backend";

/**
 * A typed, namespaced set of records keyed by id, layered over any
 * `StorageBackend`.
 *
 * A backend is a single flat key space shared by every feature, so each
 * `Collection` prefixes its keys as `<namespace>:<id>` to keep categories —
 * saved posts, author notes, per-thread read history, per-site settings — from
 * colliding. Construct one per category:
 *
 * ```ts
 * const saved = new Collection<SavedPost>(backend, "saved");
 * await saved.set(post.id, post);
 * ```
 *
 * Use simple identifier-like namespaces (no colons); ids may contain anything.
 */
export class Collection<T> {
  private readonly prefix: string;

  constructor(
    private readonly backend: StorageBackend,
    namespace: string,
  ) {
    if (!namespace) throw new Error("Collection requires a non-empty namespace");
    this.prefix = `${namespace}:`;
  }

  private keyFor(id: string): string {
    return `${this.prefix}${id}`;
  }

  /** The stored record for `id`, or `undefined` when there is none. */
  get(id: string): Promise<T | undefined> {
    return this.backend.get<T>(this.keyFor(id));
  }

  /** Store `value` under `id`, replacing any existing record. */
  set(id: string, value: T): Promise<void> {
    return this.backend.set(this.keyFor(id), value);
  }

  /** Whether a record exists for `id`. */
  async has(id: string): Promise<boolean> {
    return (await this.backend.get(this.keyFor(id))) !== undefined;
  }

  /** Remove the record for `id`. A no-op when it is absent. */
  delete(id: string): Promise<void> {
    return this.backend.remove(this.keyFor(id));
  }

  /** The ids of every record in this collection, in no guaranteed order. */
  async ids(): Promise<string[]> {
    const keys = await this.backend.keys();
    return keys
      .filter((key) => key.startsWith(this.prefix))
      .map((key) => key.slice(this.prefix.length));
  }

  /** Every `[id, record]` pair in this collection. */
  async entries(): Promise<[string, T][]> {
    const pairs = await Promise.all(
      (await this.ids()).map(
        async (id) => [id, await this.get(id)] as [string, T | undefined],
      ),
    );
    return pairs.filter((pair): pair is [string, T] => pair[1] !== undefined);
  }

  /** Every record in this collection. */
  async values(): Promise<T[]> {
    return (await this.entries()).map(([, record]) => record);
  }
}
