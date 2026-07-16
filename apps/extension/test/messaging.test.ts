import { describe, it, expect } from "vitest";
import {
  EXTRACT_REQUEST,
  OPEN_LIBRARY_REQUEST,
  TOGGLE_READER_REQUEST,
  isExtractRequest,
  isExtractResponse,
  isLibraryResult,
  isOpenLibraryRequest,
  isToggleReaderRequest,
} from "../src/messaging";

describe("messaging guards", () => {
  it("recognizes the extract request", () => {
    expect(isExtractRequest(EXTRACT_REQUEST)).toBe(true);
    expect(isExtractRequest({ type: "forumforge/extract" })).toBe(true);
  });

  it("recognizes only the namespaced reader and library messages", () => {
    expect(isToggleReaderRequest(TOGGLE_READER_REQUEST)).toBe(true);
    expect(isOpenLibraryRequest(OPEN_LIBRARY_REQUEST)).toBe(true);
    expect(isLibraryResult({ type: "forumforge/library-result", opened: true })).toBe(true);
    expect(isLibraryResult({ type: "forumforge/library-result", opened: false })).toBe(true);
    expect(isToggleReaderRequest({ type: "forumforge/open-library" })).toBe(false);
    expect(isOpenLibraryRequest({ type: "forumforge/toggle-reader" })).toBe(false);
    expect(isLibraryResult({ type: "forumforge/library-result", opened: "yes" })).toBe(false);
  });

  it("recognizes thread and error responses", () => {
    expect(isExtractResponse({ type: "forumforge/thread", thread: { posts: [] } })).toBe(true);
    expect(isExtractResponse({ type: "forumforge/error", message: "nope" })).toBe(true);
  });

  it("rejects foreign or malformed messages", () => {
    for (const bad of [
      null,
      undefined,
      42,
      "extract",
      {},
      { type: 7 },
      { type: "other/thing" },
      { type: "forumforge/error" },
      { type: "forumforge/error", message: 7 },
      { type: "forumforge/thread" },
      { type: "forumforge/thread", thread: { posts: "not-an-array" } },
      {
        type: "forumforge/thread",
        thread: { posts: [{ id: "1", author: "Ada" }] },
      },
      {
        type: "forumforge/thread",
        thread: { posts: [{ id: " ", author: "Ada", contentText: "Hello" }] },
      },
      {
        type: "forumforge/thread",
        thread: {
          posts: [{ id: "1", author: "Ada", contentText: "Hello", role: "owner" }],
        },
      },
      {
        type: "forumforge/thread",
        thread: {
          posts: [{ id: "1", author: "Ada", contentText: "Hello", role: ["op"] }],
        },
      },
      {
        type: "forumforge/thread",
        thread: {
          posts: [
            { id: "duplicate", author: "Ada", contentText: "First" },
            { id: "duplicate", author: "Grace", contentText: "Second" },
          ],
        },
      },
    ]) {
      expect(isExtractRequest(bad)).toBe(false);
      expect(isExtractResponse(bad)).toBe(false);
      expect(isToggleReaderRequest(bad)).toBe(false);
      expect(isOpenLibraryRequest(bad)).toBe(false);
      expect(isLibraryResult(bad)).toBe(false);
    }
  });
});
