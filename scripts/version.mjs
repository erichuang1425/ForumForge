import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const targets = [
  { path: join(root, "package.json"), label: "root package" },
  { path: join(root, "apps", "extension", "package.json"), label: "extension package" },
  { path: join(root, "apps", "extension", "manifest.json"), label: "extension manifest" },
];
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function isValidVersion(value) {
  return (
    typeof value === "string" &&
    versionPattern.test(value) &&
    value.split(".").every((part) => Number(part) <= 65535)
  );
}

async function readTargets() {
  return Promise.all(
    targets.map(async (target) => ({
      ...target,
      json: JSON.parse(await readFile(target.path, "utf8")),
    })),
  );
}

async function check(expectedInput) {
  const records = await readTargets();
  const versions = new Set(records.map(({ json }) => json.version));
  if (versions.size !== 1) {
    const details = records.map(({ label, json }) => `${label}: ${json.version}`).join("\n");
    throw new Error(`ForumForge versions are out of sync:\n${details}`);
  }

  const version = records[0].json.version;
  if (!isValidVersion(version)) {
    throw new Error(`Invalid Chrome/package version: ${version}`);
  }

  const expected = expectedInput?.replace(/^v/, "");
  if (expected && version !== expected) {
    throw new Error(`Version ${version} does not match expected ${expected}`);
  }
  console.log(`ForumForge version ${version} is synchronized.`);
}

async function setVersion(version) {
  if (!isValidVersion(version)) {
    throw new Error("Usage: pnpm version:set <major.minor.patch> (each part 0–65535)");
  }

  const records = await readTargets();
  await Promise.all(
    records.map(async ({ path, json }) => {
      json.version = version;
      await writeFile(path, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    }),
  );
  await check(version);
}

const [command = "check", value] = process.argv.slice(2);
if (command === "check") {
  await check(value);
} else if (command === "set") {
  await setVersion(value);
} else {
  throw new Error("Usage: node scripts/version.mjs <check [expected]|set <version>>");
}
