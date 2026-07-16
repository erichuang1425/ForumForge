import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXTRACT_REQUEST, TOGGLE_READER_REQUEST } from "../src/messaging";
import { STORAGE_SCHEMA_KEY } from "../src/storageSchema";

type RuntimeListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

async function setupContent(): Promise<{
  document: Document;
  listener: RuntimeListener;
  records: Map<string, unknown>;
}> {
  const { document, window } = parseHTML(`<!doctype html><html><head>
    <title>Camera repair notes</title></head><body>
    <article class="post" data-post-id="1"><span class="username">Ada</span>
      <div class="post-body">Check the aperture ring.</div></article>
  </body></html>`);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "https://forum.example/threads/camera-repair" },
  });
  delete (window as Window & { __forumforgeContentReady?: boolean }).__forumforgeContentReady;

  const records = new Map<string, unknown>();
  let listener: RuntimeListener | undefined;
  const area: chrome.storage.StorageArea = {
    async get(keys) {
      const requested =
        keys === undefined || keys === null
          ? [...records.keys()]
          : Array.isArray(keys)
            ? keys
            : [keys];
      return Object.fromEntries(
        requested.filter((key) => records.has(key)).map((key) => [key, records.get(key)]),
      );
    },
    async set(items) {
      for (const [key, value] of Object.entries(items)) records.set(key, value);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) records.delete(key);
    },
  };

  vi.stubGlobal("window", window);
  vi.stubGlobal("document", document);
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: { addListener(callback: RuntimeListener) { listener = callback; } },
      async sendMessage() {
        return { type: "forumforge/library-result", opened: true };
      },
    },
    storage: {
      local: area,
      onChanged: { addListener() {} },
    },
  } as unknown as typeof chrome);

  vi.resetModules();
  await import("../src/content");
  if (!listener) throw new Error("content listener was not added");
  return { document: document as unknown as Document, listener, records };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("on-demand page reader seam", () => {
  it("does not touch the page until invoked, then toggles one isolated host", async () => {
    const { document, listener, records } = await setupContent();
    expect(document.querySelector("forumforge-reader")).toBeNull();

    listener(TOGGLE_READER_REQUEST, {}, vi.fn());
    await vi.waitFor(() => expect(document.querySelector("forumforge-reader")).not.toBeNull());
    expect(document.querySelectorAll("forumforge-reader")).toHaveLength(1);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(records.get(STORAGE_SCHEMA_KEY)).toBe(1);

    listener(TOGGLE_READER_REQUEST, {}, vi.fn());
    expect(document.querySelectorAll("forumforge-reader")).toHaveLength(1);
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });

  it("preserves the validated side-panel extraction protocol", async () => {
    const { listener } = await setupContent();
    const sendResponse = vi.fn();
    listener(EXTRACT_REQUEST, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "forumforge/thread",
        thread: expect.objectContaining({
          posts: [expect.objectContaining({ author: "Ada" })],
        }),
      }),
    );
  });
});
