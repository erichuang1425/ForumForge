import type { ForumForgePost } from "@forumforge/core";
import { describe, expect, it } from "vitest";
import { ensureUniquePostIds } from "../src/ids";

describe("ensureUniquePostIds", () => {
  it("preserves explicit ids and remaps a child to the latest duplicate parent", () => {
    const posts: ForumForgePost[] = [
      { id: "parent", author: "First", contentText: "First parent" },
      { id: "parent", author: "Second", contentText: "Second parent" },
      { id: "child", author: "Child", contentText: "Reply", parentId: "parent" },
      { id: "parent~2", author: "Reserved", contentText: "Explicit suffix" },
    ];

    const result = ensureUniquePostIds(posts);

    expect(result.map((post) => post.id)).toEqual([
      "parent",
      "parent~3",
      "child",
      "parent~2",
    ]);
    expect(result[2]?.parentId).toBe("parent~3");
    expect(posts[1]?.id).toBe("parent");
    expect(posts[2]?.parentId).toBe("parent");
  });
});
