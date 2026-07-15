import type { StorageBackend } from "@forumforge/storage";

/** The single schema marker for every record persisted by ForumForge. */
export const STORAGE_SCHEMA_KEY = "forumforge:storageSchemaVersion";

/** Even while stable and odd while clearing, so queued operations detect resets. */
export const STORAGE_GENERATION_KEY = "forumforge:storageGeneration";

/** Present while a clear runs, and retained as `failed` until a safe retry. */
export const STORAGE_CLEAR_STATE_KEY = "forumforge:storageClearState";

/**
 * Schema 1 adopts the pre-release, unversioned records without rewriting them.
 * A missing marker is therefore the version-0 migration baseline.
 */
export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

/** Existing pre-schema collections that remain readable in schema 1. */
export const LEGACY_STORAGE_PREFIXES = ["readHistory:", "saved:", "userNotes:"] as const;

/** New ForumForge-owned records must use this common prefix. */
export const FORUMFORGE_STORAGE_PREFIX = "forumforge:";

/** Stored schema metadata is present but not a non-negative integer. */
export class InvalidStorageSchemaVersionError extends Error {
  constructor(readonly storedValue: unknown) {
    super("ForumForge storage has an invalid schema version");
    this.name = "InvalidStorageSchemaVersionError";
  }
}

/** Stored data belongs to a newer schema that this build must not modify. */
export class UnsupportedStorageSchemaVersionError extends Error {
  constructor(
    readonly storedVersion: number,
    readonly supportedVersion: number,
  ) {
    super(
      `ForumForge storage schema ${storedVersion} is newer than supported schema ${supportedVersion}`,
    );
    this.name = "UnsupportedStorageSchemaVersionError";
  }
}

/** Operational generation metadata is malformed and must fail closed. */
export class InvalidStorageGenerationError extends Error {
  constructor(readonly storedValue: unknown) {
    super("ForumForge storage has an invalid clear generation");
    this.name = "InvalidStorageGenerationError";
  }
}

/** A migration step is missing from the contiguous version chain. */
export class MissingStorageMigrationError extends Error {
  constructor(readonly fromVersion: number) {
    super(`ForumForge has no storage migration from schema ${fromVersion}`);
    this.name = "MissingStorageMigrationError";
  }
}

/** A scoped clear attempted every data key but could not remove all of them. */
export class ClearForumForgeDataError extends Error {
  constructor(
    readonly removedCount: number,
    readonly failedKeys: readonly string[],
  ) {
    super(`ForumForge could not remove ${failedKeys.length} local storage key(s)`);
    this.name = "ClearForumForgeDataError";
  }
}

/** Feature storage is temporarily blocked while a confirmed clear is running. */
export class StorageClearInProgressError extends Error {
  constructor() {
    super("ForumForge local data is being cleared or requires a clear retry");
    this.name = "StorageClearInProgressError";
  }
}

/** Small injectable seam over the extension-origin Web Locks API. */
export interface StorageExclusiveLock {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

const STORAGE_LOCK_NAME = "forumforge-local-storage";

/** FIFO fallback for tests or environments without Web Locks. */
class InProcessStorageLock implements StorageExclusiveLock {
  private tail: Promise<void> = Promise.resolve();

  async run<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

const fallbackStorageLock = new InProcessStorageLock();

/**
 * Web Locks coordinate every side-panel document under the extension origin.
 * The module-level FIFO lock preserves the same semantics in unit tests.
 */
const extensionStorageLock: StorageExclusiveLock = {
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined" && navigator.locks) {
      // lib.dom models a lock callback as returning T (not PromiseLike<T>),
      // while the platform awaits thenables. The explicit nested type plus
      // `await` reflects that runtime flattening without weakening our seam.
      return await navigator.locks.request<Promise<T>>(STORAGE_LOCK_NAME, () => operation());
    }
    return await fallbackStorageLock.run(operation);
  },
};

type StorageMigration = (backend: StorageBackend) => Promise<void>;

export type StorageClearState = {
  generation: number;
  status: "clearing" | "failed";
};

const OPERATIONAL_STORAGE_KEYS = new Set([
  STORAGE_SCHEMA_KEY,
  STORAGE_GENERATION_KEY,
  STORAGE_CLEAR_STATE_KEY,
]);

/**
 * Version 0 is represented by an absent marker. Its record shapes already are
 * schema 1, so adoption is intentionally non-destructive and idempotent.
 */
const migrations = new Map<number, StorageMigration>([[0, async () => Promise.resolve()]]);

/** Whether a key is owned by ForumForge and may be removed by the clear flow. */
export function isForumForgeOwnedKey(key: string): boolean {
  return (
    key.startsWith(FORUMFORGE_STORAGE_PREFIX) ||
    LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

/** User records cleared by the product control (operational metadata is retained). */
export function isForumForgeUserDataKey(key: string): boolean {
  return isForumForgeOwnedKey(key) && !OPERATIONAL_STORAGE_KEYS.has(key);
}

async function readStorageGeneration(backend: StorageBackend): Promise<number> {
  const stored = await backend.get<unknown>(STORAGE_GENERATION_KEY);
  if (stored === undefined) return 0;
  if (typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 0) return stored;
  throw new InvalidStorageGenerationError(stored);
}

async function hasStorageClearState(backend: StorageBackend): Promise<boolean> {
  return (await backend.get<unknown>(STORAGE_CLEAR_STATE_KEY)) !== undefined;
}

function nextStorageGeneration(current: number): number {
  return current === Number.MAX_SAFE_INTEGER ? 0 : current + 1;
}

function requireStableStorageGeneration(generation: number): number {
  if (generation % 2 !== 0) throw new StorageClearInProgressError();
  return generation;
}

function nextClearEpoch(current: number): { clearing: number; stable: number } {
  const stableBase = current % 2 === 0 ? current : nextStorageGeneration(current);
  const clearing = nextStorageGeneration(stableBase);
  return { clearing, stable: nextStorageGeneration(clearing) };
}

/**
 * Prepare storage before any feature access.
 *
 * Each migration is idempotent and the next version marker is written only
 * after its step succeeds. An interrupted run therefore leaves the old marker
 * (or no marker for version 0) and can be retried without losing records.
 */
export async function ensureStorageSchema(backend: StorageBackend): Promise<void> {
  const stored = await backend.get<unknown>(STORAGE_SCHEMA_KEY);
  let version: number;

  if (stored === undefined) {
    version = 0;
  } else if (typeof stored === "number" && Number.isSafeInteger(stored) && stored >= 0) {
    version = stored;
  } else {
    throw new InvalidStorageSchemaVersionError(stored);
  }

  if (version > CURRENT_STORAGE_SCHEMA_VERSION) {
    throw new UnsupportedStorageSchemaVersionError(version, CURRENT_STORAGE_SCHEMA_VERSION);
  }

  while (version < CURRENT_STORAGE_SCHEMA_VERSION) {
    const migrate = migrations.get(version);
    if (!migrate) throw new MissingStorageMigrationError(version);

    await migrate(backend);
    const nextVersion = version + 1;
    await backend.set(STORAGE_SCHEMA_KEY, nextVersion);
    version = nextVersion;
  }
}

/**
 * Remove only ForumForge user-data keys. Every key is attempted so one failed
 * removal does not strand later keys. Operational schema/generation/clear-state
 * metadata is managed by `StorageCoordinator.clear()`. Callers may retry safely.
 */
export async function clearForumForgeData(backend: StorageBackend): Promise<number> {
  const dataKeys = (await backend.keys()).filter(isForumForgeUserDataKey).sort();
  const failedKeys: string[] = [];
  let removedCount = 0;

  for (const key of dataKeys) {
    try {
      await backend.remove(key);
      removedCount += 1;
    } catch {
      failedKeys.push(key);
    }
  }

  if (failedKeys.length > 0) {
    throw new ClearForumForgeDataError(removedCount, failedKeys);
  }

  return removedCount;
}

/**
 * Serializes schema preparation, normal feature access, and destructive clear
 * operations so a pending read/save/note cannot recreate data halfway through
 * a confirmed clear.
 */
export class StorageCoordinator {
  private clearInProgress: Promise<void> | undefined;

  constructor(
    private readonly backend: StorageBackend,
    private readonly lock: StorageExclusiveLock = extensionStorageLock,
  ) {}

  /** Prepare under the extension-wide lock; transient failures may be retried. */
  prepare(): Promise<void> {
    return this.lock.run(async () => {
      if (await hasStorageClearState(this.backend)) throw new StorageClearInProgressError();
      requireStableStorageGeneration(await readStorageGeneration(this.backend));
      await ensureStorageSchema(this.backend);
    });
  }

  /** Run one prepared feature operation atomically with respect to every panel. */
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.clearInProgress) throw new StorageClearInProgressError();
    const startedGeneration = requireStableStorageGeneration(
      await readStorageGeneration(this.backend),
    );
    if (await hasStorageClearState(this.backend)) throw new StorageClearInProgressError();

    return this.lock.run(async () => {
      if (this.clearInProgress) throw new StorageClearInProgressError();
      const currentGeneration = requireStableStorageGeneration(
        await readStorageGeneration(this.backend),
      );
      if (
        currentGeneration !== startedGeneration ||
        (await hasStorageClearState(this.backend))
      ) {
        throw new StorageClearInProgressError();
      }
      await ensureStorageSchema(this.backend);
      return operation();
    });
  }

  /**
   * Wait for current operations, advance the cross-panel generation, clear user
   * records, and restore schema 1. Multiple callers on this coordinator share
   * the same in-flight clear.
   */
  clear(): Promise<void> {
    if (this.clearInProgress) return this.clearInProgress;

    const task = this.lock.run(() => this.performClear());
    const tracked = task.finally(() => {
      if (this.clearInProgress === tracked) this.clearInProgress = undefined;
    });
    this.clearInProgress = tracked;
    return tracked;
  }

  private async performClear(): Promise<void> {
    // A future/invalid schema blocks feature writes but never an explicitly
    // confirmed deletion. Invalid generation metadata is also recoverable here.
    let currentGeneration = 0;
    try {
      currentGeneration = await readStorageGeneration(this.backend);
    } catch (error) {
      if (!(error instanceof InvalidStorageGenerationError)) throw error;
    }
    const epoch = nextClearEpoch(currentGeneration);
    const clearing: StorageClearState = { generation: epoch.clearing, status: "clearing" };
    let publishedState = false;

    try {
      await this.backend.set(STORAGE_CLEAR_STATE_KEY, clearing);
      publishedState = true;
      await this.backend.set(STORAGE_GENERATION_KEY, epoch.clearing);
      await clearForumForgeData(this.backend);
      // A confirmed clear is the explicit recovery path for invalid/future
      // schemas, so replace the marker only after every user record is gone.
      await this.backend.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
      // Publish the new stable epoch only after destructive work is complete.
      // An operation that captured the odd epoch is rejected even when its
      // clear-state read is delayed until after the state record is removed.
      await this.backend.set(STORAGE_GENERATION_KEY, epoch.stable);
      await this.backend.remove(STORAGE_CLEAR_STATE_KEY);
    } catch (error) {
      if (publishedState) {
        const failed: StorageClearState = { generation: epoch.clearing, status: "failed" };
        try {
          await this.backend.set(STORAGE_CLEAR_STATE_KEY, failed);
        } catch {
          // Preserve the original failure; a missing/clearing state is still
          // paired with the advanced generation and blocks older queued work.
        }
      }
      throw error;
    }
  }
}
