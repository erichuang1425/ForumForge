import { parseHTML } from "linkedom";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  CLEAR_LOCAL_DATA_CONFIRMATION,
  CLEAR_LOCAL_DATA_FAILURE,
  CLEAR_LOCAL_DATA_PROGRESS,
  CLEAR_LOCAL_DATA_SUCCESS,
  confirmClearLocalData,
  resetRenderedLocalData,
  runClearLocalData,
  setRenderedPersistenceControlsDisabled,
} from "../src/localDataUi";
import { renderThread } from "../src/render";

describe("clear-local-data confirmation", () => {
  it("uses the browser confirmation result and names every deleted category", () => {
    const confirm = vi.fn(() => false);

    expect(confirmClearLocalData(confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledWith(CLEAR_LOCAL_DATA_CONFIRMATION);
    expect(CLEAR_LOCAL_DATA_CONFIRMATION).toContain("read history");
    expect(CLEAR_LOCAL_DATA_CONFIRMATION).toContain("saved posts");
    expect(CLEAR_LOCAL_DATA_CONFIRMATION).toContain("private author notes");
    expect(CLEAR_LOCAL_DATA_CONFIRMATION).toContain("cannot be undone");
    expect(CLEAR_LOCAL_DATA_PROGRESS).toContain("Clearing read history");
    expect(CLEAR_LOCAL_DATA_SUCCESS).toContain("Cleared read history, saved posts");
    expect(CLEAR_LOCAL_DATA_FAILURE).toContain("Some data may remain");
    expect(CLEAR_LOCAL_DATA_FAILURE).toContain("try again");
  });

  it("ships a labelled clear control and a polite atomic status region", async () => {
    const html = await readFile(new URL("../public/sidepanel.html", import.meta.url), "utf8");
    const { document } = parseHTML(html);
    const section = document.querySelector(".ff-local-data");
    const button = section?.querySelector("#ff-clear-data");
    const status = document.querySelector("#ff-status");

    expect(section?.getAttribute("aria-labelledby")).toBe("ff-local-data-title");
    expect(button?.textContent).toContain("Clear local user data");
    expect(button?.hasAttribute("aria-label")).toBe(false);
    expect(button?.getAttribute("aria-describedby")).toBe("ff-local-data-description");
    expect(document.querySelector("#ff-local-data-description")?.textContent).toContain(
      "Read history, saved posts, and private author notes",
    );
    expect(button?.getAttribute("type")).toBe("button");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("aria-atomic")).toBe("true");
  });
});

describe("runClearLocalData", () => {
  it("changes nothing when confirmation is cancelled", async () => {
    const clear = vi.fn(async () => undefined);
    const onStart = vi.fn();
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const onFinish = vi.fn();

    await expect(
      runClearLocalData({
        confirm: () => false,
        clear,
        onStart,
        onSuccess,
        onFailure,
        onFinish,
      }),
    ).resolves.toBe("cancelled");
    expect(clear).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("runs progress, success, and finish states in order", async () => {
    const events: string[] = [];

    await expect(
      runClearLocalData({
        confirm: () => true,
        clear: async () => {
          events.push("clear");
        },
        onStart: () => events.push("start"),
        onSuccess: () => events.push("success"),
        onFailure: () => events.push("failure"),
        onFinish: (outcome) => events.push(`finish:${outcome}`),
      }),
    ).resolves.toBe("cleared");
    expect(events).toEqual(["start", "clear", "success", "finish:cleared"]);
  });

  it("reports the original failure and always runs the failed finish state", async () => {
    const failure = new Error("partial removal");
    const seen: unknown[] = [];

    await expect(
      runClearLocalData({
        confirm: () => true,
        clear: async () => Promise.reject(failure),
        onStart: () => seen.push("start"),
        onSuccess: () => seen.push("success"),
        onFailure: (error) => seen.push(error),
        onFinish: (outcome) => seen.push(outcome),
      }),
    ).resolves.toBe("failed");
    expect(seen).toEqual(["start", failure, "failed"]);
  });
});

describe("resetRenderedLocalData", () => {
  it("removes new, saved, and note state while keeping the rendered thread", () => {
    const { document } = parseHTML("<!doctype html><html><body></body></html>");
    const view = renderThread(
      document,
      {
        title: "Thread",
        posts: [
          { id: "1", author: "ada", contentText: "first" },
          { id: "2", author: "ada", contentText: "second" },
        ],
      },
      {
        newPostIds: new Set(["2"]),
        savedPostIds: new Set(["1"]),
        userNotes: new Map([["ada", "trusted source"]]),
      },
    );
    document.body.append(view);

    const firstToggle = document.querySelector<HTMLElement>(".ff-post__note-toggle");
    const firstEditor = document.querySelector<HTMLElement>(".ff-post__note");
    firstToggle?.setAttribute("aria-expanded", "true");
    if (firstEditor) firstEditor.hidden = false;

    resetRenderedLocalData(document);

    expect(document.querySelectorAll(".ff-post")).toHaveLength(2);
    expect(document.querySelector(".ff-post__new")).toBeNull();
    expect(document.querySelector(".ff-post[data-new='true']")).toBeNull();
    expect(document.querySelector(".ff-post[data-saved='true']")).toBeNull();
    expect(document.querySelector(".ff-post[data-has-note='true']")).toBeNull();
    expect(
      Array.from(document.querySelectorAll(".ff-post__save")).map((button) => [
        button.textContent,
        button.getAttribute("aria-pressed"),
      ]),
    ).toEqual([
      ["Save", "false"],
      ["Save", "false"],
    ]);
    expect(
      Array.from(document.querySelectorAll<HTMLInputElement>(".ff-post__note-input")).map(
        (input) => input.value,
      ),
    ).toEqual(["", ""]);
    expect(
      Array.from(document.querySelectorAll<HTMLElement>(".ff-post__note")).every(
        (editor) => editor.hidden,
      ),
    ).toBe(true);
    expect(
      Array.from(document.querySelectorAll(".ff-post__note-toggle")).every(
        (toggle) => toggle.getAttribute("aria-expanded") === "false",
      ),
    ).toBe(true);

    setRenderedPersistenceControlsDisabled(document, true);
    expect(
      Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          ".ff-post__save, .ff-post__note-toggle, .ff-post__note-save, .ff-post__note-input",
        ),
      ).every((control) => control.disabled),
    ).toBe(true);
    setRenderedPersistenceControlsDisabled(document, false);
    expect(
      Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          ".ff-post__save, .ff-post__note-toggle, .ff-post__note-save, .ff-post__note-input",
        ),
      ).every((control) => !control.disabled),
    ).toBe(true);
  });
});
