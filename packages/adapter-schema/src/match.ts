import { ADAPTER_MATCH_LIMITS, ADAPTER_VALIDATION_LIMITS } from "./limits";
import { canonicalizeLoadedPathname } from "./pathname";
import {
  readBundledAdapterCatalog,
  type BundledAdapterCatalogV1,
} from "./provenance";
import type { ValidatedForumForgeAdapterV1 } from "./types";
import { isValidatedAdapter } from "./validate";

export type AdapterTrustTier = "bundled" | "local";

export type AdapterRegistryV1 = Readonly<{
  bundled: BundledAdapterCatalogV1;
  local: readonly ValidatedForumForgeAdapterV1[];
}>;

export type AdapterDetectionRoot = Readonly<{
  querySelector(selector: string): object | null;
}>;

export type AdapterFallbackReason =
  | "budget-exhausted"
  | "detection-failed"
  | "invalid-registry"
  | "no-url-match"
  | "unsupported-url";

export type AdapterSelection =
  | {
      kind: "adapter";
      adapter: ValidatedForumForgeAdapterV1;
      tier: AdapterTrustTier;
      matchedPathnameGlob: string;
    }
  | { kind: "generic"; reason: AdapterFallbackReason };

type Candidate = {
  adapter: ValidatedForumForgeAdapterV1;
  tier: AdapterTrustTier;
  matchedPathnameGlob: string;
  literalCodePoints: number;
  wildcards: number;
};

type InternalRegistryEntry = {
  adapter: ValidatedForumForgeAdapterV1;
  tier: AdapterTrustTier;
};

type MatchWork = { used: number };

function compareCodePoints(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function matchesPathnameGlob(pattern: string, pathname: string): boolean {
  if (
    typeof pattern !== "string" ||
    typeof pathname !== "string" ||
    pattern.length > ADAPTER_VALIDATION_LIMITS.pathnameCodePoints ||
    pathname.length > ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints
  ) {
    return false;
  }
  if (!pattern.includes("*")) return pattern === pathname;
  const leadingWildcard = pattern.startsWith("*");
  const trailingWildcard = pattern.endsWith("*");
  const segments = pattern.split("*").filter((segment) => segment !== "");
  if (segments.length === 0) return true;

  let searchStart = 0;
  let searchEnd = pathname.length;
  if (!leadingWildcard) {
    const first = segments.shift();
    if (first === undefined || !pathname.startsWith(first)) return false;
    searchStart = first.length;
  }
  if (!trailingWildcard) {
    const last = segments.pop();
    if (last === undefined) return searchStart === pathname.length;
    if (!pathname.endsWith(last)) return false;
    searchEnd = pathname.length - last.length;
  }
  if (searchStart > searchEnd) return false;

  for (const segment of segments) {
    const found = findLiteralSegment(pathname, segment, searchStart, searchEnd);
    if (found < 0) return false;
    searchStart = found + segment.length;
  }
  return searchStart <= searchEnd;
}

function findLiteralSegment(
  pathname: string,
  segment: string,
  start: number,
  end: number,
): number {
  const prefix = new Array<number>(segment.length).fill(0);
  for (let index = 1, matched = 0; index < segment.length;) {
    if (segment[index] === segment[matched]) {
      matched += 1;
      prefix[index] = matched;
      index += 1;
    } else if (matched > 0) {
      matched = prefix[matched - 1] ?? 0;
    } else {
      index += 1;
    }
  }

  for (let index = start, matched = 0; index < end;) {
    if (pathname[index] === segment[matched]) {
      index += 1;
      matched += 1;
      if (matched === segment.length) return index - segment.length;
    } else if (matched > 0) {
      matched = prefix[matched - 1] ?? 0;
    } else {
      index += 1;
    }
  }
  return -1;
}

function bestCandidate(
  entry: InternalRegistryEntry,
  origin: string,
  pathname: string,
  work: MatchWork,
): Candidate | "budget-exhausted" | undefined {
  let best: Candidate | undefined;
  for (const match of entry.adapter.matches) {
    work.used += match.origin.length + origin.length + match.pathname.length + pathname.length;
    if (work.used > ADAPTER_MATCH_LIMITS.urlMatchWork) return "budget-exhausted";
    if (match.origin !== origin || !matchesPathnameGlob(match.pathname, pathname)) continue;
    const wildcards = [...match.pathname].filter((character) => character === "*").length;
    const candidate: Candidate = {
      adapter: entry.adapter,
      tier: entry.tier,
      matchedPathnameGlob: match.pathname,
      literalCodePoints: [...match.pathname].length - wildcards,
      wildcards,
    };
    if (
      best === undefined ||
      candidate.literalCodePoints > best.literalCodePoints ||
      (candidate.literalCodePoints === best.literalCodePoints && candidate.wildcards < best.wildcards) ||
      (
        candidate.literalCodePoints === best.literalCodePoints &&
        candidate.wildcards === best.wildcards &&
        compareCodePoints(candidate.matchedPathnameGlob, best.matchedPathnameGlob) < 0
      )
    ) {
      best = candidate;
    }
  }
  return best;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  if (left.tier !== right.tier) return left.tier === "bundled" ? -1 : 1;
  if (left.literalCodePoints !== right.literalCodePoints) {
    return right.literalCodePoints - left.literalCodePoints;
  }
  if (left.wildcards !== right.wildcards) return left.wildcards - right.wildcards;
  return compareCodePoints(left.adapter.id, right.adapter.id);
}

function snapshotRegistry(
  registry: AdapterRegistryV1,
): InternalRegistryEntry[] | undefined {
  if (typeof registry !== "object" || registry === null) {
    return undefined;
  }
  const bundled = readBundledAdapterCatalog(registry.bundled);
  const local = registry.local;
  if (
    bundled === undefined ||
    !Array.isArray(local) ||
    bundled.length + local.length > ADAPTER_MATCH_LIMITS.registryEntries
  ) {
    return undefined;
  }
  const snapshot: InternalRegistryEntry[] = [];
  const ids = new Set<string>();
  for (const [adapters, tier] of [
    [bundled, "bundled"],
    [local.slice(), "local"],
  ] as const) {
    for (const adapter of adapters) {
      if (!isValidatedAdapter(adapter) || ids.has(adapter.id)) return undefined;
      ids.add(adapter.id);
      snapshot.push({ adapter, tier });
    }
  }
  return snapshot;
}

function generic(reason: AdapterFallbackReason): AdapterSelection {
  return { kind: "generic", reason };
}

export function selectAdapterForPage(
  registry: AdapterRegistryV1,
  pageUrl: string,
  root: AdapterDetectionRoot,
): AdapterSelection {
  let snapshot: InternalRegistryEntry[] | undefined;
  try {
    snapshot = snapshotRegistry(registry);
  } catch {
    return generic("invalid-registry");
  }
  if (snapshot === undefined) return generic("invalid-registry");
  if (
    typeof pageUrl !== "string" ||
    pageUrl.length > ADAPTER_MATCH_LIMITS.currentUrlCodeUnits
  ) {
    return generic("unsupported-url");
  }

  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return generic("unsupported-url");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return generic("unsupported-url");
  }
  const canonicalPathname = canonicalizeLoadedPathname(
    parsed.pathname,
    ADAPTER_MATCH_LIMITS.loadedPathnameCodePoints,
  );
  if (!canonicalPathname.ok) return generic("unsupported-url");

  const candidates: Candidate[] = [];
  const work: MatchWork = { used: 0 };
  for (const entry of snapshot) {
    const candidate = bestCandidate(entry, parsed.origin, canonicalPathname.value, work);
    if (candidate === "budget-exhausted") return generic("budget-exhausted");
    if (candidate !== undefined) candidates.push(candidate);
  }
  candidates.sort(compareCandidates);
  if (candidates.length === 0) return generic("no-url-match");

  let selectorQueries = 0;
  const candidateCount = Math.min(
    candidates.length,
    ADAPTER_MATCH_LIMITS.detectionCandidates,
  );
  for (let index = 0; index < candidateCount; index += 1) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    let detected = true;
    for (const selector of candidate.adapter.detect) {
      if (selectorQueries >= ADAPTER_MATCH_LIMITS.selectorQueries) {
        return generic("budget-exhausted");
      }
      selectorQueries += 1;
      try {
        const matched = root.querySelector(selector);
        if (typeof matched !== "object" || matched === null) {
          detected = false;
          break;
        }
      } catch {
        detected = false;
        break;
      }
    }
    if (detected) {
      return {
        kind: "adapter",
        adapter: candidate.adapter,
        tier: candidate.tier,
        matchedPathnameGlob: candidate.matchedPathnameGlob,
      };
    }
  }

  return candidates.length > candidateCount
    ? generic("budget-exhausted")
    : generic("detection-failed");
}
