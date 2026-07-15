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

  it("declares complete PNG icon sets backed by correctly sized files", () => {
    const expected = {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    };
    expect(manifest.icons).toEqual(expected);
    expect((manifest.action as Record<string, unknown>).default_icon).toEqual(expected);

    for (const [declaredSize, path] of Object.entries(expected)) {
      const png = readFileSync(new URL(`../public/${path}`, import.meta.url));
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(png.readUInt32BE(16)).toBe(Number(declaredSize));
      expect(png.readUInt32BE(20)).toBe(Number(declaredSize));
    }
  });
});
