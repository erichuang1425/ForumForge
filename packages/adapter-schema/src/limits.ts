export const ADAPTER_VALIDATION_LIMITS = {
  utf8JsonBytes: 65_536,
  jsonNesting: 32,
  validationErrors: 64,
  structuredEntries: 512,
  matches: 16,
  detectionSelectors: 8,
  selectorCodePoints: 256,
  selectorCompounds: 8,
  selectorAttributes: 8,
  selectorSimpleParts: 24,
  pathnameCodePoints: 512,
  pathnameWildcards: 8,
} as const;

export const ADAPTER_EXTRACTION_LIMITS = {
  posts: 500,
  threadTitleCodeUnits: 16_384,
  postIdCodeUnits: 512,
  authorCodeUnits: 4_096,
  timestampCodeUnits: 512,
  permalinkCodeUnits: 8_192,
  parentIdCodeUnits: 512,
  textContentCodeUnits: 131_072,
  htmlContentCodeUnits: 262_144,
  totalRetainedCodeUnits: 8_388_608,
} as const;
