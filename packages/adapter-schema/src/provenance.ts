import { ADAPTER_MATCH_LIMITS } from "./limits";
import type { ValidatedForumForgeAdapterV1 } from "./types";
import { isValidatedAdapter } from "./validate";

declare const bundledCatalogBrand: unique symbol;

export type BundledAdapterCatalogV1 = {
  readonly [bundledCatalogBrand]: true;
};

const bundledCatalogs = new WeakMap<object, readonly ValidatedForumForgeAdapterV1[]>();

// Internal source-build seam. This function is deliberately absent from the
// package root exports so imported data cannot assert bundled provenance.
export function createBundledAdapterCatalog(
  adapters: readonly ValidatedForumForgeAdapterV1[],
): BundledAdapterCatalogV1 | undefined {
  if (!Array.isArray(adapters) || adapters.length > ADAPTER_MATCH_LIMITS.registryEntries) {
    return undefined;
  }
  const snapshot = adapters.slice();
  const ids = new Set<string>();
  for (const adapter of snapshot) {
    if (!isValidatedAdapter(adapter) || ids.has(adapter.id)) return undefined;
    ids.add(adapter.id);
  }
  Object.freeze(snapshot);
  const catalog = Object.freeze({}) as BundledAdapterCatalogV1;
  bundledCatalogs.set(catalog, snapshot);
  return catalog;
}

export function readBundledAdapterCatalog(
  catalog: unknown,
): readonly ValidatedForumForgeAdapterV1[] | undefined {
  return typeof catalog === "object" && catalog !== null
    ? bundledCatalogs.get(catalog)
    : undefined;
}

export const EMPTY_BUNDLED_ADAPTER_CATALOG = createBundledAdapterCatalog([]) as BundledAdapterCatalogV1;
