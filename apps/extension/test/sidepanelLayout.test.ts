import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function sidepanelStyles(): Promise<string> {
  const html = await readFile(new URL("../public/sidepanel.html", import.meta.url), "utf8");
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
