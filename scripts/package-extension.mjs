import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "apps", "extension", "dist");
const artifacts = join(root, "artifacts");
const files = ["background.js", "content.js", "manifest.json", "sidepanel.html", "sidepanel.js"];

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, data) {
  const encoded = Buffer.from(name);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x5c21, 12);
  header.writeUInt32LE(crc32(data), 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(encoded.length, 26);
  return Buffer.concat([header, encoded, data]);
}

function centralHeader(name, data, offset) {
  const encoded = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x5c21, 14);
  header.writeUInt32LE(crc32(data), 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(encoded.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, encoded]);
}

const records = await Promise.all(
  files.map(async (name) => ({ name, data: await readFile(join(dist, name)) })),
);
const manifest = JSON.parse(records.find(({ name }) => name === "manifest.json").data.toString());
const archiveName = `forumforge-${manifest.version}-chrome.zip`;

const locals = [];
const centrals = [];
let offset = 0;
for (const record of records) {
  const local = localHeader(record.name, record.data);
  locals.push(local);
  centrals.push(centralHeader(record.name, record.data, offset));
  offset += local.length;
}
const centralDirectory = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(records.length, 8);
end.writeUInt16LE(records.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);

const archive = Buffer.concat([...locals, centralDirectory, end]);
const digest = createHash("sha256").update(archive).digest("hex");
await mkdir(artifacts, { recursive: true });
const archivePath = join(artifacts, archiveName);
await writeFile(archivePath, archive);
await writeFile(`${archivePath}.sha256`, `${digest}  ${basename(archivePath)}\n`);

console.log(`Packaged ${archiveName}`);
console.log(`SHA-256 ${digest}`);
