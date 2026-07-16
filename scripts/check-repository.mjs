import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

async function filesUnder(directory, predicate = () => true) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if ([".git", "node_modules", "dist", "artifacts"].includes(entry.name)) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (predicate(path)) files.push(path);
    }
  }
  await visit(directory);
  return files;
}

async function checkManifestBoundary() {
  const path = join(root, "apps", "extension", "manifest.json");
  const manifest = JSON.parse(await readFile(path, "utf8"));
  const expected = ["activeTab", "scripting", "sidePanel", "storage"];
  const actual = [...(manifest.permissions ?? [])].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`manifest permissions changed: expected ${expected.join(", ")}, got ${actual.join(", ")}`);
  }
  for (const key of [
    "host_permissions",
    "optional_host_permissions",
    "content_scripts",
    "externally_connectable",
  ]) {
    if (key in manifest) fail(`manifest must not declare ${key} without an approved policy change`);
  }
  if (manifest.minimum_chrome_version !== "116") {
    fail("manifest minimum_chrome_version must remain 116 until compatibility is retested");
  }
}

async function checkNetworkBoundary() {
  const sourceRoots = [
    join(root, "apps", "extension", "src"),
    join(root, "apps", "extension", "preview"),
    join(root, "packages", "core", "src"),
    join(root, "packages", "parser", "src"),
    join(root, "packages", "storage", "src"),
  ];
  const forbidden = [
    { name: "fetch", pattern: /\bfetch\s*\(/ },
    { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
    { name: "WebSocket", pattern: /\bWebSocket\b/ },
    { name: "EventSource", pattern: /\bEventSource\b/ },
    { name: "sendBeacon", pattern: /\bsendBeacon\s*\(/ },
    { name: "eval", pattern: /\beval\s*\(/ },
    { name: "Function constructor", pattern: /\bnew\s+Function\s*\(/ },
  ];
  for (const sourceRoot of sourceRoots) {
    for (const path of await filesUnder(sourceRoot, (file) => extname(file) === ".ts")) {
      const source = await readFile(path, "utf8");
      for (const rule of forbidden) {
        if (rule.pattern.test(source)) {
          fail(`${relative(root, path)} uses ${rule.name}; document and approve any remote/code-execution boundary first`);
        }
      }
    }
  }
}

async function checkPreviewBoundary() {
  const path = join(root, "apps", "extension", "preview", "index.html");
  const html = await readFile(path, "utf8");
  const remoteResource =
    /<(?:img|script|iframe|link|source|audio|video)\b[^>]*(?:src|srcset|href)\s*=\s*["']?\s*(?:https?:)?\/\//i;
  const inlineHandler = /\son[a-z]+\s*=/i;
  const activeEmbed = /<(?:iframe|frame|object|embed|applet)\b/i;
  if (remoteResource.test(html)) fail("reader preview can load a remote resource");
  if (inlineHandler.test(html)) fail("reader preview must not use inline event handlers");
  if (activeEmbed.test(html)) fail("reader preview must not contain active embeds");
}

async function checkFixtures() {
  const fixtureRoot = join(root, "packages", "parser", "test", "fixtures");
  const activeElement = /<(?:script|iframe|frame|object|embed|applet)\b/i;
  const remoteResource =
    /<(?:img|script|iframe|link|source|audio|video)\b[^>]*(?:src|srcset|href)\s*=\s*["']?\s*https?:/i;
  for (const path of await filesUnder(fixtureRoot, (file) => extname(file) === ".html")) {
    const html = await readFile(path, "utf8");
    if (activeElement.test(html)) fail(`${relative(root, path)} contains active embedded content`);
    if (remoteResource.test(html)) fail(`${relative(root, path)} can load a remote resource`);
  }
}

async function checkStorageBoundary() {
  const sourceRoot = join(root, "apps", "extension", "src");
  const forbidden = [
    {
      name: "chrome.storage.local.clear()",
      pattern: /\bchrome\.storage\.local\.clear\s*\(/,
      reason: "bulk deletion must use the reviewed ForumForge key allowlist",
    },
    {
      name: "chrome.storage.sync",
      pattern: /\bchrome\.storage\.sync\b/,
      reason: "local data must remain on-device unless an explicit product review approves sync",
    },
  ];
  for (const path of await filesUnder(sourceRoot, (file) => extname(file) === ".ts")) {
    const source = await readFile(path, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        fail(`${relative(root, path)} uses ${rule.name}; ${rule.reason}`);
      }
    }
  }
}

async function checkMarkdownLinks() {
  const markdownFiles = await filesUnder(root, (file) => extname(file) === ".md");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
  for (const path of markdownFiles) {
    const markdown = await readFile(path, "utf8");
    for (const match of markdown.matchAll(linkPattern)) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
      target = target.split(/\s+["']/)[0];
      if (
        !target ||
        target.startsWith("#") ||
        /^(?:https?:|mailto:|data:)/i.test(target)
      ) {
        continue;
      }
      target = target.split("#")[0].split("?")[0];
      try {
        target = decodeURIComponent(target);
      } catch {
        fail(`${relative(root, path)} has an invalid encoded link: ${match[1]}`);
        continue;
      }
      const linkedPath = resolve(dirname(path), target);
      if (linkedPath !== root && !linkedPath.startsWith(`${root}${sep}`)) {
        fail(`${relative(root, path)} links outside the repository: ${match[1]}`);
        continue;
      }
      try {
        await access(linkedPath);
        await stat(linkedPath);
      } catch {
        fail(`${relative(root, path)} has a broken local link: ${match[1]}`);
      }
    }
  }
}

await checkManifestBoundary();
await checkNetworkBoundary();
await checkStorageBoundary();
await checkFixtures();
await checkPreviewBoundary();
await checkMarkdownLinks();

if (failures.length > 0) {
  console.error("Repository checks failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log("Repository boundaries and documentation links are valid.");
}
