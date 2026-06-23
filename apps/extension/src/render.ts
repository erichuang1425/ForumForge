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
  /**
   * Private notes the reader has written about authors (see {@link ./userNotes}),
   * keyed by author display name. Each post gets a collapsible note editor
   * pre-filled with its author's note; posts whose author has one are flagged so
   * the reader can spot annotated people. The panel wires saving — render only
   * reflects state.
   */
  userNotes?: ReadonlyMap<string, string>;
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
  const userNotes = options.userNotes;
  const list = doc.createElement("ol");
  list.className = "ff-posts";
  for (const post of thread.posts) {
    list.append(
      renderPost(doc, post, thread.baseUrl, {
        isNew: newPostIds?.has(post.id) ?? false,
        isSaved: savedPostIds?.has(post.id) ?? false,
        note: userNotes?.get(post.author) ?? "",
      }),
    );
  }
  root.append(list);
  return root;
}

/** Per-post view flags resolved from {@link RenderOptions}. */
type PostFlags = { isNew: boolean; isSaved: boolean; note: string };

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
  meta.append(renderNoteToggle(doc));

  item.append(meta, renderBody(doc, post, baseUrl), renderNoteEditor(doc, post.author));
  setNoteState(item, flags.note);
  return item;
}

/**
 * The "Note" toggle for a post. It only shows/hides the post's note editor (the
 * panel wires that), so it carries `aria-expanded`, starting collapsed.
 */
function renderNoteToggle(doc: Document): HTMLElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = "ff-post__note-toggle";
  button.textContent = "Note";
  button.setAttribute("aria-expanded", "false");
  return button;
}

/**
 * The collapsible note editor for a post's author: a textarea plus a Save
 * button, hidden until the reader opens it. `data-author` rides on the region so
 * the panel can find every post by the same author and keep their notes in sync.
 * The author is written via `value`/attributes, never parsed as markup.
 */
function renderNoteEditor(doc: Document, author: string): HTMLElement {
  const region = doc.createElement("div");
  region.className = "ff-post__note";
  region.setAttribute("data-author", author);
  region.hidden = true;

  const input = doc.createElement("textarea");
  input.className = "ff-post__note-input";
  input.setAttribute("rows", "3");
  input.setAttribute("aria-label", `Private note about ${author}`);
  input.placeholder = `Private note about ${author}…`;

  const save = doc.createElement("button");
  save.type = "button";
  save.className = "ff-post__note-save";
  save.textContent = "Save note";

  region.append(input, save);
  return region;
}

/**
 * Reflect an author's note on a post: pre-fill the editor's textarea and flag
 * the post with `data-has-note` when there is one (a non-color cue the author is
 * annotated). Shared by initial render and the panel's post-save update so the
 * two never drift, and applied across every post by the same author at once.
 */
export function setNoteState(post: HTMLElement, note: string): void {
  const input = post.querySelector<HTMLTextAreaElement>(".ff-post__note-input");
  if (input) input.value = note;
  if (note.trim() !== "") post.setAttribute("data-has-note", "true");
  else post.removeAttribute("data-has-note");
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
