import { isForumForgePost } from "@forumforge/core";
import type { ExtractedThread, ThreadLayout, ThreadSource } from "@forumforge/parser";

const THREAD_LAYOUTS: readonly ThreadLayout[] = [
  "linear",
  "article-comments",
  "nested",
  "ptt",
  "imageboard",
  "qa",
];
const THREAD_SOURCES: readonly ThreadSource[] = [
  "nairaland",
  "hacker-news",
  "ptt",
  "4chan",
  "arca",
  "dc-inside",
  "fmkorea",
  "stack-overflow",
];

/**
 * The message protocol between the side panel and the page's content script.
 *
 * Messages cross an untrusted boundary (the content script runs in the page), so
 * every payload is validated with a type guard on arrival rather than trusted by
 * shape. Tags are namespaced to avoid clashing with other extensions' messages.
 */

/** Ask the content script to extract the thread on its page. */
export type ExtractRequest = { type: "forumforge/extract" };

/** Ask the on-demand content script to toggle its immersive page reader. */
export type ToggleReaderRequest = { type: "forumforge/toggle-reader" };

/** Ask the background worker to open the extension's local-library side panel. */
export type OpenLibraryRequest = { type: "forumforge/open-library" };

/** Report whether the requested local-library panel actually opened. */
export type LibraryResult = { type: "forumforge/library-result"; opened: boolean };

/** A successful extraction, returned to the requester. */
export type ThreadResponse = { type: "forumforge/thread"; thread: ExtractedThread };

/** Extraction failed in the page; carries a human-readable reason. */
export type ErrorResponse = { type: "forumforge/error"; message: string };

export type ExtractResponse = ThreadResponse | ErrorResponse;

/** The single, shared extract-request value. */
export const EXTRACT_REQUEST: ExtractRequest = { type: "forumforge/extract" };

export const TOGGLE_READER_REQUEST: ToggleReaderRequest = {
  type: "forumforge/toggle-reader",
};

export const OPEN_LIBRARY_REQUEST: OpenLibraryRequest = {
  type: "forumforge/open-library",
};

export function isExtractRequest(value: unknown): value is ExtractRequest {
  return isTagged(value) && value.type === "forumforge/extract";
}

export function isToggleReaderRequest(value: unknown): value is ToggleReaderRequest {
  return isTagged(value) && value.type === "forumforge/toggle-reader";
}

export function isOpenLibraryRequest(value: unknown): value is OpenLibraryRequest {
  return isTagged(value) && value.type === "forumforge/open-library";
}

export function isLibraryResult(value: unknown): value is LibraryResult {
  return (
    isTagged(value) &&
    value.type === "forumforge/library-result" &&
    typeof value.opened === "boolean"
  );
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
  if (
    value.layout !== undefined &&
    (typeof value.layout !== "string" || !THREAD_LAYOUTS.includes(value.layout as ThreadLayout))
  ) {
    return false;
  }
  if (
    value.source !== undefined &&
    (typeof value.source !== "string" || !THREAD_SOURCES.includes(value.source as ThreadSource))
  ) {
    return false;
  }
  const postIds = new Set<string>();
  for (const post of value.posts) {
    if (!isForumForgePost(post) || postIds.has(post.id)) return false;
    postIds.add(post.id);
  }
  return true;
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
