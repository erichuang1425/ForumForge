import { describe, expect, it } from "vitest";
import { MemoryStorageBackend, type StorageBackend } from "@forumforge/storage";
import { ReadHistory } from "../src/readHistory";
import { SavedPosts } from "../src/savedPosts";
import { UserNotes } from "../src/userNotes";
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  ClearForumForgeDataError,
  InvalidStorageGenerationError,
  InvalidStorageSchemaVersionError,
  STORAGE_CLEAR_STATE_KEY,
  STORAGE_GENERATION_KEY,
  STORAGE_SCHEMA_KEY,
  StorageClearInProgressError,
  StorageCoordinator,
  type StorageExclusiveLock,
  UnsupportedStorageSchemaVersionError,
  clearForumForgeData,
  ensureStorageSchema,
  isForumForgeOwnedKey,
  isForumForgeUserDataKey,
} from "../src/storageSchema";

class BackendProxy implements StorageBackend {
  readonly setKeys: string[] = [];
  readonly removedKeys: string[] = [];

  constructor(readonly inner: StorageBackend = new MemoryStorageBackend()) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.inner.get<T>(key);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.setKeys.push(key);
    return this.inner.set(key, value);
  }

  remove(key: string): Promise<void> {
    this.removedKeys.push(key);
    return this.inner.remove(key);
  }

  keys(): Promise<string[]> {
    return this.inner.keys();
  }
}

class FailOnceBackend extends BackendProxy {
  constructor(
    inner: StorageBackend,
    private readonly operation: "set" | "remove",
    private readonly keyToFail: string,
  ) {
    super(inner);
  }

  private failed = false;

  override set<T>(key: string, value: T): Promise<void> {
    if (!this.failed && this.operation === "set" && key === this.keyToFail) {
      this.failed = true;
      this.setKeys.push(key);
      return Promise.reject(new Error("injected set failure"));
    }
    return super.set(key, value);
  }

  override remove(key: string): Promise<void> {
    if (!this.failed && this.operation === "remove" && key === this.keyToFail) {
      this.failed = true;
      this.removedKeys.push(key);
      return Promise.reject(new Error("injected remove failure"));
    }
    return super.remove(key);
  }
}

class TestExclusiveLock implements StorageExclusiveLock {
  private tail: Promise<void> = Promise.resolve();
  private requestCount = 0;
  private readonly requestWaiters: Array<{ count: number; resolve: () => void }> = [];

  waitForRequests(count: number): Promise<void> {
    if (this.requestCount >= count) return Promise.resolve();
    return new Promise((resolve) => {
      this.requestWaiters.push({ count, resolve });
    });
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.requestCount += 1;
    for (let index = this.requestWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = this.requestWaiters[index];
      if (waiter && this.requestCount >= waiter.count) {
        this.requestWaiters.splice(index, 1);
        waiter.resolve();
      }
    }

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

/** Deterministically holds a stale preflight read and an in-progress clear. */
class ClearRaceBackend extends BackendProxy {
  private pauseClearStateRead = false;
  private pauseGenerationRead = false;
  private didPauseClearStateRead = false;
  private didPauseGenerationRead = false;
  private didPauseRemoval = false;
  private releaseClearStateRead!: () => void;
  private releaseGenerationRead!: () => void;
  private releaseRemoval!: () => void;
  readonly clearStateReadStarted: Promise<void>;
  readonly generationReadStarted: Promise<void>;
  readonly removalStarted: Promise<void>;
  private readonly clearStateReadRelease: Promise<void>;
  private readonly generationReadRelease: Promise<void>;
  private readonly removalRelease: Promise<void>;

  constructor(inner: StorageBackend) {
    super(inner);
    let markClearStateReadStarted!: () => void;
    let markGenerationReadStarted!: () => void;
    let markRemovalStarted!: () => void;
    this.clearStateReadStarted = new Promise((resolve) => {
      markClearStateReadStarted = resolve;
    });
    this.removalStarted = new Promise((resolve) => {
      markRemovalStarted = resolve;
    });
    this.generationReadStarted = new Promise((resolve) => {
      markGenerationReadStarted = resolve;
    });
    this.clearStateReadRelease = new Promise((resolve) => {
      this.releaseClearStateRead = resolve;
    });
    this.removalRelease = new Promise((resolve) => {
      this.releaseRemoval = resolve;
    });
    this.generationReadRelease = new Promise((resolve) => {
      this.releaseGenerationRead = resolve;
    });
    this.markClearStateReadStarted = markClearStateReadStarted;
    this.markGenerationReadStarted = markGenerationReadStarted;
    this.markRemovalStarted = markRemovalStarted;
  }

  private readonly markClearStateReadStarted: () => void;
  private readonly markGenerationReadStarted: () => void;
  private readonly markRemovalStarted: () => void;

  armClearStateReadPause(): void {
    this.pauseClearStateRead = true;
  }

  armGenerationReadPause(): void {
    this.pauseGenerationRead = true;
  }

  continueClearStateRead(): void {
    this.releaseClearStateRead();
  }

  continueGenerationRead(): void {
    this.releaseGenerationRead();
  }

  continueRemoval(): void {
    this.releaseRemoval();
  }

  override async get<T>(key: string): Promise<T | undefined> {
    const snapshot = await super.get<T>(key);
    if (
      this.pauseGenerationRead &&
      !this.didPauseGenerationRead &&
      key === STORAGE_GENERATION_KEY
    ) {
      this.didPauseGenerationRead = true;
      this.markGenerationReadStarted();
      await this.generationReadRelease;
    }
    if (
      this.pauseClearStateRead &&
      !this.didPauseClearStateRead &&
      key === STORAGE_CLEAR_STATE_KEY
    ) {
      this.didPauseClearStateRead = true;
      this.markClearStateReadStarted();
      await this.clearStateReadRelease;
    }
    return snapshot;
  }

  override async remove(key: string): Promise<void> {
    if (!this.didPauseRemoval && key === "saved:seed") {
      this.didPauseRemoval = true;
      this.markRemovalStarted();
      await this.removalRelease;
    }
    return super.remove(key);
  }
}

describe("storage schema migration", () => {
  it("adopts unversioned read history, saves, and notes without rewriting them", async () => {
    const backend = new MemoryStorageBackend();
    const records: Record<string, unknown> = {
      "readHistory:https://forum.example/t/1": {
        seenIds: ["1", "2"],
        lastVisitedAt: "2026-07-15T01:02:03.000Z",
      },
      "saved:https://forum.example/t/1 2": {
        threadKey: "https://forum.example/t/1",
        threadUrl: "https://forum.example/t/1#post-2",
        threadTitle: "A useful thread",
        savedAt: "2026-07-15T02:03:04.000Z",
        post: { id: "2", author: "ada", contentText: "keep this" },
      },
      "userNotes:https://forum.example ada": {
        origin: "https://forum.example",
        author: "ada",
        note: "careful source",
        updatedAt: "2026-07-15T03:04:05.000Z",
      },
      "other:sentinel": { keep: true },
    };
    for (const [key, value] of Object.entries(records)) await backend.set(key, value);

    await ensureStorageSchema(backend);

    expect(await backend.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    for (const [key, value] of Object.entries(records)) {
      expect(await backend.get(key)).toEqual(value);
    }

    const revisit = await new ReadHistory(backend).visit(
      "https://forum.example/t/1",
      [{ id: "1" }, { id: "2" }],
      new Date("2026-07-16T00:00:00.000Z"),
    );
    expect(revisit.isFirstVisit).toBe(false);
    expect(revisit.newIds.size).toBe(0);
    expect((await new SavedPosts(backend).all()).map((saved) => saved.post.id)).toEqual(["2"]);
    expect(await new UserNotes(backend).get("https://forum.example/elsewhere", "ada")).toBe(
      "careful source",
    );
  });

  it("does no writes when storage already has the current version", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    const backend = new BackendProxy(inner);

    await ensureStorageSchema(backend);

    expect(backend.setKeys).toEqual([]);
    expect(backend.removedKeys).toEqual([]);
  });

  it("leaves the baseline intact when the marker write is interrupted, then retries", async () => {
    const inner = new MemoryStorageBackend();
    const legacyKey = "saved:https://forum.example/t/1 2";
    const legacyValue = { savedAt: "2026-07-15T02:03:04.000Z" };
    await inner.set(legacyKey, legacyValue);
    const backend = new FailOnceBackend(inner, "set", STORAGE_SCHEMA_KEY);

    await expect(ensureStorageSchema(backend)).rejects.toThrow("injected set failure");
    expect(await inner.get(STORAGE_SCHEMA_KEY)).toBeUndefined();
    expect(await inner.get(legacyKey)).toEqual(legacyValue);

    await ensureStorageSchema(backend);
    expect(await inner.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await inner.get(legacyKey)).toEqual(legacyValue);
  });

  it.each(["1", null, true, -1, 1.5, Number.NaN, { version: 1 }])(
    "rejects invalid version metadata %j without changing records",
    async (invalid) => {
      const inner = new MemoryStorageBackend();
      await inner.set(STORAGE_SCHEMA_KEY, invalid);
      await inner.set("saved:keep", { value: "unchanged" });
      const backend = new BackendProxy(inner);

      await expect(ensureStorageSchema(backend)).rejects.toBeInstanceOf(
        InvalidStorageSchemaVersionError,
      );
      expect(backend.setKeys).toEqual([]);
      expect(backend.removedKeys).toEqual([]);
      expect(await inner.get("saved:keep")).toEqual({ value: "unchanged" });
    },
  );

  it("rejects a newer unknown version without downgrading or deleting it", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION + 1);
    await inner.set("forumforge:futureRecord", { keep: true });
    const backend = new BackendProxy(inner);

    await expect(ensureStorageSchema(backend)).rejects.toBeInstanceOf(
      UnsupportedStorageSchemaVersionError,
    );
    expect(backend.setKeys).toEqual([]);
    expect(backend.removedKeys).toEqual([]);
    expect(await inner.get("forumforge:futureRecord")).toEqual({ keep: true });
  });
});

describe("scoped local-data clearing", () => {
  it("recognizes legacy and versioned keys without matching lookalikes", () => {
    expect(isForumForgeOwnedKey("readHistory:x")).toBe(true);
    expect(isForumForgeOwnedKey("saved:x")).toBe(true);
    expect(isForumForgeOwnedKey("userNotes:x")).toBe(true);
    expect(isForumForgeOwnedKey("forumforge:future")).toBe(true);
    expect(isForumForgeOwnedKey("savedness:x")).toBe(false);
    expect(isForumForgeOwnedKey("userNote:x")).toBe(false);
    expect(isForumForgeUserDataKey("forumforge:future")).toBe(true);
    expect(isForumForgeUserDataKey(STORAGE_SCHEMA_KEY)).toBe(false);
    expect(isForumForgeUserDataKey(STORAGE_GENERATION_KEY)).toBe(false);
    expect(isForumForgeUserDataKey(STORAGE_CLEAR_STATE_KEY)).toBe(false);
  });

  it("removes only ForumForge-owned keys and is idempotent", async () => {
    const backend = new MemoryStorageBackend();
    for (const key of [
      "readHistory:thread",
      "saved:post",
      "userNotes:author",
      "forumforge:futureRecord",
    ]) {
      await backend.set(key, { owned: true });
    }
    await backend.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await backend.set(STORAGE_GENERATION_KEY, 7);
    await backend.set(STORAGE_CLEAR_STATE_KEY, { generation: 7, status: "failed" });
    await backend.set("savedness:sentinel", { keep: true });
    await backend.set("other:sentinel", { keep: true });

    await expect(clearForumForgeData(backend)).resolves.toBe(4);
    expect((await backend.keys()).sort()).toEqual(
      [
        STORAGE_CLEAR_STATE_KEY,
        STORAGE_GENERATION_KEY,
        STORAGE_SCHEMA_KEY,
        "other:sentinel",
        "savedness:sentinel",
      ].sort(),
    );
    await expect(clearForumForgeData(backend)).resolves.toBe(0);
  });

  it("attempts every data key, preserves operational metadata on failure, and retries", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("readHistory:thread", { owned: true });
    await inner.set("saved:post", { owned: true });
    await inner.set("userNotes:author", { owned: true });
    await inner.set("other:sentinel", { keep: true });
    const backend = new FailOnceBackend(inner, "remove", "saved:post");

    const first = clearForumForgeData(backend);
    await expect(first).rejects.toMatchObject({
      removedCount: 2,
      failedKeys: ["saved:post"],
    });
    expect(backend.removedKeys).toEqual([
      "readHistory:thread",
      "saved:post",
      "userNotes:author",
    ]);
    expect(await inner.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await inner.get("saved:post")).toEqual({ owned: true });
    expect(await inner.get("other:sentinel")).toEqual({ keep: true });

    await expect(clearForumForgeData(backend)).resolves.toBe(1);
    expect((await inner.keys()).sort()).toEqual([STORAGE_SCHEMA_KEY, "other:sentinel"].sort());
  });
});

describe("StorageCoordinator", () => {
  it("waits for an active write in another coordinator before clearing", async () => {
    const backend = new MemoryStorageBackend();
    const sharedLock = new TestExclusiveLock();
    const panelA = new StorageCoordinator(backend, sharedLock);
    const panelB = new StorageCoordinator(backend, sharedLock);
    await panelA.prepare();

    let releaseOperation!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });

    const operation = panelB.run(async () => {
      markStarted();
      await release;
      await backend.set("saved:pending", { value: true });
    });
    await started;

    const clearing = panelA.clear();
    await expect(panelA.run(async () => Promise.resolve())).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );

    releaseOperation();
    await operation;
    await clearing;

    expect(await backend.get("saved:pending")).toBeUndefined();
    expect(await backend.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await backend.get(STORAGE_GENERATION_KEY)).toBe(2);
    expect(await backend.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
  });

  it("rejects writes started or queued while another coordinator clears", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("saved:seed", { value: true });
    const backend = new ClearRaceBackend(inner);
    const sharedLock = new TestExclusiveLock();
    const panelA = new StorageCoordinator(backend, sharedLock);
    const panelB = new StorageCoordinator(backend, sharedLock);

    backend.armClearStateReadPause();
    const queuedWrite = panelB.run(() => backend.set("saved:queued", { value: true }));
    const queuedWriteRejected = expect(queuedWrite).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );
    await backend.clearStateReadStarted;

    const clearing = panelA.clear();
    await backend.removalStarted;
    await expect(
      panelB.run(() => backend.set("saved:during", { value: true })),
    ).rejects.toBeInstanceOf(StorageClearInProgressError);

    backend.continueClearStateRead();
    await sharedLock.waitForRequests(2);
    backend.continueRemoval();
    await clearing;
    await queuedWriteRejected;

    expect(await backend.get("saved:seed")).toBeUndefined();
    expect(await backend.get("saved:queued")).toBeUndefined();
    expect(await backend.get("saved:during")).toBeUndefined();
    expect(await backend.get(STORAGE_GENERATION_KEY)).toBe(2);
    expect(await backend.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
  });

  it("rejects a clearing epoch even when its state read resumes after success", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("saved:seed", { value: true });
    const backend = new ClearRaceBackend(inner);
    const sharedLock = new TestExclusiveLock();
    const panelA = new StorageCoordinator(backend, sharedLock);
    const panelB = new StorageCoordinator(backend, sharedLock);

    const clearing = panelA.clear();
    await backend.removalStarted;
    backend.armGenerationReadPause();
    const midClearWrite = panelB.run(() => backend.set("saved:mid-clear", { value: true }));
    const midClearWriteRejected = expect(midClearWrite).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );
    await backend.generationReadStarted;

    backend.continueRemoval();
    await clearing;
    backend.continueGenerationRead();
    await midClearWriteRejected;

    expect(await backend.get("saved:mid-clear")).toBeUndefined();
    expect(await backend.get(STORAGE_GENERATION_KEY)).toBe(2);
    expect(await backend.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
  });

  it("allows an explicitly confirmed clear to recover from a future version", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION + 1);
    await backend.set("forumforge:futureRecord", { value: true });
    const coordinator = new StorageCoordinator(backend);

    await expect(coordinator.prepare()).rejects.toBeInstanceOf(
      UnsupportedStorageSchemaVersionError,
    );
    await coordinator.clear();

    expect(await backend.get("forumforge:futureRecord")).toBeUndefined();
    expect(await backend.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
  });

  it("does not begin deletion when the initial clear-state guard cannot be stored", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("saved:post", { value: true });
    const backend = new FailOnceBackend(inner, "set", STORAGE_CLEAR_STATE_KEY);
    const coordinator = new StorageCoordinator(backend, new TestExclusiveLock());

    await expect(coordinator.clear()).rejects.toThrow("injected set failure");

    expect(await inner.get("saved:post")).toEqual({ value: true });
    expect(await inner.get(STORAGE_GENERATION_KEY)).toBeUndefined();
    expect(await inner.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
    await expect(coordinator.run(() => Promise.resolve("storage remains usable"))).resolves.toBe(
      "storage remains usable",
    );
  });

  it("keeps writes blocked when schema reset fails, then recovers on retry", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("saved:post", { value: true });
    const backend = new FailOnceBackend(inner, "set", STORAGE_SCHEMA_KEY);
    const coordinator = new StorageCoordinator(backend, new TestExclusiveLock());

    await expect(coordinator.clear()).rejects.toThrow("injected set failure");
    expect(await inner.get("saved:post")).toBeUndefined();
    expect(await inner.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await inner.get(STORAGE_GENERATION_KEY)).toBe(1);
    expect(await inner.get(STORAGE_CLEAR_STATE_KEY)).toEqual({
      generation: 1,
      status: "failed",
    });
    await expect(coordinator.run(() => backend.set("saved:blocked", true))).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );

    await coordinator.clear();
    await coordinator.run(() => backend.set("saved:new", { value: true }));
    expect(await inner.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await inner.get(STORAGE_GENERATION_KEY)).toBe(4);
    expect(await inner.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
    expect(await inner.get("saved:new")).toEqual({ value: true });
  });

  it("publishes partial failure across coordinators and blocks writes until retry", async () => {
    const inner = new MemoryStorageBackend();
    await inner.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await inner.set("saved:post", { value: true });
    await inner.set("userNotes:author", { value: true });
    const backend = new FailOnceBackend(inner, "remove", "saved:post");
    const sharedLock = new TestExclusiveLock();
    const panelA = new StorageCoordinator(backend, sharedLock);
    const panelB = new StorageCoordinator(backend, sharedLock);

    await expect(panelA.clear()).rejects.toBeInstanceOf(ClearForumForgeDataError);
    expect(await inner.get("saved:post")).toEqual({ value: true });
    expect(await inner.get("userNotes:author")).toBeUndefined();
    expect(await inner.get(STORAGE_CLEAR_STATE_KEY)).toEqual({
      generation: 1,
      status: "failed",
    });
    await expect(panelB.run(() => backend.set("saved:blocked", true))).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );

    await panelA.clear();
    await panelB.run(() => backend.set("saved:after-retry", { value: true }));
    expect(await inner.get("saved:post")).toBeUndefined();
    expect(await inner.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
    expect(await inner.get(STORAGE_GENERATION_KEY)).toBe(4);
    expect(await inner.get("saved:after-retry")).toEqual({ value: true });
  });

  it("allows an explicitly confirmed clear to recover from invalid metadata", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set(STORAGE_SCHEMA_KEY, "broken");
    await backend.set("saved:post", { value: true });
    const coordinator = new StorageCoordinator(backend, new TestExclusiveLock());

    await expect(coordinator.prepare()).rejects.toBeInstanceOf(
      InvalidStorageSchemaVersionError,
    );
    await coordinator.clear();

    expect(await backend.get("saved:post")).toBeUndefined();
    expect(await backend.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
  });

  it("fails closed on invalid generation metadata and recovers through clear", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await backend.set(STORAGE_GENERATION_KEY, "broken");
    await backend.set("saved:post", { value: true });
    const coordinator = new StorageCoordinator(backend, new TestExclusiveLock());

    await expect(coordinator.prepare()).rejects.toBeInstanceOf(InvalidStorageGenerationError);
    await expect(coordinator.run(() => backend.set("saved:blocked", true))).rejects.toBeInstanceOf(
      InvalidStorageGenerationError,
    );
    await coordinator.clear();

    expect(await backend.get("saved:post")).toBeUndefined();
    expect(await backend.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
    expect(await backend.get(STORAGE_GENERATION_KEY)).toBe(2);
    expect(await backend.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
  });

  it("treats an orphaned odd generation as interrupted clearing", async () => {
    const backend = new MemoryStorageBackend();
    await backend.set(STORAGE_SCHEMA_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
    await backend.set(STORAGE_GENERATION_KEY, 1);
    await backend.set("saved:post", { value: true });
    const coordinator = new StorageCoordinator(backend, new TestExclusiveLock());

    await expect(coordinator.prepare()).rejects.toBeInstanceOf(StorageClearInProgressError);
    await expect(coordinator.run(() => backend.set("saved:blocked", true))).rejects.toBeInstanceOf(
      StorageClearInProgressError,
    );
    await coordinator.clear();

    expect(await backend.get("saved:post")).toBeUndefined();
    expect(await backend.get(STORAGE_GENERATION_KEY)).toBe(4);
    expect(await backend.get(STORAGE_CLEAR_STATE_KEY)).toBeUndefined();
  });
});
