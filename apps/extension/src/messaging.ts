import type { ExtractedThread } from "@forumforge/parser";

/**
 * The message protocol between the side panel and the page's content script.
 *
 * Messages cross an untrusted boundary (the content script runs in the page), so
 * every payload is validated with a type guard on arrival rather than trusted by
 * shape. Tags are namespaced to avoid clashing with other extensions' messages.
 */

/** Ask the content script to extract the thread on its page. */
export type ExtractRequest = { type: "forumforge/extract" };

/** A successful extraction, returned to the requester. */
export type ThreadResponse = { type: "forumforge/thread"; thread: ExtractedThread };

/** Extraction failed in the page; carries a human-readable reason. */
export type ErrorResponse = { type: "forumforge/error"; message: string };

export type ExtractResponse = ThreadResponse | ErrorResponse;

/** The single, shared extract-request value. */
export const EXTRACT_REQUEST: ExtractRequest = { type: "forumforge/extract" };

export function isExtractRequest(value: unknown): value is ExtractRequest {
  return isTagged(value) && value.type === "forumforge/extract";
}

export function isExtractResponse(value: unknown): value is ExtractResponse {
  return (
    isTagged(value) &&
    (value.type === "forumforge/thread" || value.type === "forumforge/error")
  );
}

function isTagged(value: unknown): value is { type: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}
