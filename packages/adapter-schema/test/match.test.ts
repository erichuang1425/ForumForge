import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  ADAPTER_MATCH_LIMITS,
  EMPTY_BUNDLED_ADAPTER_CATALOG,
  matchesPathnameGlob,
  selectAdapterForPage,
  validateAdapter,
  type AdapterDetectionRoot,
  type AdapterRegistryV1,
  type BundledAdapterCatalogV1,
  type ForumForgeAdapterV1,
  type ValidatedForumForgeAdapterV1,
} from "../src/index";
import { createBundledAdapterCatalog } from "../src/provenance";

function makeAdapter(
  id: string,
  pathname = "/threads/*",
  detect: string[] = [`.detect-${id}`],
): ForumForgeAdapterV1 {
  return {
    schemaVersion: 1,
    id,
    name: id,
    matches: [{ origin: "https://forum.example.test", pathname }],
    detect,
    thread: { title: { selector: "h1.thread-title", source: "text" } },
    posts: {
      selector: ".post[data-post-id]",
      fields: {
        id: { source: "attribute", attribute: "data-post-id" },
        author: { selector: ".author", source: "text" },
        content: { selector: ".body", source: "html" },
      },
    },
  };
}

function validated(adapter: ForumForgeAdapterV1): ValidatedForumForgeAdapterV1 {
  const result = validateAdapter(adapter);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `${error.path}: ${error.message}`).join("\n"));
  }
  return result.value;
}

function registry(
  local: readonly ValidatedForumForgeAdapterV1[],
  bundled: BundledAdapterCatalogV1 = EMPTY_BUNDLED_ADAPTER_CATALOG,
): AdapterRegistryV1 {
  return { bundled, local };
}

function bundledCatalog(
  adapters: readonly ValidatedForumForgeAdapterV1[],
): BundledAdapterCatalogV1 {
  const catalog = createBundledAdapterCatalog(adapters);
  if (catalog === undefined) throw new Error("Expected a valid bundled adapter catalog.");
  return catalog;
}

function rootMatching(
  predicate: (selector: string) => boolean,
  onQuery?: () => void,
): AdapterDetectionRoot {
  return {
    querySelector(selector) {
      onQuery?.();
      return predicate(selector) ? {} : null;
    },
  };
}

const allDetected = rootMatching(() => true);

describe("linear pathname glob matching", () => {
  it.each([
    ["/threads/*", "/threads/42", true],
    ["/threads/*/posts/*", "/threads/42/posts/7", true],
    ["/threads/*/posts/*", "/threads/42/replies/7", false],
    ["/*", "/", true],
    ["/exact", "/exact", true],
    ["/exact", "/exactly", false],
  ])("matches %s against %s as %s", (pattern, pathname, expected) => {
    expect(matchesPathnameGlob(pattern, pathname)).toBe(expected);
  });

  it("handles the maximum loaded pathname without regex construction", () => {
    const pattern = `/${"a*".repeat(8)}`;
    const pathname = `/${"a".repeat(ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints - 1)}`;

    expect(matchesPathnameGlob(pattern, pathname)).toBe(true);
  });

  it("bounds direct calls and handles an adversarial repeated prefix linearly", () => {
    const repeatedPrefix = `*${"a".repeat(508)}b*`;
    const maximumPathname = `/${"a".repeat(ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints - 1)}`;

    expect(matchesPathnameGlob(repeatedPrefix, maximumPathname)).toBe(false);
    expect(matchesPathnameGlob(`/${"a".repeat(512)}`, "/a")).toBe(false);
    expect(matchesPathnameGlob("/*", `/${"a".repeat(ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints)}`)).toBe(false);
    expect(matchesPathnameGlob(null as unknown as string, "/a")).toBe(false);
  });
});

describe("deterministic adapter selection", () => {
  it("requires an exact origin, matching path, and every detector", () => {
    const adapter = validated(makeAdapter("alpha"));
    const adapterRegistry = registry([adapter]);

    expect(
      selectAdapterForPage(
        adapterRegistry,
        "https://forum.example.test/threads/42?sort=new#post-2",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", adapter });
    expect(
      selectAdapterForPage(adapterRegistry, "https://sub.forum.example.test/threads/42", allDetected),
    ).toEqual({ kind: "generic", reason: "no-url-match" });
    expect(
      selectAdapterForPage(
        adapterRegistry,
        "https://forum.example.test/categories/42",
        allDetected,
      ),
    ).toEqual({ kind: "generic", reason: "no-url-match" });
    expect(
      selectAdapterForPage(
        adapterRegistry,
        "https://forum.example.test/threads/42",
        rootMatching(() => false),
      ),
    ).toEqual({ kind: "generic", reason: "detection-failed" });
  });

  it("evaluates the constrained selectors against an offline DOM root", () => {
    const adapter = validated(makeAdapter(
      "offline-dom",
      "/threads/*",
      ["main.thread > h1.thread-title", ".post[data-post-id]"],
    ));
    const { document } = parseHTML(`
      <main class="thread">
        <h1 class="thread-title">Synthetic topic</h1>
        <article class="post" data-post-id="1"></article>
      </main>
    `);

    expect(
      selectAdapterForPage(
        registry([adapter]),
        "https://forum.example.test/threads/42",
        document,
      ),
    ).toMatchObject({ kind: "adapter", adapter: { id: "offline-dom" } });
    document.querySelector(".post")?.remove();
    expect(
      selectAdapterForPage(
        registry([adapter]),
        "https://forum.example.test/threads/42",
        document,
      ),
    ).toEqual({ kind: "generic", reason: "detection-failed" });
  });

  it("canonicalizes the loaded URL pathname before matching", () => {
    const cjk = makeAdapter("cjk", "/boards/%ED%95%9C/*");
    const ascii = makeAdapter("ascii", "/boards/A/*");

    expect(
      selectAdapterForPage(
        registry([validated(cjk)]),
        "https://forum.example.test/boards/%ed%95%9c/topic",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", adapter: { id: "cjk" } });
    expect(
      selectAdapterForPage(
        registry([validated(ascii)]),
        "https://forum.example.test/boards/%41/topic",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", adapter: { id: "ascii" } });
  });

  it("rejects ambiguous loaded paths and unsupported URLs", () => {
    const adapterRegistry = registry([validated(makeAdapter("alpha"))]);

    for (const pageUrl of [
      "https://forum.example.test/threads/%2Fsecret",
      "https://forum.example.test/threads/%2Asecret",
      "https://user:pass@forum.example.test/threads/42",
      "ftp://forum.example.test/threads/42",
      "/threads/42",
      `https://forum.example.test/${"a".repeat(ADAPTER_MATCH_LIMITS.currentUrlCodeUnits)}`,
    ]) {
      expect(selectAdapterForPage(adapterRegistry, pageUrl, allDetected)).toEqual({
        kind: "generic",
        reason: "unsupported-url",
      });
    }
  });

  it("ranks bundled adapters before more specific local adapters", () => {
    const bundled = validated(makeAdapter("bundled-reader", "/threads/*"));
    const local = validated(makeAdapter("local-reader", "/threads/specific/*"));

    expect(
      selectAdapterForPage(
        registry([local], bundledCatalog([bundled])),
        "https://forum.example.test/threads/specific/42",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", adapter: { id: "bundled-reader" }, tier: "bundled" });
  });

  it("uses literal specificity, wildcard count, and ID without insertion-order effects", () => {
    const broad = validated(makeAdapter("z-broad", "/threads/*"));
    const specific = validated(makeAdapter("z-specific", "/threads/topic/*"));
    const extraWildcards = validated(makeAdapter("a-extra", "/a*b*"));
    const fewerWildcards = validated(makeAdapter("z-fewer", "/ab*"));
    const alpha = validated(makeAdapter("alpha", "/same/*"));
    const beta = validated(makeAdapter("beta", "/same/*"));

    expect(
      selectAdapterForPage(
        registry([broad, specific]),
        "https://forum.example.test/threads/topic/42",
        allDetected,
      ),
    ).toMatchObject({ adapter: { id: "z-specific" } });
    expect(
      selectAdapterForPage(
        registry([extraWildcards, fewerWildcards]),
        "https://forum.example.test/ab",
        allDetected,
      ),
    ).toMatchObject({ adapter: { id: "z-fewer" } });

    const forward = selectAdapterForPage(
      registry([beta, alpha]),
      "https://forum.example.test/same/42",
      allDetected,
    );
    const reverse = selectAdapterForPage(
      registry([alpha, beta]),
      "https://forum.example.test/same/42",
      allDetected,
    );
    expect(forward).toMatchObject({ adapter: { id: "alpha" } });
    expect(reverse).toEqual(forward);
  });

  it("uses the best matching record from one adapter", () => {
    const adapter = makeAdapter("multi", "/*");
    adapter.matches.push({
      origin: "https://forum.example.test",
      pathname: "/threads/topic/*",
    });

    expect(
      selectAdapterForPage(
        registry([validated(adapter)]),
        "https://forum.example.test/threads/topic/42",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", matchedPathnameGlob: "/threads/topic/*" });

    const tied = makeAdapter("tied", "/a*b");
    tied.matches.push({ origin: "https://forum.example.test", pathname: "/ab*" });
    expect(
      selectAdapterForPage(
        registry([validated(tied)]),
        "https://forum.example.test/ab",
        allDetected,
      ),
    ).toMatchObject({ kind: "adapter", matchedPathnameGlob: "/a*b" });
  });

  it("continues after a missing or throwing detector", () => {
    const first = validated(makeAdapter("first", "/threads/*", [".first"]));
    const second = validated(makeAdapter("second", "/threads/*", [".second"]));
    const pageUrl = "https://forum.example.test/threads/42";

    expect(
      selectAdapterForPage(
        registry([first, second]),
        pageUrl,
        rootMatching((selector) => selector === ".second"),
      ),
    ).toMatchObject({ kind: "adapter", adapter: { id: "second" } });

    const throwingRoot: AdapterDetectionRoot = {
      querySelector(selector) {
        if (selector === ".first") throw new SyntaxError("unsupported selector");
        return {};
      },
    };
    expect(selectAdapterForPage(registry([first, second]), pageUrl, throwingRoot)).toMatchObject({
      kind: "adapter",
      adapter: { id: "second" },
    });
  });

  it("rejects duplicate IDs, forged values, clones, and oversized registries", () => {
    const adapter = validated(makeAdapter("alpha"));
    expect(
      selectAdapterForPage(
        registry([adapter], bundledCatalog([adapter])),
        "https://forum.example.test/threads/42",
        allDetected,
      ),
    ).toEqual({ kind: "generic", reason: "invalid-registry" });

    const forged = makeAdapter("forged") as unknown as ValidatedForumForgeAdapterV1;
    const cloned = structuredClone(adapter) as ValidatedForumForgeAdapterV1;
    for (const value of [forged, cloned]) {
      expect(
        selectAdapterForPage(
          registry([value]),
          "https://forum.example.test/threads/42",
          allDetected,
        ),
      ).toEqual({ kind: "generic", reason: "invalid-registry" });
    }

    const forgedCatalog = Object.freeze({}) as BundledAdapterCatalogV1;
    expect(
      selectAdapterForPage(
        registry([], forgedCatalog),
        "https://forum.example.test/threads/42",
        allDetected,
      ),
    ).toEqual({ kind: "generic", reason: "invalid-registry" });

    const oversized = Array.from(
      { length: ADAPTER_MATCH_LIMITS.registryEntries + 1 },
      () => adapter,
    );
    expect(
      selectAdapterForPage(
        registry(oversized),
        "https://forum.example.test/threads/42",
        allDetected,
      ),
    ).toEqual({ kind: "generic", reason: "invalid-registry" });
  });

  it("caps URL candidates before page queries can scale with the registry", () => {
    const adapterRegistry = registry(Array.from(
      { length: ADAPTER_MATCH_LIMITS.detectionCandidates + 1 },
      (_, index) => validated(makeAdapter(`adapter-${String(index).padStart(2, "0")}`)),
    ));
    let queries = 0;

    expect(
      selectAdapterForPage(
        adapterRegistry,
        "https://forum.example.test/threads/42",
        rootMatching(() => false, () => { queries += 1; }),
      ),
    ).toEqual({ kind: "generic", reason: "budget-exhausted" });
    expect(queries).toBe(ADAPTER_MATCH_LIMITS.detectionCandidates);
  });

  it("caps aggregate URL-match work across a full registry before querying the page", () => {
    const adapters = Array.from(
      { length: ADAPTER_MATCH_LIMITS.registryEntries },
      (_, adapterIndex) => {
        const adapter = makeAdapter(`work-${String(adapterIndex).padStart(3, "0")}`);
        adapter.matches = Array.from(
          { length: 16 },
          (_, matchIndex) => ({
            origin: "https://forum.example.test",
            pathname: `/${"a".repeat(480)}${String(matchIndex).padStart(2, "0")}*`,
          }),
        );
        return validated(adapter);
      },
    );
    let queries = 0;

    expect(
      selectAdapterForPage(
        registry(adapters),
        `https://forum.example.test/${"a".repeat(ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints - 2)}c`,
        rootMatching(() => true, () => { queries += 1; }),
      ),
    ).toEqual({ kind: "generic", reason: "budget-exhausted" });
    expect(queries).toBe(0);
  });

  it("caps total selector queries across candidates", () => {
    const selectors = [
      ".present-0",
      ".present-1",
      ".present-2",
      ".present-3",
      ".present-4",
      ".present-5",
      ".present-6",
      ".missing",
    ];
    const adapterRegistry = registry(Array.from({ length: 9 }, (_, index) => validated(
      makeAdapter(`adapter-${String(index).padStart(2, "0")}`, "/threads/*", selectors),
    )));
    let queries = 0;

    expect(
      selectAdapterForPage(
        adapterRegistry,
        "https://forum.example.test/threads/42",
        rootMatching((selector) => selector !== ".missing", () => { queries += 1; }),
      ),
    ).toEqual({ kind: "generic", reason: "budget-exhausted" });
    expect(queries).toBe(ADAPTER_MATCH_LIMITS.selectorQueries);
  });
});
