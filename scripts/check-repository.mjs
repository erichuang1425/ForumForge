import { access, readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { build as buildWithEsbuild } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];
let adapterParserPromise;

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

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadAdapterParser() {
  adapterParserPromise ??= (async () => {
    const result = await buildWithEsbuild({
      entryPoints: [join(root, "packages", "adapter-schema", "src", "index.ts")],
      bundle: true,
      format: "esm",
      logLevel: "silent",
      platform: "node",
      target: "node22",
      write: false,
    });
    const output = result.outputFiles[0];
    if (output === undefined) throw new Error("adapter validator bundle produced no output");
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.contents).toString("base64")}`;
    const module = await import(moduleUrl);
    return module.parseAdapterJson;
  })();
  return adapterParserPromise;
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
    join(root, "packages", "adapter-schema", "src"),
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

async function checkAdapterSchemaBoundary() {
  const packageRoot = join(root, "packages", "adapter-schema");
  const sourceRoot = join(packageRoot, "src");
  const schemaPath = join(packageRoot, "schema", "adapter-v1.schema.json");
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const forbiddenProperties = new Set([
    "actions",
    "code",
    "expression",
    "function",
    "headers",
    "module",
    "observer",
    "pagination",
    "regex",
    "remote",
    "request",
    "script",
    "template",
    "transform",
    "url",
  ]);

  function inspectSchema(value, path = "$") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspectSchema(item, `${path}[${index}]`));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    if (value.type === "object" && value.additionalProperties !== false) {
      fail(`adapter schema object ${path} must set additionalProperties to false`);
    }
    if (typeof value.properties === "object" && value.properties !== null) {
      for (const property of Object.keys(value.properties)) {
        if (forbiddenProperties.has(property)) {
          fail(`adapter schema exposes forbidden executable/network property '${property}' at ${path}`);
        }
      }
    }
    for (const [key, nested] of Object.entries(value)) inspectSchema(nested, `${path}.${key}`);
  }
  inspectSchema(schema);

  if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
    fail("adapter schema must remain explicit Draft 2020-12 JSON Schema");
  }
  if (schema.$id !== "urn:forumforge:adapter:1") {
    fail("adapter schema ID or version changed without updating the repository boundary");
  }

  const forbiddenRuntime = [
    { name: "Chrome API", pattern: /\bchrome\s*\./ },
    { name: "browser extension API", pattern: /\bbrowser\s*\./ },
    { name: "global document", pattern: /\bdocument\b/ },
    { name: "global window", pattern: /\bwindow\b/ },
    { name: "global location", pattern: /\blocation\b/ },
    { name: "global navigator", pattern: /\bnavigator\b/ },
    { name: "localStorage", pattern: /\blocalStorage\b/ },
    { name: "sessionStorage", pattern: /\bsessionStorage\b/ },
    { name: "IndexedDB", pattern: /\bindexedDB\b/ },
    { name: "dynamic import", pattern: /\bimport\s*\(/ },
  ];
  for (const path of await filesUnder(sourceRoot, (file) => extname(file) === ".ts")) {
    const source = await readFile(path, "utf8");
    for (const rule of forbiddenRuntime) {
      if (rule.pattern.test(source)) {
        fail(`${relative(root, path)} uses ${rule.name}; adapter foundations must receive bounded data explicitly`);
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
  const fixtureRoots = [
    join(root, "packages", "parser", "test", "fixtures"),
    join(root, "packages", "adapter-schema", "test", "fixtures"),
    join(root, "adapters"),
    join(root, "examples"),
  ];
  const activeElement = /<(?:script|iframe|frame|object|embed|applet)\b/i;
  const remoteResource =
    /<(?:img|script|iframe|link|source|audio|video)\b[^>]*(?:src|srcset|href)\s*=\s*["']?\s*https?:/i;
  const forbiddenAdapterKeys = new Set([
    "actions",
    "code",
    "expression",
    "function",
    "headers",
    "module",
    "observer",
    "pagination",
    "regex",
    "remote",
    "request",
    "script",
    "template",
    "transform",
    "url",
  ]);

  function inspectAdapterJson(value, path, jsonPath = "$") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspectAdapterJson(item, path, `${jsonPath}[${index}]`));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, nested] of Object.entries(value)) {
      if (forbiddenAdapterKeys.has(key)) {
        fail(`${relative(root, path)} contains forbidden adapter key '${key}' at ${jsonPath}`);
      }
      inspectAdapterJson(nested, path, `${jsonPath}.${key}`);
    }
  }

  for (const fixtureRoot of fixtureRoots) {
    if (!(await pathExists(fixtureRoot))) continue;
    for (const path of await filesUnder(fixtureRoot, (file) => (
      extname(file) === ".html" ||
      file.endsWith(".adapter.json")
    ))) {
      if (extname(path) === ".html") {
        const html = await readFile(path, "utf8");
        if (activeElement.test(html)) fail(`${relative(root, path)} contains active embedded content`);
        if (remoteResource.test(html)) fail(`${relative(root, path)} can load a remote resource`);
      } else {
        const source = await readFile(path, "utf8");
        let result;
        try {
          const parseAdapterJson = await loadAdapterParser();
          result = parseAdapterJson(source);
        } catch {
          fail(`${relative(root, path)} could not run production adapter validation`);
          continue;
        }
        if (!result.ok) {
          const details = result.errors
            .slice(0, 3)
            .map((error) => `${error.path} (${error.code})`)
            .join(", ");
          fail(`${relative(root, path)} fails production adapter validation: ${details}`);
          continue;
        }
        inspectAdapterJson(JSON.parse(source), path);
      }
    }
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
await checkAdapterSchemaBoundary();
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
