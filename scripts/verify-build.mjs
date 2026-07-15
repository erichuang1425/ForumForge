import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extension = join(root, "apps", "extension");
const dist = join(extension, "dist");
const expected = new Set([
  "background.js",
  "background.js.map",
  "content.js",
  "content.js.map",
  "manifest.json",
  "sidepanel.html",
  "sidepanel.js",
  "sidepanel.js.map",
]);

const actual = new Set(await readdir(dist));
const missing = [...expected].filter((file) => !actual.has(file));
const unexpected = [...actual].filter((file) => !expected.has(file));
if (missing.length || unexpected.length) {
  throw new Error(
    `Unexpected extension build contents. Missing: ${missing.join(", ") || "none"}; extra: ${unexpected.join(", ") || "none"}`,
  );
}

for (const file of expected) {
  const info = await stat(join(dist, file));
  if (!info.isFile() || info.size === 0) throw new Error(`Build output is empty: ${file}`);
}

const sourceManifest = JSON.parse(await readFile(join(extension, "manifest.json"), "utf8"));
const builtManifest = JSON.parse(await readFile(join(dist, "manifest.json"), "utf8"));
if (JSON.stringify(sourceManifest) !== JSON.stringify(builtManifest)) {
  throw new Error("Built manifest differs from apps/extension/manifest.json");
}

console.log("Extension build contains the expected files and manifest.");
