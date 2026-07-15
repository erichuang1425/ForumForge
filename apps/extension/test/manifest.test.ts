import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(new URL("../manifest.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

describe("extension manifest policy", () => {
  it("uses the reviewed least-privilege permission set", () => {
    expect(manifest.permissions).toEqual([
      "activeTab",
      "scripting",
      "sidePanel",
      "storage",
    ]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest).not.toHaveProperty("optional_host_permissions");
    expect(manifest).not.toHaveProperty("content_scripts");
    expect(manifest).not.toHaveProperty("externally_connectable");
  });

  it("declares the browser floor required by the side panel API", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe("116");
  });
});
