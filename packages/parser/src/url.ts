/** Resolve a possibly-relative URL against a base, when one is known; otherwise return it as-is. */
export function resolveUrl(href: string, baseUrl?: string): string {
  const trimmed = href.trim();
  if (!baseUrl) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

/**
 * The base URL to resolve relative links against when the caller passes none.
 * On a live page `getAttribute("href")` returns the raw, possibly-relative
 * attribute (only properties like `HTMLAnchorElement.href` are auto-resolved),
 * so we fall back to the document's own base URI. Detached documents report
 * "about:blank"; treat that as "no base" rather than resolving against it.
 */
export function documentBaseUrl(root: ParentNode): string | undefined {
  const base = (root as { baseURI?: unknown }).baseURI;
  if (typeof base !== "string" || !base || base === "about:blank") return undefined;
  return base;
}
