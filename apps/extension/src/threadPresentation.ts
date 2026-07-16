import type { ForumForgePost } from "@forumforge/core";
import type { ExtractedThread, ThreadLayout, ThreadSource } from "@forumforge/parser";

/** Deep source threads remain complete, but the visual branch stops shifting after this level. */
export const MAX_VISUAL_DEPTH = 4;

export type PresentedPost = {
  readonly post: ForumForgePost;
  readonly index: number;
  readonly visualDepth: number;
  readonly children: PresentedPost[];
};

export type ThreadPresentation = {
  readonly layout: ThreadLayout;
  readonly source?: ThreadSource;
  /** Every post in source order, including safely flattened malformed relationships. */
  readonly nodes: PresentedPost[];
  /** Parent-first branches used by nested and article/comment renderers. */
  readonly roots: PresentedPost[];
};

/**
 * Convert validated extraction output into a bounded, renderer-ready forest.
 *
 * Only an earlier post can become a visual parent. That matches the reviewed
 * adapters, preserves their parent-before-child contract, and makes hostile
 * self, forward, missing, or cyclic references flatten instead of reordering
 * the page or recursing forever. Every source post still receives one node.
 */
export function buildThreadPresentation(thread: ExtractedThread): ThreadPresentation {
  const nodes: PresentedPost[] = thread.posts.map((post, index) => ({
    post,
    index,
    visualDepth: 0,
    children: [],
  }));
  const priorById = new Map<string, PresentedPost>();
  const roots: PresentedPost[] = [];

  for (const node of nodes) {
    const parentId = node.post.parentId?.trim();
    const parent = parentId && parentId !== node.post.id ? priorById.get(parentId) : undefined;
    if (parent) {
      const child: PresentedPost = {
        ...node,
        visualDepth: Math.min(parent.visualDepth + 1, MAX_VISUAL_DEPTH),
      };
      nodes[node.index] = child;
      parent.children.push(child);
    } else {
      roots.push(node);
    }
    if (!priorById.has(node.post.id)) priorById.set(node.post.id, nodes[node.index] ?? node);
  }

  return {
    layout: thread.layout ?? "linear",
    ...(thread.source ? { source: thread.source } : {}),
    nodes,
    roots,
  };
}
