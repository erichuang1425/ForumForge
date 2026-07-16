import { afterEach, describe, expect, it, vi } from "vitest";
import { OPEN_LIBRARY_REQUEST, TOGGLE_READER_REQUEST } from "../src/messaging";

type ActionListener = (tab: chrome.tabs.Tab) => void;
type RuntimeListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

async function setupBackground(): Promise<{
  actionListener: ActionListener;
  executeScript: ReturnType<typeof vi.fn>;
  openPanel: ReturnType<typeof vi.fn>;
  runtimeListener: RuntimeListener;
  sendMessage: ReturnType<typeof vi.fn>;
}> {
  let actionListener: ActionListener | undefined;
  let runtimeListener: RuntimeListener | undefined;
  const executeScript = vi.fn(async () => [
    { documentId: "document-7", frameId: 0 },
  ]);
  const sendMessage = vi.fn(async () => undefined);
  const openPanel = vi.fn(async () => undefined);

  vi.stubGlobal("chrome", {
    action: {
      onClicked: { addListener(listener: ActionListener) { actionListener = listener; } },
    },
    runtime: {
      onMessage: { addListener(listener: RuntimeListener) { runtimeListener = listener; } },
    },
    scripting: { executeScript },
    tabs: { sendMessage },
    sidePanel: { open: openPanel },
  } as unknown as typeof chrome);

  vi.resetModules();
  await import("../src/background");
  if (!actionListener || !runtimeListener) throw new Error("background listeners were not added");
  return { actionListener, executeScript, openPanel, runtimeListener, sendMessage };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("toolbar reader invocation", () => {
  it("injects on demand and opens the reader in the exact top-level document", async () => {
    const { actionListener, executeScript, sendMessage } = await setupBackground();

    actionListener({ id: 7, url: "https://forum.example/thread/7" });

    await vi.waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(7, TOGGLE_READER_REQUEST, {
        documentId: "document-7",
      });
    });
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ["content.js"],
    });
  });

  it("opens the side-panel library only for a validated request from a tab", async () => {
    const { openPanel, runtimeListener } = await setupBackground();
    const sendResponse = vi.fn();

    expect(runtimeListener(OPEN_LIBRARY_REQUEST, { tab: { id: 7 } }, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(openPanel).toHaveBeenCalledWith({ tabId: 7 }));
    await vi.waitFor(() =>
      expect(sendResponse).toHaveBeenCalledWith({
        type: "forumforge/library-result",
        opened: true,
      }),
    );

    expect(runtimeListener({ type: "foreign/open" }, { tab: { id: 7 } }, vi.fn())).toBeUndefined();
  });
});
