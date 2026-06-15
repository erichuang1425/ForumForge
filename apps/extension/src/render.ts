import type { ForumForgePost } from "@forumforge/core";
import type { ExtractedThread } from "@forumforge/parser";
import { sanitizeHtml } from "./sanitize";

/**
 * Build a clean, read-only view of an extracted thread.
 *
 * Post content is untrusted page input (see SECURITY.md). The author, role and
 * timestamp are always written with `textContent`, never `innerHTML`. The body
 * renders the post's rich `contentHtml` when present — run through the
 * allowlist {@link sanitizeHtml}, so only safe, semantic markup reaches the
 * panel — and falls back to plain `contentText` otherwise. Pass the panel's own
 * `document`.
 */
export function renderThread(doc: Document, thread: ExtractedThread): HTMLElement {
  const root = doc.createElement("section");
  root.className = "ff-thread";

  if (thread.title) {
    const title = doc.createElement("h1");
    title.className = "ff-thread__title";
    title.textContent = thread.title;
    root.append(title);
  }

  if (thread.posts.length === 0) {
    const empty = doc.createElement("p");
    empty.className = "ff-empty";
    empty.textContent = "No posts found on this page.";
    root.append(empty);
    return root;
  }

  const list = doc.createElement("ol");
  list.className = "ff-posts";
  for (const post of thread.posts) {
    list.append(renderPost(doc, post));
  }
  root.append(list);
  return root;
}

function renderPost(doc: Document, post: ForumForgePost): HTMLElement {
  const item = doc.createElement("li");
  item.className = "ff-post";
  if (post.role) item.setAttribute("data-role", post.role);

  const meta = doc.createElement("header");
  meta.className = "ff-post__meta";

  const author = doc.createElement("span");
  author.className = "ff-post__author";
  author.textContent = post.author;
  meta.append(author);

  if (post.role) {
    const role = doc.createElement("span");
    role.className = "ff-post__role";
    role.textContent = post.role;
    meta.append(role);
  }

  if (post.timestamp) {
    const time = doc.createElement("time");
    time.className = "ff-post__time";
    time.textContent = post.timestamp;
    meta.append(time);
  }

  item.append(meta, renderBody(doc, post));
  return item;
}

/**
 * Render the post body: sanitized rich content when the post has usable
 * `contentHtml`, otherwise the plain-text body. A `div` (not `p`) wraps it so
 * sanitized block elements (`blockquote`, `pre`, lists, tables) nest validly.
 */
function renderBody(doc: Document, post: ForumForgePost): HTMLElement {
  const body = doc.createElement("div");
  body.className = "ff-post__body";

  if (typeof post.contentHtml === "string" && post.contentHtml !== "") {
    body.append(sanitizeHtml(doc, post.contentHtml));
    // Sanitizing can empty out a body (e.g. an image-only post): keep the rich
    // body only if it has visible text, otherwise fall back to plain text.
    if ((body.textContent ?? "").trim() !== "") return body;
    body.replaceChildren();
  }

  const text = doc.createElement("p");
  text.className = "ff-post__text";
  text.textContent = post.contentText;
  body.append(text);
  return body;
}
