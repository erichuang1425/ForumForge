import type { ForumForgePost } from "@forumforge/core";
import type { ExtractedThread } from "@forumforge/parser";

/**
 * Build a clean, read-only view of an extracted thread.
 *
 * Phase 0 renders the plain-text body and writes every field with `textContent`,
 * never `innerHTML`: post content is untrusted page input (see SECURITY.md), so
 * nothing extracted from the page can inject markup or script into the panel.
 * Rich `contentHtml` rendering — which requires sanitization — is part of
 * Phase 1 clean reading mode. Pass the panel's own `document`.
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

  const body = doc.createElement("p");
  body.className = "ff-post__body";
  body.textContent = post.contentText;

  item.append(meta, body);
  return item;
}
