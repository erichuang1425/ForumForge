import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { sanitizeFragment, sanitizeHtml } from "../src/sanitize";

/** A fresh, empty document the sanitizer can create clean nodes in. */
function freshDocument(): Document {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  return document as unknown as Document;
}

/**
 * Sanitize an HTML string and return both the serialized result and a host
 * element holding the sanitized nodes. (Appending a fragment empties it, so the
 * host — not the fragment — is what we query in assertions.)
 */
function clean(html: string, baseUrl?: string): { html: string; root: HTMLElement } {
  const doc = freshDocument();
  const root = doc.createElement("div");
  root.append(sanitizeHtml(doc, html, baseUrl));
  return { html: root.innerHTML, root };
}

describe("sanitizeHtml", () => {
  it("keeps allowlisted semantic markup", () => {
    const { html } = clean(
      "<p>Hello <strong>world</strong> and <em>others</em>.</p>" +
        "<ul><li>one</li><li>two</li></ul>" +
        "<blockquote>quoted</blockquote><pre><code>code()</code></pre>",
    );
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("<em>others</em>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<blockquote>quoted</blockquote>");
    expect(html).toContain("<pre><code>code()</code></pre>");
  });

  it("drops <script> and its source text entirely", () => {
    const { html } = clean("<p>before</p><script>alert('xss')</script><p>after</p>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
    expect(html).toBe("<p>before</p><p>after</p>");
  });

  it("drops <style> and its contents", () => {
    const { html } = clean("<style>body{display:none}</style><p>visible</p>");
    expect(html).toBe("<p>visible</p>");
  });

  it("drops images so no third-party request is made", () => {
    const { html, root } = clean('<p>text</p><img src="https://evil.example/track.gif">');
    expect(root.querySelector("img") ?? null).toBeNull();
    expect(html).not.toContain("img");
  });

  it("strips inline event handlers, leaving only the safe element", () => {
    const { html } = clean('<p onclick="steal()">click me</p>');
    expect(html).not.toContain("onclick");
    expect(html).toBe("<p>click me</p>");
  });

  it("strips style, class and id attributes", () => {
    const { html } = clean('<p class="x" id="y" style="position:fixed">hi</p>');
    expect(html).toBe("<p>hi</p>");
  });

  it("keeps http(s) and mailto links and hardens them", () => {
    const { root } = clean('<a href="https://example.com/page">link</a>');
    const anchor = root.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com/page");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
  });

  it("drops dangerous URL schemes but keeps the link text", () => {
    for (const href of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "  javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "/relative/path",
      "//protocol-relative.example",
    ]) {
      const { root } = clean(`<a href="${href}">text</a>`);
      const anchor = root.querySelector("a");
      expect(anchor, href).not.toBeNull();
      expect(anchor?.hasAttribute("href"), href).toBe(false);
      expect(anchor?.textContent, href).toBe("text");
    }
  });

  it("rejects hrefs that smuggle a scheme past with control characters", () => {
    const { root } = clean('<a href="java\tscript:alert(1)">text</a>');
    expect(root.querySelector("a")?.hasAttribute("href")).toBe(false);
  });

  it("resolves relative and fragment links against a base URL", () => {
    const base = "https://forum.example.com/thread/5";
    expect(
      clean('<a href="/thread/9#post-2">x</a>', base).root.querySelector("a")?.getAttribute("href"),
    ).toBe("https://forum.example.com/thread/9#post-2");
    expect(
      clean('<a href="#post-3">x</a>', base).root.querySelector("a")?.getAttribute("href"),
    ).toBe("https://forum.example.com/thread/5#post-3");
  });

  it("keeps the scheme allowlist after resolving against a base", () => {
    // A javascript: href stays javascript: after URL resolution, so it is still dropped.
    const { root } = clean('<a href="javascript:alert(1)">x</a>', "https://forum.example.com/t");
    expect(root.querySelector("a")?.hasAttribute("href")).toBe(false);
  });

  it("still drops relative links when no base URL is known", () => {
    const { root } = clean('<a href="/thread/9">x</a>');
    const anchor = root.querySelector("a");
    expect(anchor?.hasAttribute("href")).toBe(false);
    expect(anchor?.textContent).toBe("x");
  });

  it("unwraps unknown layout wrappers but keeps their sanitized children", () => {
    const { html } = clean(
      '<div class="wrap"><section><font color="red">kept</font></section></div>',
    );
    expect(html).toBe("kept");
  });

  it("sanitizes deeply nested malicious content", () => {
    const { html } = clean(
      '<blockquote><div><img src=x onerror=alert(1)>' +
        '<a href="javascript:alert(2)">x</a><script>alert(3)</script></div></blockquote>',
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript");
    expect(html).not.toContain("img");
    expect(html).toContain("<blockquote>");
    expect(html).toContain(">x</a>");
  });

  it("preserves text content as inert text", () => {
    const { html } = clean("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2</p>");
    expect(html).toBe("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2</p>");
  });
});

describe("sanitizeFragment", () => {
  it("works on an already-parsed source tree", () => {
    const doc = freshDocument();
    const source = doc.createElement("div");
    source.append(doc.createElement("p"));
    source.querySelector("p")!.textContent = "parsed";
    const out = doc.createElement("div");
    out.append(sanitizeFragment(doc, source));
    expect(out.innerHTML).toBe("<p>parsed</p>");
  });
});
