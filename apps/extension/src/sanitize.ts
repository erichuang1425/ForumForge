/**
 * Sanitize untrusted forum HTML into a safe, normalized fragment for the side
 * panel's clean reading view.
 *
 * Forum post HTML is untrusted input (see SECURITY.md / AGENTS.md). Instead of
 * stripping dangerous bits out of the source ("tear-down", easy to get wrong),
 * we build a fresh tree that contains ONLY allowlisted, semantic elements and
 * attributes ("build-up"): anything not explicitly allowed is dropped. That
 * guarantees no script, inline handler, style, embed, or unsafe URL can survive,
 * and it yields the trimmed, normalized markup that clean reading mode wants.
 *
 * No regexes parse HTML here: the source is parsed by the platform into an inert
 * `<template>` fragment (no browsing context, so no script runs and no resource
 * loads even before we sanitize), then we walk that tree node by node.
 */

// Node.nodeType values. We avoid the `Node.*` constants because they are not
// available in every environment the tests run under.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Reading-focused elements we re-create as real nodes. Anything not here and not
 * in {@link DROP_WITH_CONTENT} is unwrapped — dropped, but its sanitized children
 * are kept — so layout wrappers (`div`, `span`, `font`, …) melt away while their
 * readable content stays.
 */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "a",
  "blockquote", "q",
  "pre", "code",
  "ul", "ol", "li",
  "dl", "dt", "dd",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "sub", "sup", "small",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
]);

/**
 * Elements dropped together with their entire subtree. These either execute or
 * carry content that must never surface as text (script/style source), pull in
 * remote resources, or open a nested browsing context. Images are intentionally
 * dropped here too: rendering them would make third-party requests, which the
 * privacy stance forbids by default (image handling is a later, opt-in feature).
 */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "noscript", "template", "title", "head", "base", "meta", "link",
  "iframe", "frame", "frameset", "object", "embed", "applet", "param",
  "svg", "math", "canvas",
  "img", "picture", "source", "audio", "video", "track",
  "form", "input", "button", "select", "option", "optgroup", "textarea", "label",
]);

/** URL schemes safe to keep on a link. Everything else (javascript:, data:, …) is dropped. */
const SAFE_URL = /^(?:https?:|mailto:)/i;

/** True if the string holds an ASCII control character (incl. tab/newline) or DEL. */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Return a safe href, or undefined if the URL is missing or uses an unsafe scheme. */
function safeHref(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim();
  // Control characters can smuggle a scheme past the check (e.g. a tab inside
  // "java<TAB>script:"); reject them outright rather than trying to normalize.
  if (hasControlChar(value)) return undefined;
  return SAFE_URL.test(value) ? value : undefined;
}

function appendSanitized(targetDoc: Document, parent: Node, node: Node): void {
  if (node.nodeType === TEXT_NODE) {
    // Text becomes a fresh text node: inert by construction, markup never live.
    const text = node.textContent;
    if (text) parent.appendChild(targetDoc.createTextNode(text));
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return; // comments, processing instructions, …

  const element = node as Element;
  const tag = element.tagName.toLowerCase();

  if (DROP_WITH_CONTENT.has(tag)) return;

  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown wrapper: drop it, keep its sanitized children.
    for (const child of Array.from(element.childNodes)) {
      appendSanitized(targetDoc, parent, child);
    }
    return;
  }

  const clean = targetDoc.createElement(tag);
  if (tag === "a") {
    const href = safeHref(element.getAttribute("href"));
    if (href) clean.setAttribute("href", href);
    // Links open in a new tab so they never navigate the panel away from itself,
    // and carry no referrer/opener to the forum's link targets.
    clean.setAttribute("target", "_blank");
    clean.setAttribute("rel", "noopener noreferrer nofollow");
  }
  // No other attribute is copied: on* handlers, style, class, id, src, srcset and
  // every data-* attribute are dropped simply by never carrying them over.

  for (const child of Array.from(element.childNodes)) {
    appendSanitized(targetDoc, clean, child);
  }
  parent.appendChild(clean);
}

/**
 * Sanitize an already-parsed source tree into a fresh fragment owned by
 * `targetDoc`. This is the security boundary and is pure — it only reads the
 * source and only creates allowlisted nodes — so it is exhaustively unit-tested.
 */
export function sanitizeFragment(targetDoc: Document, source: Node): DocumentFragment {
  const fragment = targetDoc.createDocumentFragment();
  for (const child of Array.from(source.childNodes)) {
    appendSanitized(targetDoc, fragment, child);
  }
  return fragment;
}

/**
 * Parse untrusted HTML inertly and return a sanitized fragment ready to insert
 * into the panel. Parsing uses a detached `<template>`, whose contents live in a
 * document with no browsing context, so nothing executes or loads during parse.
 */
export function sanitizeHtml(targetDoc: Document, html: string): DocumentFragment {
  const template = targetDoc.createElement("template");
  template.innerHTML = html;
  return sanitizeFragment(targetDoc, template.content);
}
