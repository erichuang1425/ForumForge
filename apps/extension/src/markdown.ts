import type { ForumRole } from "@forumforge/core";
import type { SavedPost } from "./savedPosts";
import { safeHref } from "./sanitize";

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
    // The thread title is untrusted page text; the URL fallback is the reader's
    // own tab location. Escape the former, show the latter as the URL it is.
    lines.push(`## ${group.title ? escapeMarkdown(group.title) : group.url}`, "");
    // Link out to the source thread when there is a title to separate it from
    // and the URL passes the shared scheme allowlist.
    const threadHref = group.title ? safeHref(group.url, group.url) : undefined;
    if (threadHref) lines.push(mdLink("Open thread", threadHref), "");

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
  // author and timestamp are untrusted page text; role is one of our own labels.
  const meta = [post.author, role, post.timestamp].filter((part) => part).join(" · ");

  const out: string[] = [`### ${escapeMarkdown(meta)}`, ""];
  out.push(...blockquote(post.contentText), "");
  // permalink is an untrusted page href: resolve it against the thread URL and
  // apply the shared scheme allowlist, so a `javascript:`/`data:` link is never
  // exported as an active link. Unsafe or unparseable links are simply omitted.
  const href = safeHref(post.permalink ?? null, record.threadUrl);
  if (href) out.push(mdLink("Permalink", href));
  // Drop a trailing blank pushed by an empty body so spacing stays uniform.
  return out.filter((line, index) => !(line === "" && out[index + 1] === ""));
}

/**
 * Render text as a Markdown blockquote: every line prefixed with `>`, so the
 * post body — whatever it contains — stays visibly contained and can't be
 * mistaken for document structure. The body is untrusted page text, so each
 * line is escaped ({@link escapeMarkdown}) before quoting. An empty body becomes
 * an em dash.
 */
function blockquote(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === "") return ["> —"];
  return trimmed.split("\n").map((line) => (line === "" ? ">" : `> ${escapeMarkdown(line)}`));
}

/**
 * Escape untrusted plain text so a Markdown renderer shows it literally instead
 * of interpreting it. Post bodies, author names, titles and timestamps all come
 * from the forum page (untrusted, see SECURITY.md). Without this, text such as
 * `![x](https://tracker.example/pixel)` or a raw `<img>` tag would become active
 * Markdown on export — including remote image loads that leak a signal the
 * moment the reader opens the file. Backslash-escaping every ASCII-punctuation
 * character that can begin a Markdown or HTML construct keeps the text inert.
 */
function escapeMarkdown(text: string): string {
  // Backslash is escaped first (it leads the class) so the escapes we add below
  // aren't themselves re-escaped.
  return text.replace(/[\\`*_{}[\]<>()#+.!|~&-]/g, (ch) => `\\${ch}`);
}

/**
 * A Markdown link with an escaped label and a contained destination. The label
 * is untrusted; the URL must already have passed {@link safeHref} (so its scheme
 * is allowlisted). Percent-encoding the characters that would otherwise close or
 * break out of the `(...)` destination keeps the link valid and prevents it from
 * injecting trailing Markdown.
 */
function mdLink(label: string, url: string): string {
  return `[${escapeMarkdown(label)}](${escapeUrl(url)})`;
}

/** Percent-encode the characters that could break out of a link destination. */
function escapeUrl(url: string): string {
  return url.replace(
    /[\s()<>\\]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()}`,
  );
}

/** "N posts from M threads", pluralized. */
function summary(postCount: number, threadCount: number): string {
  const posts = postCount === 1 ? "1 post" : `${postCount} posts`;
  const threads = threadCount === 1 ? "1 thread" : `${threadCount} threads`;
  return `${posts} from ${threads}`;
}
