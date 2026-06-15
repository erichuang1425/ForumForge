/** Small, pure text utilities for producing clean model fields. No DOM here. */

/** Collapse all runs of whitespace (including newlines) into single spaces, then trim. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Clean a multi-line text body for storage in the model: normalize newlines,
 * collapse inline whitespace, trim spaces around line breaks, and cap blank-line
 * runs at one. Paragraph breaks are preserved; incidental noise is removed.
 */
export function cleanText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/\r\n?/g, "\n") // normalize newlines
    .replace(/[ \t]+/g, " ") // collapse inline whitespace
    .replace(/ *\n */g, "\n") // trim spaces around line breaks
    .replace(/\n{3,}/g, "\n\n") // cap blank-line runs at one
    .trim();
}

/** De-duplicate and trim links, preserving first-seen order and dropping empties. */
export function dedupeLinks(links: readonly string[] | undefined): string[] {
  if (!links || links.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of links) {
    const link = raw?.trim();
    if (!link || seen.has(link)) continue;
    seen.add(link);
    out.push(link);
  }
  return out;
}
