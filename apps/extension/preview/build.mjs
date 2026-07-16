// Builds an offline visual-review page around the real on-page reader.
// Output is ignored under tmp/ and never enters the extension package.
import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(previewRoot, "..", "..", "..");
const outdir = join(repositoryRoot, "tmp", "reader-preview");

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [join(previewRoot, "preview.ts")],
  outfile: join(outdir, "preview.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome116"],
  sourcemap: true,
  logLevel: "info",
});
await copyFile(join(previewRoot, "index.html"), join(outdir, "index.html"));

console.log(`Built offline reader preview → ${outdir}`);
