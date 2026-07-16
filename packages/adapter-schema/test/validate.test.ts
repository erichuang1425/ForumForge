import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ADAPTER_VALIDATION_LIMITS,
  parseAdapterJson,
  validateAdapter,
  type AdapterValidationErrorCode,
  type AdapterValidationResult,
  type ForumForgeAdapterV1,
} from "../src/index";

function makeAdapter(): ForumForgeAdapterV1 {
  return {
    schemaVersion: 1,
    id: "example-forum",
    name: "Example Forum",
    matches: [{ origin: "https://forum.example.test", pathname: "/threads/*" }],
    detect: ["h1.thread-title", ".post[data-post-id]"],
    layout: "linear",
    thread: {
      title: { selector: "h1.thread-title", source: "text" },
    },
    posts: {
      selector: ".post[data-post-id]",
      fields: {
        id: { source: "attribute", attribute: "data-post-id" },
        author: { selector: ".username", source: "text" },
        content: { selector: ".post-body", source: "html" },
        timestamp: { selector: "time", source: "attribute", attribute: "datetime" },
        permalink: { selector: ".post-number > a", source: "attribute", attribute: "href" },
      },
    },
  };
}

function expectError(
  result: AdapterValidationResult,
  path: string,
  code: AdapterValidationErrorCode,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected adapter validation to fail.");
  expect(result.errors).toContainEqual(expect.objectContaining({ path, code }));
}

describe("adapter v1 validator", () => {
  it("returns a detached adapter for valid data", () => {
    const input = makeAdapter();
    const result = validateAdapter(input);

    expect(result).toEqual({ ok: true, value: input });
    if (!result.ok) throw new Error("Expected adapter validation to pass.");
    expect(result.value).not.toBe(input);
    expect(result.value.posts).not.toBe(input.posts);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.matches)).toBe(true);
    expect(Object.isFrozen(result.value.posts.fields.content)).toBe(true);
  });

  it("parses valid bounded JSON before validating it", () => {
    const adapter = makeAdapter();
    adapter.name = 'Example "{[\\ Forum';
    const result = parseAdapterJson(JSON.stringify(adapter));

    expect(result.ok).toBe(true);
  });

  it("accepts the checked-in offline-safe adapter example", async () => {
    const source = await readFile(
      new URL("./fixtures/example.adapter.json", import.meta.url),
      "utf8",
    );

    expect(parseAdapterJson(source).ok).toBe(true);
  });

  it("rejects duplicate JSON properties before the last value can win", () => {
    const source = JSON.stringify(makeAdapter()).replace(
      '"schemaVersion":1',
      '"schemaVersion":2,"schema\\u0056ersion":1',
    );

    expectError(parseAdapterJson(source), "$.schemaVersion", "duplicate");
  });

  it("reports missing and unknown fields at stable JSON-style paths", () => {
    const input = makeAdapter() as unknown as Record<string, unknown>;
    delete input.name;
    input.script = "alert(1)";

    const result = validateAdapter(input);

    expectError(result, "$.name", "required");
    expectError(result, "$.script", "unknown-property");
  });

  it("fails closed for missing, malformed, and newer schema versions", () => {
    const missing = makeAdapter() as unknown as Record<string, unknown>;
    delete missing.schemaVersion;
    expectError(validateAdapter(missing), "$.schemaVersion", "required");

    const malformed = makeAdapter() as unknown as Record<string, unknown>;
    malformed.schemaVersion = "1";
    expectError(validateAdapter(malformed), "$.schemaVersion", "type");

    const newer = makeAdapter() as unknown as Record<string, unknown>;
    newer.schemaVersion = 2;
    expectError(validateAdapter(newer), "$.schemaVersion", "unsupported-version");
  });

  it("bounds UTF-8 input, nesting, and parse failures without echoing input", () => {
    expectError(parseAdapterJson("{not-json}"), "$", "invalid-json");
    expectError(
      parseAdapterJson(`${"[".repeat(ADAPTER_VALIDATION_LIMITS.jsonNesting + 1)}0${"]".repeat(ADAPTER_VALIDATION_LIMITS.jsonNesting + 1)}`),
      "$",
      "limit",
    );

    const multibyte = JSON.stringify({ value: "界".repeat(22_000) });
    expect(new TextEncoder().encode(multibyte).byteLength).toBeGreaterThan(
      ADAPTER_VALIDATION_LIMITS.utf8JsonBytes,
    );
    expectError(parseAdapterJson(multibyte), "$", "input-too-large");
  });

  it.each([
    "https://user:pass@example.com",
    "https://example.com:443",
    "https://example.com/",
    "ftp://example.com",
    "https://example.com/path",
    "HTTPS://EXAMPLE.COM",
  ])("rejects noncanonical or unsafe origin %s", (origin) => {
    const input = makeAdapter();
    input.matches[0]!.origin = origin;

    expectError(validateAdapter(input), "$.matches[0].origin", "format");
  });

  it("accepts a canonical non-default port", () => {
    const input = makeAdapter();
    input.matches[0]!.origin = "https://example.com:8443";

    expect(validateAdapter(input).ok).toBe(true);
  });

  it("bounds pathname globs and rejects normalized duplicates", () => {
    const tooMany = makeAdapter();
    tooMany.matches[0]!.pathname = `/${"a*".repeat(ADAPTER_VALIDATION_LIMITS.pathnameWildcards + 1)}`;
    expectError(validateAdapter(tooMany), "$.matches[0].pathname", "limit");

    const adjacent = makeAdapter();
    adjacent.matches[0]!.pathname = "/threads/**";
    expectError(validateAdapter(adjacent), "$.matches[0].pathname", "format");

    const duplicate = makeAdapter();
    duplicate.matches.push({ ...duplicate.matches[0]! });
    expectError(validateAdapter(duplicate), "$.matches[1]", "duplicate");
  });

  it.each([
    "/게시판/*",
    "/threads/a b",
    "/threads/%ed%95%9c",
    "/threads/%E0%A4",
    "/threads/%GG",
    "/threads/%41",
    "/threads/%2E%2E/post",
    "/threads/%2Fpost",
    "/threads/%5Cpost",
    "/threads/../post",
  ])("rejects noncanonical serialized pathname %s", (pathname) => {
    const input = makeAdapter();
    input.matches[0]!.pathname = pathname;

    expectError(validateAdapter(input), "$.matches[0].pathname", "format");
  });

  it("accepts uppercase UTF-8 and required ASCII path escapes", () => {
    const input = makeAdapter();
    input.matches[0]!.pathname = "/%ED%95%9C%EA%B5%AD/%20topic/%3F/*";

    expect(validateAdapter(input).ok).toBe(true);
  });

  it.each([
    ".post:HAS(span)",
    ".post:h\\61s(span)",
    ".post, .comment",
    ".post:not(:not(:not(.item)))",
    ".post + .post",
    ".post[onclick]",
    ".post]",
  ])("rejects selector grammar escape %s", (selector) => {
    const input = makeAdapter();
    input.posts.selector = selector;

    expectError(validateAdapter(input), "$.posts.selector", "format");
  });

  it("bounds selector complexity and detects whitespace-normalized duplicates", () => {
    const complex = makeAdapter();
    complex.posts.selector = Array.from(
      { length: ADAPTER_VALIDATION_LIMITS.selectorCompounds + 1 },
      () => "div",
    ).join(" ");
    expectError(validateAdapter(complex), "$.posts.selector", "format");

    const duplicate = makeAdapter();
    duplicate.detect = [".thread   >   .post", ".thread>.post"];
    expectError(validateAdapter(duplicate), "$.detect[1]", "duplicate");
  });

  it("requires an explicit thread-title selector", () => {
    const input = makeAdapter();
    input.thread.title = { source: "text" } as ForumForgeAdapterV1["thread"]["title"];

    expectError(validateAdapter(input), "$.thread.title.selector", "required");
  });

  it("allows read attributes only for their reviewed destinations", () => {
    const unsafeName = makeAdapter();
    unsafeName.posts.fields.id = { source: "attribute", attribute: "onclick" } as never;
    expectError(validateAdapter(unsafeName), "$.posts.fields.id.attribute", "not-allowed");

    const wrongDestination = makeAdapter();
    wrongDestination.posts.fields.author = { source: "attribute", attribute: "href" } as never;
    expectError(
      validateAdapter(wrongDestination),
      "$.posts.fields.author.attribute",
      "not-allowed",
    );

    const htmlMetadata = makeAdapter();
    htmlMetadata.posts.fields.author = { source: "html" } as never;
    expectError(validateAdapter(htmlMetadata), "$.posts.fields.author.source", "not-allowed");
  });

  it("rejects non-JSON objects, accessors, and sparse arrays", () => {
    const inherited = Object.assign(Object.create({ inherited: true }), makeAdapter());
    expectError(validateAdapter(inherited), "$", "non-json-value");

    let getterRan = false;
    const accessor = makeAdapter() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "name", {
      enumerable: true,
      get() {
        getterRan = true;
        return "Example";
      },
    });
    expectError(validateAdapter(accessor), "$.name", "non-json-value");
    expect(getterRan).toBe(false);

    const sparse = makeAdapter();
    sparse.detect = new Array(1) as string[];
    expectError(validateAdapter(sparse), "$.detect[0]", "non-json-value");
  });

  it("contains throwing reflection traps and oversized structured input", () => {
    const throwing = new Proxy(makeAdapter(), {
      getPrototypeOf() {
        throw new Error("hostile trap");
      },
    });
    expectError(validateAdapter(throwing), "$", "non-json-value");

    const oversized = makeAdapter() as unknown as Record<string, unknown>;
    for (let index = 0; index < ADAPTER_VALIDATION_LIMITS.structuredEntries + 1; index += 1) {
      oversized[`field-${index}`] = index;
    }
    expectError(validateAdapter(oversized), "$", "limit");
  });

  it("caps actionable errors at a deterministic budget", () => {
    const input = makeAdapter() as unknown as Record<string, unknown>;
    for (let index = 0; index < 100; index += 1) input[`unknown-${index}`] = true;

    const result = validateAdapter(input);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected adapter validation to fail.");
    expect(result.errors).toHaveLength(ADAPTER_VALIDATION_LIMITS.validationErrors);
    expect(result.errors.at(-1)).toMatchObject({ path: "$", code: "error-limit" });
  });
});
