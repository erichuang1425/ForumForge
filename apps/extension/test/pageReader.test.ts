import { parseHTML } from "linkedom";
import { describe, expect, it, vi } from "vitest";
import type { ExtractedThread } from "@forumforge/parser";
import { createPageReaderView } from "../src/pageReader";
import { PAGE_READER_STYLES } from "../src/pageReaderStyles";

function fixtureDocument(): Document {
  const { document } = parseHTML(
    "<!doctype html><html><head><title>Old forum</title></head><body><button id='before'>Original</button></body></html>",
  );
  return document as unknown as Document;
}

const thread: ExtractedThread = {
  title: "Why do old cameras render blue this way?",
  baseUrl: "https://forum.example/threads/cameras.42/",
  posts: [
    {
      id: "101",
      author: "Ada Lovelace",
      role: "op",
      timestamp: "Today at 09:14",
      contentText: "The shadows keep a cyan cast.",
      contentHtml: "<p>The shadows keep a <strong>cyan cast</strong>.</p><script>alert(1)</script>",
    },
    {
      id: "102",
      author: "Grace",
      timestamp: "Today at 09:32",
      contentText: "Try a daylight reference card.",
    },
  ],
};

describe("on-page reading studio", () => {
  it("mounts a compact edge launcher and an initially closed isolated reader", () => {
    const doc = fixtureDocument();
    const view = createPageReaderView(doc, thread, {
      sourceUrl: "https://forum.example/threads/cameras.42/",
    });
    view.mount();

    expect(view.host.tagName.toLowerCase()).toBe("forumforge-reader");
    expect(view.host.shadowRoot).toBeNull();
    expect(doc.documentElement.lastElementChild).toBe(view.host);
    expect(view.shadow.querySelector(".ff-launcher")?.getAttribute("aria-label")).toBe(
      "Open ForumForge reader",
    );
    expect(view.shadow.querySelector(".ff-reader")?.hasAttribute("hidden")).toBe(true);

    view.open();
    expect(view.shadow.querySelector(".ff-reader")?.hasAttribute("hidden")).toBe(false);
    expect(view.shadow.querySelector(".ff-launcher")?.hasAttribute("hidden")).toBe(true);
    expect(view.shadow.querySelector(".ff-launcher")?.getAttribute("aria-expanded")).toBe("true");

    view.close();
    expect(view.shadow.querySelector(".ff-reader")?.hasAttribute("hidden")).toBe(true);
    expect(view.shadow.querySelector(".ff-launcher")?.hasAttribute("hidden")).toBe(false);
    expect(view.shadow.querySelector(".ff-launcher")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("restores the forum focus target, or the launcher when the page had no useful target", () => {
    const doc = fixtureDocument();
    const original = doc.querySelector<HTMLButtonElement>("#before");
    if (!original) throw new Error("original page control missing");
    const originalFocus = vi.spyOn(original, "focus");
    const initialBodyInert = doc.body.inert;
    Object.defineProperty(doc, "activeElement", { configurable: true, value: original });
    const view = createPageReaderView(doc, thread, {
      sourceUrl: "https://forum.example/threads/cameras.42/",
    });
    view.mount();

    view.open();
    expect(doc.body.inert).toBe(true);
    view.close();
    expect(originalFocus).toHaveBeenCalledOnce();
    expect(doc.body.inert).toBe(initialBodyInert);

    Object.defineProperty(doc, "activeElement", { configurable: true, value: doc.body });
    const launcher = view.shadow.querySelector<HTMLButtonElement>(".ff-launcher");
    if (!launcher) throw new Error("launcher missing");
    const launcherFocus = vi.spyOn(launcher, "focus");
    view.open();
    view.close();
    expect(launcherFocus).toHaveBeenCalledOnce();
  });

  it("reframes the thread as a publication-like conversation without trusting page HTML", () => {
    const view = createPageReaderView(fixtureDocument(), thread, {
      sourceUrl: "https://forum.example/threads/cameras.42/",
      newPostIds: new Set(["102"]),
    });
    view.mount();

    expect(view.shadow.querySelector("[role='dialog'][aria-modal='true']")).not.toBeNull();
    expect(view.shadow.querySelector(".ff-reader__rail-title")?.textContent).toBe(thread.title);
    expect(view.shadow.querySelector(".ff-reader__metric--posts strong")?.textContent).toBe("2");
    expect(view.shadow.querySelector(".ff-reader__metric--people strong")?.textContent).toBe("2");
    expect(view.shadow.querySelectorAll(".ff-post")).toHaveLength(2);
    expect(view.shadow.querySelector(".ff-post__avatar")?.textContent).toBe("AL");
    expect(view.shadow.querySelector(".ff-post__ordinal")?.textContent).toBe("#1");
    expect(view.shadow.querySelector(".ff-post__body strong")?.textContent).toBe("cyan cast");
    expect(view.shadow.querySelector("script")).toBeNull();
    expect(view.shadow.querySelectorAll(".ff-thread__title")).toHaveLength(0);
    expect(view.shadow.querySelector(".ff-reader__tools-label")?.textContent).toBe(
      "Stays on this device",
    );
  });

  it("keeps save, note, refresh, and library actions inside explicit callbacks", async () => {
    const onSave = vi.fn(async () => true);
    const onNoteSave = vi.fn(async () => undefined);
    const onOpenLibrary = vi.fn(async () => true);
    const onRefresh = vi.fn();
    const view = createPageReaderView(fixtureDocument(), thread, {
      sourceUrl: "https://forum.example/threads/cameras.42/",
      callbacks: { onSave, onNoteSave, onOpenLibrary, onRefresh },
    });
    view.mount();

    view.shadow.querySelector<HTMLButtonElement>(".ff-post__save")?.click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith("101"));
    expect(view.shadow.querySelector(".ff-post__save")?.textContent).toBe("Saved");

    const noteToggle = view.shadow.querySelector<HTMLButtonElement>(".ff-post__note-toggle");
    noteToggle?.click();
    const note = view.shadow.querySelector<HTMLTextAreaElement>(".ff-post__note-input");
    if (!note) throw new Error("note editor missing");
    note.value = "Strong practical advice";
    view.shadow.querySelector<HTMLButtonElement>(".ff-post__note-save")?.click();
    await vi.waitFor(() =>
      expect(onNoteSave).toHaveBeenCalledWith("Ada Lovelace", "Strong practical advice"),
    );

    view.shadow.querySelector<HTMLButtonElement>(".ff-reader__library")?.click();
    await vi.waitFor(() => expect(onOpenLibrary).toHaveBeenCalledOnce());
    view.shadow.querySelector<HTMLButtonElement>(".ff-reader__refresh")?.click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("keeps persistence controls disabled when an earlier save finishes during a clear", async () => {
    let finishSave: ((saved: boolean) => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    const view = createPageReaderView(fixtureDocument(), thread, {
      sourceUrl: "https://forum.example/threads/cameras.42/",
      callbacks: { onSave },
    });
    view.mount();

    const save = view.shadow.querySelector<HTMLButtonElement>(".ff-post__save");
    if (!save) throw new Error("save control missing");
    save.click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith("101"));

    view.setPersistenceDisabled(true);
    finishSave?.(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(save.textContent).toBe("Saved");
    expect(save.disabled).toBe(true);
  });

  it("uses no remote styles, assets, or page-wide selectors", () => {
    expect(PAGE_READER_STYLES).not.toMatch(/@import|url\s*\(|https?:\/\//iu);
    expect(PAGE_READER_STYLES).toContain(":host");
    expect(PAGE_READER_STYLES).toContain("prefers-color-scheme: dark");
    expect(PAGE_READER_STYLES).toContain("@media (max-width: 760px)");
    expect(PAGE_READER_STYLES).toMatch(
      /\.ff-reader__top-actions\s*\{[^}]*flex-wrap:\s*nowrap;/u,
    );
    expect(PAGE_READER_STYLES).toMatch(
      /\.ff-reader__top-library\s*\{[^}]*width:\s*auto;/u,
    );
  });
});
