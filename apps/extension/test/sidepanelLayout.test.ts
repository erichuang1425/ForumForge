import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

async function sidepanelHtml(): Promise<string> {
  return readFile(new URL("../public/sidepanel.html", import.meta.url), "utf8");
}

async function sidepanelStyles(): Promise<string> {
  const html = await sidepanelHtml();
  const styles = html.match(/<style>([\s\S]*?)<\/style>/u)?.[1];
  if (styles === undefined) throw new Error("side-panel styles are missing");
  return styles;
}

function rule(styles: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const declarations = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"))?.[1];
  if (declarations === undefined) throw new Error(`missing CSS rule: ${selector}`);
  return declarations;
}

describe("side-panel zoom reflow", () => {
  it("lets primary and per-post controls wrap without horizontal overflow", async () => {
    const styles = await sidepanelStyles();

    expect(rule(styles, ".ff-bar")).toMatch(/flex-wrap:\s*wrap/u);
    expect(rule(styles, ".ff-post__meta")).toMatch(/flex-wrap:\s*wrap/u);

    for (const selector of ["#ff-extract", "#ff-export", "#ff-clear-data"]) {
      expect(rule(styles, selector)).toMatch(/max-width:\s*100%/u);
      expect(rule(styles, selector)).toMatch(/white-space:\s*normal/u);
    }
  });
});

describe("side-panel visual structure", () => {
  it("provides branded, status, welcome, action, and local-data regions", async () => {
    const { document } = parseHTML(await sidepanelHtml());

    expect(document.querySelector(".ff-brand-mark")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector(".ff-actions #ff-extract")).not.toBeNull();
    expect(document.querySelector(".ff-status-card #ff-status[role='status']")).not.toBeNull();
    expect(document.querySelector("main #ff-output .ff-welcome")).not.toBeNull();
    expect(document.querySelector(".ff-local-data__badge")?.textContent).toContain("Private");
  });

  it("defines explicit dark colors and a visible keyboard focus treatment", async () => {
    const styles = await sidepanelStyles();

    expect(styles).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/u);
    expect(styles).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px/u);
    expect(rule(styles, ".ff-post")).toMatch(/border-radius:/u);
    expect(rule(styles, ".ff-welcome")).toMatch(/background:/u);
  });
});
