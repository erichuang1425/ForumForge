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
  if (!isTagged(value)) return false;
  if (value.type === "forumforge/error") return typeof value.message === "string";
  if (value.type === "forumforge/thread") return isExtractedThread(value.thread);
  return false;
}

function isExtractedThread(value: unknown): value is ExtractedThread {
  if (!isRecord(value) || !Array.isArray(value.posts)) return false;
  if (!isOptionalString(value.title) || !isOptionalString(value.baseUrl)) return false;
  return value.posts.every(isForumForgePost);
}

function isForumForgePost(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    typeof value.author !== "string" ||
    typeof value.contentText !== "string"
  ) {
    return false;
  }
  if (
    !isOptionalString(value.authorUrl) ||
    !isOptionalString(value.timestamp) ||
    !isOptionalString(value.contentHtml) ||
    !isOptionalString(value.permalink) ||
    !isOptionalString(value.parentId)
  ) {
    return false;
  }
  if (
    value.role !== undefined &&
    (typeof value.role !== "string" ||
      !["op", "user", "mod", "admin"].includes(value.role))
  ) {
    return false;
  }
  if (
    value.depth !== undefined &&
    (!Number.isInteger(value.depth) || Number(value.depth) < 0)
  ) {
    return false;
  }
  return (
    value.links === undefined ||
    (Array.isArray(value.links) && value.links.every((link) => typeof link === "string"))
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTagged(value: unknown): value is Record<string, unknown> & { type: string } {
  return (
    isRecord(value) &&
    typeof value.type === "string"
  );
}
