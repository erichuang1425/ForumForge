import { describe, it, expect } from "vitest";
import {
  EXTRACT_REQUEST,
  isExtractRequest,
  isExtractResponse,
} from "../src/messaging";

describe("messaging guards", () => {
  it("recognizes the extract request", () => {
    expect(isExtractRequest(EXTRACT_REQUEST)).toBe(true);
    expect(isExtractRequest({ type: "forumforge/extract" })).toBe(true);
  });

  it("recognizes thread and error responses", () => {
    expect(isExtractResponse({ type: "forumforge/thread", thread: { posts: [] } })).toBe(true);
    expect(isExtractResponse({ type: "forumforge/error", message: "nope" })).toBe(true);
  });

  it("rejects foreign or malformed messages", () => {
    for (const bad of [null, undefined, 42, "extract", {}, { type: 7 }, { type: "other/thing" }]) {
      expect(isExtractRequest(bad)).toBe(false);
      expect(isExtractResponse(bad)).toBe(false);
    }
  });
});
