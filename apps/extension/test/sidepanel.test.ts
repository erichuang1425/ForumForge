import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  STORAGE_CLEAR_STATE_KEY,
  STORAGE_SCHEMA_KEY,
  type StorageClearState,
} from "../src/storageSchema";

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;

async function setupSidepanel(): Promise<{
  clearButton: HTMLButtonElement;
  focusClearButton: ReturnType<typeof vi.fn>;
  input: HTMLTextAreaElement;
  listener: StorageChangeListener;
  moveFocusTo(element: Element): void;
  status: HTMLElement;
  threadLink: HTMLAnchorElement;
}> {
  const html = await readFile(new URL("../public/sidepanel.html", import.meta.url), "utf8");
  const { document, window } = parseHTML(html);
  const records = new Map<string, unknown>();
  let listener: StorageChangeListener | undefined;

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

  const chromeApi = {
    scripting: { executeScript: vi.fn(async () => undefined) },
    storage: {
      local: area,
      onChanged: {
        addListener(callback: StorageChangeListener) {
          listener = callback;
        },
      },
    },
    tabs: {
      query: vi.fn(async () => []),
      sendMessage: vi.fn(async () => undefined),
    },
  } as unknown as typeof chrome;

  const input = document.createElement("textarea");
  input.className = "ff-post__note-input";
  const threadLink = document.createElement("a");
  threadLink.href = "#post";
  threadLink.textContent = "Post link";
  document.querySelector("#ff-output")?.append(input, threadLink);
  const clearButton = document.querySelector<HTMLButtonElement>("#ff-clear-data");
  const status = document.querySelector<HTMLElement>("#ff-status");
  if (!clearButton || !status) throw new Error("side-panel fixture is incomplete");

  // LinkeDOM does not move focus when a control becomes disabled. Model the
  // browser transition so capture must happen before the clearing handler
  // disables the input, while the settlement handler observes body focus.
  let movedFocus: Element | undefined;
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    get: () => movedFocus ?? (input.disabled ? document.body : input),
  });
  const focusClearButton = vi.fn(() => {
    expect(clearButton.disabled).toBe(false);
  });
  Object.defineProperty(clearButton, "focus", {
    configurable: true,
    value: focusClearButton,
  });

  vi.stubGlobal("chrome", chromeApi);
  vi.stubGlobal("document", document);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("window", window);
  vi.resetModules();
  await import("../src/sidepanel");
  document.dispatchEvent(new window.Event("DOMContentLoaded"));

  await vi.waitFor(() => {
    expect(listener).toBeTypeOf("function");
    expect(records.get(STORAGE_SCHEMA_KEY)).toBe(CURRENT_STORAGE_SCHEMA_VERSION);
  });

  return {
    clearButton,
    focusClearButton,
    input,
    listener: listener!,
    moveFocusTo(element) {
      movedFocus = element;
    },
    status,
    threadLink,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cross-panel storage lifecycle focus", () => {
  const clearing: StorageClearState = { generation: 1, status: "clearing" };

  it("restores focus after another panel finishes clearing", async () => {
    const { clearButton, focusClearButton, input, listener, status } = await setupSidepanel();

    listener({ [STORAGE_CLEAR_STATE_KEY]: { newValue: clearing } }, "local");
    expect(input.disabled).toBe(true);
    expect(clearButton.disabled).toBe(true);
    expect(focusClearButton).not.toHaveBeenCalled();

    listener({ [STORAGE_CLEAR_STATE_KEY]: { oldValue: clearing } }, "local");
    expect(input.disabled).toBe(false);
    expect(clearButton.disabled).toBe(false);
    expect(focusClearButton).toHaveBeenCalledOnce();
    expect(status.textContent).toContain("Cleared read history");
  });

  it("restores focus to the enabled retry action after another panel fails", async () => {
    const { clearButton, focusClearButton, input, listener, status } = await setupSidepanel();
    const failed: StorageClearState = { generation: 1, status: "failed" };

    listener({ [STORAGE_CLEAR_STATE_KEY]: { newValue: clearing } }, "local");
    listener(
      { [STORAGE_CLEAR_STATE_KEY]: { oldValue: clearing, newValue: failed } },
      "local",
    );

    expect(input.disabled).toBe(true);
    expect(clearButton.disabled).toBe(false);
    expect(focusClearButton).toHaveBeenCalledOnce();
    expect(status.textContent).toContain("retry Clear local user data");
  });

  it("keeps focus on another usable element selected during clearing", async () => {
    const { focusClearButton, listener, moveFocusTo, threadLink } = await setupSidepanel();

    listener({ [STORAGE_CLEAR_STATE_KEY]: { newValue: clearing } }, "local");
    moveFocusTo(threadLink);
    listener({ [STORAGE_CLEAR_STATE_KEY]: { oldValue: clearing } }, "local");

    expect(focusClearButton).not.toHaveBeenCalled();
  });
});
