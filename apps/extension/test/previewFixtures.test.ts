import { isForumForgePost } from "@forumforge/core";
import { describe, expect, it } from "vitest";
import { getPreviewStory, PREVIEW_STORIES } from "../preview/fixtures";

const EXPECTED_LAYOUTS = [
  "linear",
  "article-comments",
  "nested",
  "ptt",
  "imageboard",
  "qa",
] as const;

const EXPECTED_SOURCES = [
  "nairaland",
  "hacker-news",
  "ptt",
  "4chan",
  "arca",
  "dc-inside",
  "fmkorea",
  "stack-overflow",
] as const;

describe("offline reader preview fixtures", () => {
  it("covers every discussion layout and each reviewed target-site renderer", () => {
    expect(new Set(PREVIEW_STORIES.map((story) => story.thread.layout))).toEqual(
      new Set(EXPECTED_LAYOUTS),
    );
    expect(new Set(PREVIEW_STORIES.map((story) => story.thread.source))).toEqual(
      new Set(EXPECTED_SOURCES),
    );
  });

  it("stays small, synthetic, valid, parent-first, and offline-safe", () => {
    for (const story of PREVIEW_STORIES) {
      expect(story.thread.posts.length).toBeGreaterThan(0);
      expect(story.thread.posts.length).toBeLessThanOrEqual(8);
      expect(new URL(story.sourceUrl).hostname.endsWith(".example")).toBe(true);
      expect(new URL(story.thread.baseUrl ?? "https://invalid.invalid").hostname.endsWith(".example"))
        .toBe(true);

      const priorIds = new Set<string>();
      for (const post of story.thread.posts) {
        expect(isForumForgePost(post)).toBe(true);
        expect(priorIds.has(post.id)).toBe(false);
        if (post.parentId) expect(priorIds.has(post.parentId)).toBe(true);
        priorIds.add(post.id);
        expect(post.contentHtml ?? "").not.toMatch(
          /<(?:script|iframe|frame|object|embed|applet)\b|<(?:img|source|audio|video)\b[^>]*(?:src|srcset)\s*=\s*["']?\s*https?:/iu,
        );
      }
    }
  });

  it("falls back deterministically for an unknown story id", () => {
    expect(getPreviewStory("not-a-story")).toBe(PREVIEW_STORIES[0]);
    expect(getPreviewStory(null)).toBe(PREVIEW_STORIES[0]);
  });
});
