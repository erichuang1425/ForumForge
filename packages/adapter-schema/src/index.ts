export { adapterV1Schema } from "./schema";
export {
  ADAPTER_EXTRACTION_LIMITS,
  ADAPTER_MATCH_LIMITS,
  ADAPTER_VALIDATION_LIMITS,
} from "./limits";
export {
  extractThreadWithAdapter,
  type AdapterExtractedPostV1,
  type AdapterExtractedThreadV1,
  type AdapterExtractionFallbackReason,
  type AdapterExtractionResult,
} from "./extract";
export {
  matchesPathnameGlob,
  selectAdapterForPage,
  type AdapterDetectionRoot,
  type AdapterFallbackReason,
  type AdapterRegistryV1,
  type AdapterSelection,
  type AdapterTrustTier,
} from "./match";
export {
  EMPTY_BUNDLED_ADAPTER_CATALOG,
  type BundledAdapterCatalogV1,
} from "./provenance";
export {
  parseAdapterJson,
  validateAdapter,
  type AdapterValidationError,
  type AdapterValidationErrorCode,
  type AdapterValidationResult,
} from "./validate";
export {
  ADAPTER_READ_ATTRIBUTES,
  ADAPTER_SCHEMA_VERSION,
  type AdapterAttributeReadV1,
  type AdapterAuthorAttribute,
  type AdapterContentReadV1,
  type AdapterHtmlReadV1,
  type AdapterIdAttribute,
  type AdapterLayout,
  type AdapterPostFieldsV1,
  type AdapterReadAttribute,
  type AdapterScalarReadV1,
  type AdapterSelectedAttributeReadV1,
  type AdapterSelectedTextReadV1,
  type AdapterParentIdAttribute,
  type AdapterPermalinkAttribute,
  type AdapterTextReadV1,
  type AdapterThreadTitleAttribute,
  type AdapterThreadTitleReadV1,
  type AdapterTimestampAttribute,
  type AdapterUrlMatchV1,
  type ForumForgeAdapterV1,
  type ValidatedForumForgeAdapterV1,
} from "./types";
