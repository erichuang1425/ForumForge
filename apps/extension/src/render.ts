import type { ForumForgePost, ForumRole } from "@forumforge/core";
import type { ExtractedThread } from "@forumforge/parser";
import { sanitizeHtml } from "./sanitize";

/**
 * Human-readable badge text per role. The OP highlighting feature surfaces who
 * is who in a thread; "user" is the unmarked default, so it gets no badge.
 */
const ROLE_LABELS: Record<ForumRole, string> = {
  op: "OP",
  mod: "Mod",
  admin: "Admin",
  user: "",
};

/** View options for {@link renderThread}. */
export type RenderOptions = {
  /**
   * Ids of posts that are new since the reader's last visit (see
   * {@link ../readHistory}). New posts get a "New" badge and an edge accent so
   * the reader can pick up where they left off.
   */
  newPostIds?: ReadonlySet<string>;
  /**
   * Ids of posts the reader has saved (see {@link ./savedPosts}). Each post gets
   * a Save toggle; saved ones render pressed. The panel wires the click — render
   * only reflects state — so this stays a pure view.
   */
  savedPostIds?: ReadonlySet<string>;
};

/**
 * Build a clean, read-only view of an extracted thread.
 *
 * Post content is untrusted page input (see SECURITY.md). The author, role and
 * timestamp are always written with `textContent`, never `innerHTML`. The body
 * renders the post's rich `contentHtml` when present — run through the
 * allowlist {@link sanitizeHtml}, so only safe, semantic markup reaches the
 * panel — and falls back to plain `contentText` otherwise. Pass the panel's own
 * `document`. `options.newPostIds` flags posts new since the last visit.
 */
export function renderThread(
  doc: Document,
  thread: ExtractedThread,
  options: RenderOptions = {},
): HTMLElement {
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

  const newPostIds = options.newPostIds;
  const savedPostIds = options.savedPostIds;
  const list = doc.createElement("ol");
  list.className = "ff-posts";
  for (const post of thread.posts) {
    list.append(
      renderPost(doc, post, thread.baseUrl, {
        isNew: newPostIds?.has(post.id) ?? false,
        isSaved: savedPostIds?.has(post.id) ?? false,
      }),
    );
  }
  root.append(list);
  return root;
}

/** Per-post view flags resolved from {@link RenderOptions}. */
type PostFlags = { isNew: boolean; isSaved: boolean };

function renderPost(
  doc: Document,
  post: ForumForgePost,
  baseUrl: string | undefined,
  flags: PostFlags,
): HTMLElement {
  const item = doc.createElement("li");
  item.className = "ff-post";
  // The post id rides on the element so the panel's delegated click handler can
  // map a Save toggle back to the post it belongs to.
  item.setAttribute("data-post-id", post.id);
  if (post.role) item.setAttribute("data-role", post.role);
  if (flags.isNew) item.setAttribute("data-new", "true");
  if (flags.isSaved) item.setAttribute("data-saved", "true");

  const meta = doc.createElement("header");
  meta.className = "ff-post__meta";

  const author = doc.createElement("span");
  author.className = "ff-post__author";
  author.textContent = post.author;
  meta.append(author);

  const roleLabel = post.role ? ROLE_LABELS[post.role] : "";
  if (roleLabel) {
    const role = doc.createElement("span");
    role.className = "ff-post__role";
    role.textContent = roleLabel;
    meta.append(role);
  }

  // The "New" signal is text as well as color (like the role badge), so it
  // doesn't rely on color alone.
  if (flags.isNew) {
    const badge = doc.createElement("span");
    badge.className = "ff-post__new";
    badge.textContent = "New";
    meta.append(badge);
  }

  if (post.timestamp) {
    const time = doc.createElement("time");
    time.className = "ff-post__time";
    time.textContent = post.timestamp;
    meta.append(time);
  }

  meta.append(renderSaveButton(doc, post.id, flags.isSaved));

  item.append(meta, renderBody(doc, post, baseUrl));
  return item;
}

/**
 * The Save toggle for a post. `aria-pressed` carries the saved state for screen
 * readers, and the label ("Save" / "Saved") carries it visually — not color
 * alone. The panel handles the click; this only reflects the current state.
 */
function renderSaveButton(doc: Document, postId: string, isSaved: boolean): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "ff-post__save";
  button.setAttribute("data-post-id", postId);
  setSaveButtonState(button, isSaved);
  return button;
}

/**
 * Reflect saved state on a Save button: label, `aria-pressed`, and the
 * `data-saved` flag on the owning post. Shared by initial render and the panel's
 * post-click update so the two never drift.
 */
export function setSaveButtonState(button: HTMLElement, isSaved: boolean): void {
  button.textContent = isSaved ? "Saved" : "Save";
  button.setAttribute("aria-pressed", String(isSaved));
  const post = button.closest<HTMLElement>(".ff-post");
  if (post) {
    if (isSaved) post.setAttribute("data-saved", "true");
    else post.removeAttribute("data-saved");
  }
}

/**
 * Render the post body: sanitized rich content when the post has usable
 * `contentHtml`, otherwise the plain-text body. A `div` (not `p`) wraps it so
 * sanitized block elements (`blockquote`, `pre`, lists, tables) nest validly.
 * `baseUrl` (the thread's source page) resolves the post's relative links.
 */
function renderBody(doc: Document, post: ForumForgePost, baseUrl?: string): HTMLElement {
  const body = doc.createElement("div");
  body.className = "ff-post__body";

  if (typeof post.contentHtml === "string" && post.contentHtml !== "") {
    body.append(sanitizeHtml(doc, post.contentHtml, baseUrl));
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
