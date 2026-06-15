// Bundles the extension's TypeScript entry points into loadable browser scripts
// and copies the static assets (manifest, side panel HTML) alongside them.
//
// Output: dist/{background,content,sidepanel}.js + manifest.json + sidepanel.html
// Load dist/ as an unpacked extension (chrome://extensions → Load unpacked).
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const outdir = join(root, "dist");

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: {
    background: join(root, "src/background.ts"),
    content: join(root, "src/content.ts"),
    sidepanel: join(root, "src/sidepanel.ts"),
  },
  outdir,
  bundle: true,
  // Classic scripts, not ES modules: a content script injected via files[] runs
  // as a classic script, so keep every entry consistent.
  format: "iife",
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  logLevel: "info",
});

await cp(join(root, "manifest.json"), join(outdir, "manifest.json"));
await cp(join(root, "public", "sidepanel.html"), join(outdir, "sidepanel.html"));

console.log("Built ForumForge extension → dist/");
