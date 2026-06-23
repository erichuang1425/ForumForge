import type { ForumRole } from "@forumforge/core";
import type { SavedPost } from "./savedPosts";

/**
 * "Markdown export" — turn the reader's saved posts into a clean Markdown note.
 *
 * The plan promises that saved comments "can later be exported as Markdown for
 * personal notes, troubleshooting logs, research, or documentation" (see
 * Initial Plan.md). This module is the deterministic, pure part of that feature:
 * given saved-post snapshots it returns a Markdown string. The panel handles
 * gathering the saves and downloading the result.
 *
 * Export is local-first (see docs/PRIVACY.md): it reads only what the reader
 * already saved on-device and produces a file the reader downloads themselves —
 * nothing leaves the browser on its own, and no new permissions are needed.
 */

/** Human-readable role suffix for a post heading. "user" is the unmarked default. */
const ROLE_LABELS: Record<ForumRole, string> = {
  op: "OP",
  mod: "Mod",
  admin: "Admin",
  user: "",
};

/** Options for {@link savedPostsToMarkdown}. `now` is injectable for tests. */
export type MarkdownExportOptions = {
  /** Top-level document heading. */
  title?: string;
  /** When the export was produced; shown in the subtitle. Defaults to now. */
  now?: Date;
};

/** A source thread plus the saved posts that belong to it, in saved order. */
type ThreadGroup = { title?: string; url: string; posts: SavedPost[] };

/**
 * Convert saved posts into a Markdown note, grouped by the thread each came
 * from. Threads appear in the order their first saved post does (callers pass
 * `SavedPosts.all()`, most-recently-saved first), so the freshest thread leads.
 *
 * The body is the post's plain `contentText` rendered as a blockquote — a
 * deterministic, safe rendering that can't break the document's structure. An
 * empty input yields a note that says so rather than a blank file.
 */
export function savedPostsToMarkdown(
  saved: readonly SavedPost[],
  options: MarkdownExportOptions = {},
): string {
  const title = options.title ?? "ForumForge — Saved posts";
  const when = options.now ?? new Date();

  const lines: string[] = [`# ${title}`, ""];

  if (saved.length === 0) {
    lines.push("_No saved posts yet._", "");
    return lines.join("\n");
  }

  const groups = groupByThread(saved);
  lines.push(`_${summary(saved.length, groups.length)} · exported ${when.toISOString()}._`, "");

  for (const group of groups) {
    lines.push(`## ${group.title ?? group.url}`, "");
    // Link out to the source thread when there is a title to separate it from.
    if (group.title) lines.push(`[Open thread](${group.url})`, "");

    for (const saved of group.posts) {
      lines.push(...renderPost(saved), "");
    }
  }

  // Collapse the trailing blank line into a single closing newline.
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Group saved posts by source thread, preserving first-seen thread order. */
function groupByThread(saved: readonly SavedPost[]): ThreadGroup[] {
  const groups = new Map<string, ThreadGroup>();
  for (const record of saved) {
    let group = groups.get(record.threadKey);
    if (!group) {
      group = { title: record.threadTitle, url: record.threadUrl, posts: [] };
      groups.set(record.threadKey, group);
    }
    group.posts.push(record);
  }
  return [...groups.values()];
}

/** A single saved post: an author/role/timestamp heading, the body, a permalink. */
function renderPost(record: SavedPost): string[] {
  const { post } = record;
  const role = post.role ? ROLE_LABELS[post.role] : "";
  const meta = [post.author, role, post.timestamp].filter((part) => part).join(" · ");

  const out: string[] = [`### ${meta}`, ""];
  out.push(...blockquote(post.contentText), "");
  if (post.permalink) out.push(`[Permalink](${post.permalink})`);
  // Drop a trailing blank pushed by an empty body so spacing stays uniform.
  return out.filter((line, index) => !(line === "" && out[index + 1] === ""));
}

/**
 * Render text as a Markdown blockquote: every line prefixed with `>`, so the
 * post body — whatever it contains — stays visibly contained and can't be
 * mistaken for document structure. An empty body becomes an em dash.
 */
function blockquote(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === "") return ["> —"];
  return trimmed.split("\n").map((line) => (line === "" ? ">" : `> ${line}`));
}

/** "N posts from M threads", pluralized. */
function summary(postCount: number, threadCount: number): string {
  const posts = postCount === 1 ? "1 post" : `${postCount} posts`;
  const threads = threadCount === 1 ? "1 thread" : `${threadCount} threads`;
  return `${posts} from ${threads}`;
}
