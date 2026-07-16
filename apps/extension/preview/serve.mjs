// Serves only the generated offline preview on the loopback interface.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const previewRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(previewRoot, "..", "..", "..");
const outputRoot = join(repositoryRoot, "tmp", "reader-preview");
const port = Number.parseInt(process.argv[2] ?? "47831", 10);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  throw new Error("Preview port must be an integer from 1024 through 65535");
}

const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/preview.js", ["preview.js", "text/javascript; charset=utf-8"]],
  ["/preview.js.map", ["preview.js.map", "application/json; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const asset = assets.get(pathname);
  if (!asset) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const [file, contentType] = asset;
    const body = await readFile(join(outputRoot, file));
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; connect-src 'none'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; style-src 'unsafe-inline'",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
  } catch {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Run pnpm preview:build before starting the preview server.");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ForumForge preview available at http://127.0.0.1:${port}/`);
});
