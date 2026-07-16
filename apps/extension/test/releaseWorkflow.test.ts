import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release workflow packaging", () => {
  it("runs the release build before the deterministic ZIP writer", async () => {
    const workflow = await readFile(
      new URL("../../../.github/workflows/release.yml", import.meta.url),
      "utf8",
    );
    const rootPackage = JSON.parse(
      await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(rootPackage.scripts?.["package:extension"]).toContain("build:release");
    expect(workflow).toMatch(/- name: Package extension\s+run: pnpm package:extension/u);
    expect(workflow).not.toMatch(/run:\s*node scripts\/package-extension\.mjs/u);
  });
});
