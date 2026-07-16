import { ADAPTER_VALIDATION_LIMITS } from "./limits";
import { canonicalizeAdapterPathnameGlob } from "./pathname";
import {
  ADAPTER_READ_ATTRIBUTES,
  ADAPTER_SCHEMA_VERSION,
  type ValidatedForumForgeAdapterV1,
} from "./types";

export type AdapterValidationErrorCode =
  | "duplicate"
  | "error-limit"
  | "format"
  | "input-too-large"
  | "invalid-json"
  | "length"
  | "limit"
  | "non-json-value"
  | "not-allowed"
  | "required"
  | "type"
  | "unknown-property"
  | "unsupported-version";

export type AdapterValidationError = {
  path: string;
  code: AdapterValidationErrorCode;
  message: string;
};

export type AdapterValidationResult =
  | { ok: true; value: ValidatedForumForgeAdapterV1 }
  | { ok: false; errors: AdapterValidationError[] };

type JsonRecord = Record<string, unknown>;
type ReadDestination =
  | "thread-title"
  | "id"
  | "author"
  | "content"
  | "timestamp"
  | "permalink"
  | "parentId";

const validatedAdapters = new WeakSet<object>();

const LAYOUTS = new Set([
  "linear",
  "article-comments",
  "nested",
  "ptt",
  "imageboard",
  "qa",
]);

const ALL_READ_ATTRIBUTES = new Set<string>(ADAPTER_READ_ATTRIBUTES);

const ATTRIBUTES_BY_DESTINATION: Readonly<Record<ReadDestination, ReadonlySet<string>>> = {
  "thread-title": new Set(["aria-label", "title"]),
  id: new Set(["data-id", "data-post-id", "id", "name"]),
  author: new Set(["aria-label", "data-author", "data-username", "title"]),
  content: new Set(),
  timestamp: new Set(["data-time", "data-timestamp", "datetime", "title"]),
  permalink: new Set(["href"]),
  parentId: new Set(["data-parent", "data-parent-id"]),
};

const SAFE_SELECTOR_ATTRIBUTES = new Set([
  "class",
  "datetime",
  "href",
  "id",
  "itemprop",
  "name",
  "role",
  "title",
]);

class ErrorCollector {
  readonly errors: AdapterValidationError[] = [];
  #saturated = false;
  #remainingStructuredEntries: number = ADAPTER_VALIDATION_LIMITS.structuredEntries;

  get saturated(): boolean {
    return this.#saturated;
  }

  get remainingStructuredEntries(): number {
    return this.#remainingStructuredEntries;
  }

  add(path: string, code: AdapterValidationErrorCode, message: string): void {
    if (this.#saturated) return;
    if (this.errors.length < ADAPTER_VALIDATION_LIMITS.validationErrors - 1) {
      this.errors.push({ path, code, message });
      return;
    }
    this.errors.push({
      path: "$",
      code: "error-limit",
      message: `Validation stopped after ${ADAPTER_VALIDATION_LIMITS.validationErrors - 1} errors.`,
    });
    this.#saturated = true;
  }

  consumeStructuredEntries(count: number, path: string): boolean {
    if (count <= this.#remainingStructuredEntries) {
      this.#remainingStructuredEntries -= count;
      return true;
    }
    this.#remainingStructuredEntries = 0;
    this.add(
      path,
      "limit",
      `Structured input exceeds ${ADAPTER_VALIDATION_LIMITS.structuredEntries} properties and items.`,
    );
    return false;
  }
}

function propertyPath(path: string, key: string): string {
  if (codePointLengthUpTo(key, 80) > 80) {
    return `${path}["<property-name-over-80-code-points>"]`;
  }
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function inspectRecord(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): JsonRecord | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    errors.add(path, "type", "Expected an object.");
    return undefined;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    errors.add(path, "non-json-value", "Expected a plain JSON object.");
    return undefined;
  }

  let enumerableOwnKeys = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    enumerableOwnKeys += 1;
    if (enumerableOwnKeys > errors.remainingStructuredEntries) {
      errors.consumeStructuredEntries(enumerableOwnKeys, path);
      return undefined;
    }
  }

  const keys = Reflect.ownKeys(value);
  if (!errors.consumeStructuredEntries(keys.length, path)) return undefined;
  for (const key of keys) {
    if (typeof key !== "string") {
      errors.add(path, "non-json-value", "JSON objects cannot contain symbol keys.");
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      !descriptor.enumerable
    ) {
      errors.add(
        propertyPath(path, key),
        "non-json-value",
        "JSON properties must be enumerable data values.",
      );
      return undefined;
    }
  }

  return value as JsonRecord;
}

function inspectArray(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): unknown[] | undefined {
  if (!Array.isArray(value)) {
    errors.add(path, "type", "Expected an array.");
    return undefined;
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    errors.add(path, "non-json-value", "Expected a plain JSON array.");
    return undefined;
  }

  if (value.length > ADAPTER_VALIDATION_LIMITS.structuredEntries) {
    errors.consumeStructuredEntries(value.length, path);
    return undefined;
  }

  const keys = Reflect.ownKeys(value);
  if (!errors.consumeStructuredEntries(Math.max(0, keys.length - 1), path)) return undefined;
  for (const key of keys) {
    if (typeof key !== "string") {
      errors.add(path, "non-json-value", "JSON arrays cannot contain symbol keys.");
      return undefined;
    }
    if (key === "length") continue;
    if (!/^(?:0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
      errors.add(propertyPath(path, key), "non-json-value", "JSON arrays cannot have named properties.");
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      errors.add(`${path}[${key}]`, "non-json-value", "JSON array items must be data values.");
      return undefined;
    }
  }

  return value;
}

function checkObjectKeys(
  record: JsonRecord,
  path: string,
  required: readonly string[],
  allowed: readonly string[],
  errors: ErrorCollector,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (errors.saturated) break;
    if (!allowedSet.has(key)) {
      errors.add(propertyPath(path, key), "unknown-property", "Unknown property.");
    }
  }
  for (const key of required) {
    if (errors.saturated) break;
    if (!Object.hasOwn(record, key)) {
      errors.add(propertyPath(path, key), "required", "Required property is missing.");
    }
  }
}

function codePointLengthUpTo(value: string, maximum: number): number {
  let length = 0;
  for (const _character of value) {
    length += 1;
    if (length > maximum) return length;
  }
  return length;
}

function utf8ByteLengthUpTo(value: string, maximum: number): number {
  let byteLength = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    byteLength += codePoint <= 0x7f
      ? 1
      : codePoint <= 0x7ff
        ? 2
        : codePoint <= 0xffff
          ? 3
          : 4;
    if (byteLength > maximum) return byteLength;
  }
  return byteLength;
}

function boundedString(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  errors: ErrorCollector,
): string | undefined {
  if (typeof value !== "string") {
    errors.add(path, "type", "Expected a string.");
    return undefined;
  }
  const length = codePointLengthUpTo(value, maximum);
  if (length < minimum || length > maximum) {
    errors.add(path, "length", `Expected ${minimum} to ${maximum} Unicode code points.`);
    return undefined;
  }
  return value;
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function consumeIdentifier(value: string, start: number): number | undefined {
  let index = start;
  if (value[index] === "-") index += 1;
  if (!isIdentifierStart(value[index])) return undefined;
  index += 1;
  while (index < value.length && /[A-Za-z0-9_-]/.test(value[index] ?? "")) {
    index += 1;
  }
  return index;
}

function isSafeSelectorAttribute(attribute: string): boolean {
  const lower = attribute.toLowerCase();
  return (
    SAFE_SELECTOR_ATTRIBUTES.has(lower) ||
    /^data-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lower) ||
    /^aria-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lower)
  );
}

function selectorSyntaxIssue(selector: string): string | undefined {
  if (selector !== selector.trim()) return "Leading or trailing whitespace is not allowed.";
  if (/[\\,:(){}\u0000-\u001f\u007f]/.test(selector)) {
    return "Escapes, lists, pseudo-selectors, parentheses, braces, and control characters are not allowed.";
  }

  let index = 0;
  let compounds = 0;
  let attributes = 0;
  let simpleParts = 0;

  const consumeSpaces = (): boolean => {
    const start = index;
    while (selector[index] === " ") index += 1;
    return index > start;
  };

  while (index < selector.length) {
    compounds += 1;
    if (compounds > ADAPTER_VALIDATION_LIMITS.selectorCompounds) {
      return `A selector can contain at most ${ADAPTER_VALIDATION_LIMITS.selectorCompounds} compound selectors.`;
    }

    let partsInCompound = 0;
    const typeEnd = consumeIdentifier(selector, index);
    if (typeEnd !== undefined) {
      index = typeEnd;
      partsInCompound += 1;
      simpleParts += 1;
    }

    while (index < selector.length) {
      const token = selector[index];
      if (token === "." || token === "#") {
        const identifierEnd = consumeIdentifier(selector, index + 1);
        if (identifierEnd === undefined) return `Expected an identifier after '${token}'.`;
        index = identifierEnd;
        partsInCompound += 1;
        simpleParts += 1;
        continue;
      }

      if (token !== "[") break;
      index += 1;
      consumeSpaces();
      const attributeStart = index;
      const attributeEnd = consumeIdentifier(selector, index);
      if (attributeEnd === undefined) return "Expected a safe attribute name.";
      const attribute = selector.slice(attributeStart, attributeEnd);
      if (!isSafeSelectorAttribute(attribute)) {
        return `Attribute selector '${attribute}' is outside the reviewed allowlist.`;
      }
      index = attributeEnd;
      consumeSpaces();

      if (selector[index] !== "]") {
        const twoCharacterOperator = selector.slice(index, index + 2);
        if (["~=", "|=", "^=", "$=", "*="].includes(twoCharacterOperator)) {
          index += 2;
        } else if (selector[index] === "=") {
          index += 1;
        } else {
          return "Expected a supported attribute operator or closing bracket.";
        }
        consumeSpaces();

        const quote = selector[index];
        if (quote === "\"" || quote === "'") {
          index += 1;
          while (index < selector.length && selector[index] !== quote) index += 1;
          if (selector[index] !== quote) return "Attribute value is missing a closing quote.";
          index += 1;
        } else {
          const valueStart = index;
          while (index < selector.length && /[A-Za-z0-9_-]/.test(selector[index] ?? "")) {
            index += 1;
          }
          if (index === valueStart) return "Expected a quoted or identifier attribute value.";
        }
        consumeSpaces();
      }

      if (selector[index] !== "]") return "Attribute selector is missing a closing bracket.";
      index += 1;
      attributes += 1;
      partsInCompound += 1;
      simpleParts += 1;
      if (attributes > ADAPTER_VALIDATION_LIMITS.selectorAttributes) {
        return `A selector can contain at most ${ADAPTER_VALIDATION_LIMITS.selectorAttributes} attributes.`;
      }
    }

    if (partsInCompound === 0) return "Expected a type, class, ID, or attribute selector.";
    if (simpleParts > ADAPTER_VALIDATION_LIMITS.selectorSimpleParts) {
      return `A selector can contain at most ${ADAPTER_VALIDATION_LIMITS.selectorSimpleParts} simple parts.`;
    }
    if (index === selector.length) break;

    const hadSpaces = consumeSpaces();
    if (selector[index] === ">") {
      index += 1;
      consumeSpaces();
      if (index === selector.length) return "A child combinator must be followed by a selector.";
      continue;
    }
    if (hadSpaces) {
      if (index === selector.length) return "Trailing whitespace is not allowed.";
      continue;
    }
    return `Unsupported selector token '${selector[index]}'.`;
  }

  return undefined;
}

function normalizeSelectorWhitespace(selector: string): string {
  let normalized = "";
  let quote: "\"" | "'" | undefined;
  let pendingSpace = false;
  for (const character of selector) {
    if (quote !== undefined) {
      normalized += character;
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "\"" || character === "'") {
      if (pendingSpace && normalized !== "" && !normalized.endsWith(">")) normalized += " ";
      pendingSpace = false;
      normalized += character;
      quote = character;
      continue;
    }
    if (character === " ") {
      pendingSpace = true;
      continue;
    }
    if (character === ">") {
      normalized = normalized.trimEnd();
      normalized += ">";
      pendingSpace = false;
      continue;
    }
    if (pendingSpace && normalized !== "" && !normalized.endsWith(">")) normalized += " ";
    pendingSpace = false;
    normalized += character;
  }
  return normalized;
}

function validateSelector(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): string | undefined {
  const selector = boundedString(
    value,
    path,
    1,
    ADAPTER_VALIDATION_LIMITS.selectorCodePoints,
    errors,
  );
  if (selector === undefined) return undefined;
  const issue = selectorSyntaxIssue(selector);
  if (issue !== undefined) {
    errors.add(path, "format", issue);
    return undefined;
  }
  return normalizeSelectorWhitespace(selector);
}

function validateOrigin(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): string | undefined {
  const origin = boundedString(value, path, 8, 255, errors);
  if (origin === undefined) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    errors.add(path, "format", "Expected a valid canonical HTTP(S) origin.");
    return undefined;
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.origin !== origin
  ) {
    errors.add(path, "format", "Expected a canonical HTTP(S) origin without credentials, path, query, or fragment.");
    return undefined;
  }
  return origin;
}

function validatePathname(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): string | undefined {
  const pathname = boundedString(
    value,
    path,
    1,
    ADAPTER_VALIDATION_LIMITS.pathnameCodePoints,
    errors,
  );
  if (pathname === undefined) return undefined;
  const canonical = canonicalizeAdapterPathnameGlob(
    pathname,
    ADAPTER_VALIDATION_LIMITS.pathnameCodePoints,
  );
  if (!canonical.ok) {
    errors.add(path, "format", canonical.message);
    return undefined;
  }
  if (canonical.value !== pathname) {
    errors.add(path, "format", "Use uppercase escapes and literal ASCII in the canonical pathname glob.");
    return undefined;
  }
  const wildcards = [...pathname].filter((character) => character === "*").length;
  if (wildcards > ADAPTER_VALIDATION_LIMITS.pathnameWildcards) {
    errors.add(path, "limit", `A pathname glob can contain at most ${ADAPTER_VALIDATION_LIMITS.pathnameWildcards} wildcards.`);
    return undefined;
  }
  return pathname;
}

function validateUrlMatch(
  value: unknown,
  path: string,
  errors: ErrorCollector,
): string | undefined {
  const record = inspectRecord(value, path, errors);
  if (record === undefined) return undefined;
  checkObjectKeys(record, path, ["origin", "pathname"], ["origin", "pathname"], errors);
  const origin = Object.hasOwn(record, "origin")
    ? validateOrigin(record.origin, `${path}.origin`, errors)
    : undefined;
  const pathname = Object.hasOwn(record, "pathname")
    ? validatePathname(record.pathname, `${path}.pathname`, errors)
    : undefined;
  return origin !== undefined && pathname !== undefined
    ? `${origin}\u0000${pathname}`
    : undefined;
}

function validateRead(
  value: unknown,
  path: string,
  destination: ReadDestination,
  errors: ErrorCollector,
): void {
  const record = inspectRecord(value, path, errors);
  if (record === undefined) return;

  const source = record.source;
  const sourceIsAttribute = source === "attribute";
  checkObjectKeys(
    record,
    path,
    sourceIsAttribute ? ["source", "attribute"] : ["source"],
    sourceIsAttribute ? ["selector", "source", "attribute"] : ["selector", "source"],
    errors,
  );

  if (destination === "thread-title" && !Object.hasOwn(record, "selector")) {
    errors.add(`${path}.selector`, "required", "A thread title selector is required.");
  }
  if (Object.hasOwn(record, "selector")) {
    validateSelector(record.selector, `${path}.selector`, errors);
  }

  const allowedSources = destination === "content"
    ? new Set(["text", "html"])
    : new Set(["text", "attribute"]);
  if (typeof source !== "string") {
    if (Object.hasOwn(record, "source")) errors.add(`${path}.source`, "type", "Expected a string.");
    return;
  }
  if (!allowedSources.has(source)) {
    errors.add(`${path}.source`, "not-allowed", `Source '${source}' is not allowed for ${destination}.`);
  }

  if (!sourceIsAttribute || !Object.hasOwn(record, "attribute")) return;
  const attribute = boundedString(record.attribute, `${path}.attribute`, 1, 32, errors);
  if (attribute === undefined) return;
  if (!ALL_READ_ATTRIBUTES.has(attribute)) {
    errors.add(`${path}.attribute`, "not-allowed", `Attribute '${attribute}' is outside the reviewed read allowlist.`);
    return;
  }
  if (!ATTRIBUTES_BY_DESTINATION[destination].has(attribute)) {
    errors.add(`${path}.attribute`, "not-allowed", `Attribute '${attribute}' is not allowed for ${destination}.`);
  }
}

function validateMatches(value: unknown, path: string, errors: ErrorCollector): void {
  const matches = inspectArray(value, path, errors);
  if (matches === undefined) return;
  if (matches.length < 1 || matches.length > ADAPTER_VALIDATION_LIMITS.matches) {
    errors.add(path, "limit", `Expected 1 to ${ADAPTER_VALIDATION_LIMITS.matches} URL match records.`);
  }
  const seen = new Set<string>();
  const inspected = Math.min(matches.length, ADAPTER_VALIDATION_LIMITS.matches);
  for (let index = 0; index < inspected; index += 1) {
    if (!Object.hasOwn(matches, index)) {
      errors.add(`${path}[${index}]`, "non-json-value", "JSON arrays cannot be sparse.");
      continue;
    }
    const key = validateUrlMatch(matches[index], `${path}[${index}]`, errors);
    if (key === undefined) continue;
    if (seen.has(key)) {
      errors.add(`${path}[${index}]`, "duplicate", "Duplicate normalized URL match.");
    } else {
      seen.add(key);
    }
  }
}

function validateDetection(value: unknown, path: string, errors: ErrorCollector): void {
  const selectors = inspectArray(value, path, errors);
  if (selectors === undefined) return;
  if (selectors.length < 1 || selectors.length > ADAPTER_VALIDATION_LIMITS.detectionSelectors) {
    errors.add(path, "limit", `Expected 1 to ${ADAPTER_VALIDATION_LIMITS.detectionSelectors} detection selectors.`);
  }
  const seen = new Set<string>();
  const inspected = Math.min(selectors.length, ADAPTER_VALIDATION_LIMITS.detectionSelectors);
  for (let index = 0; index < inspected; index += 1) {
    if (!Object.hasOwn(selectors, index)) {
      errors.add(`${path}[${index}]`, "non-json-value", "JSON arrays cannot be sparse.");
      continue;
    }
    const normalized = validateSelector(selectors[index], `${path}[${index}]`, errors);
    if (normalized === undefined) continue;
    if (seen.has(normalized)) {
      errors.add(`${path}[${index}]`, "duplicate", "Duplicate normalized detection selector.");
    } else {
      seen.add(normalized);
    }
  }
}

function validateThread(value: unknown, path: string, errors: ErrorCollector): void {
  const record = inspectRecord(value, path, errors);
  if (record === undefined) return;
  checkObjectKeys(record, path, ["title"], ["title"], errors);
  if (Object.hasOwn(record, "title")) {
    validateRead(record.title, `${path}.title`, "thread-title", errors);
  }
}

function validatePostFields(value: unknown, path: string, errors: ErrorCollector): void {
  const record = inspectRecord(value, path, errors);
  if (record === undefined) return;
  const allowed = ["id", "author", "content", "timestamp", "permalink", "parentId"];
  checkObjectKeys(record, path, ["id", "author", "content"], allowed, errors);
  for (const destination of allowed as ReadDestination[]) {
    if (Object.hasOwn(record, destination)) {
      validateRead(record[destination], propertyPath(path, destination), destination, errors);
    }
  }
}

function validatePosts(value: unknown, path: string, errors: ErrorCollector): void {
  const record = inspectRecord(value, path, errors);
  if (record === undefined) return;
  checkObjectKeys(record, path, ["selector", "fields"], ["selector", "fields"], errors);
  if (Object.hasOwn(record, "selector")) {
    validateSelector(record.selector, `${path}.selector`, errors);
  }
  if (Object.hasOwn(record, "fields")) {
    validatePostFields(record.fields, `${path}.fields`, errors);
  }
}

function validateRoot(input: unknown, errors: ErrorCollector): void {
  const record = inspectRecord(input, "$", errors);
  if (record === undefined) return;
  const allowed = ["schemaVersion", "id", "name", "matches", "detect", "layout", "thread", "posts"];
  checkObjectKeys(
    record,
    "$",
    ["schemaVersion", "id", "name", "matches", "detect", "thread", "posts"],
    allowed,
    errors,
  );

  if (Object.hasOwn(record, "schemaVersion")) {
    if (typeof record.schemaVersion !== "number") {
      errors.add("$.schemaVersion", "type", "Expected a number.");
    } else if (record.schemaVersion !== ADAPTER_SCHEMA_VERSION) {
      errors.add("$.schemaVersion", "unsupported-version", `Only schema version ${ADAPTER_SCHEMA_VERSION} is supported.`);
    }
  }

  if (Object.hasOwn(record, "id")) {
    const id = boundedString(record.id, "$.id", 3, 64, errors);
    if (id !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      errors.add("$.id", "format", "Use lowercase ASCII words separated by single hyphens.");
    }
  }
  if (Object.hasOwn(record, "name")) {
    const name = boundedString(record.name, "$.name", 1, 80, errors);
    if (name !== undefined && /[\u0000-\u001f\u007f]/.test(name)) {
      errors.add("$.name", "format", "Control characters are not allowed.");
    }
  }
  if (Object.hasOwn(record, "matches")) validateMatches(record.matches, "$.matches", errors);
  if (Object.hasOwn(record, "detect")) validateDetection(record.detect, "$.detect", errors);
  if (Object.hasOwn(record, "layout")) {
    if (typeof record.layout !== "string") {
      errors.add("$.layout", "type", "Expected a string.");
    } else if (!LAYOUTS.has(record.layout)) {
      errors.add("$.layout", "not-allowed", "Unknown discussion layout.");
    }
  }
  if (Object.hasOwn(record, "thread")) validateThread(record.thread, "$.thread", errors);
  if (Object.hasOwn(record, "posts")) validatePosts(record.posts, "$.posts", errors);
}

function jsonNestingIssue(source: string): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of source) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }
    if (character === "\"") {
      inString = true;
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > ADAPTER_VALIDATION_LIMITS.jsonNesting) {
        return `JSON nesting exceeds ${ADAPTER_VALIDATION_LIMITS.jsonNesting} levels.`;
      }
    } else if (character === "}" || character === "]") {
      depth = Math.max(0, depth - 1);
    }
  }
  return undefined;
}

function duplicateJsonPropertyPath(source: string): string | undefined {
  let index = 0;

  const skipWhitespace = (): void => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };

  const parseString = (): string => {
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += source[index + 1] === "u" ? 6 : 2;
      } else if (source[index] === "\"") {
        index += 1;
        return JSON.parse(source.slice(start, index)) as string;
      } else {
        index += 1;
      }
    }
    return "";
  };

  const parseValue = (path: string): string | undefined => {
    skipWhitespace();
    if (source[index] === "{") return parseObject(path);
    if (source[index] === "[") return parseArray(path);
    if (source[index] === "\"") {
      parseString();
      return undefined;
    }
    while (index < source.length && !/[\s,}\]]/.test(source[index] ?? "")) index += 1;
    return undefined;
  };

  const parseObject = (path: string): string | undefined => {
    index += 1;
    skipWhitespace();
    if (source[index] === "}") {
      index += 1;
      return undefined;
    }
    const keys = new Set<string>();
    while (index < source.length) {
      const key = parseString();
      const keyPath = propertyPath(path, key);
      if (keys.has(key)) return keyPath;
      keys.add(key);
      skipWhitespace();
      index += 1;
      const duplicate = parseValue(keyPath);
      if (duplicate !== undefined) return duplicate;
      skipWhitespace();
      if (source[index] === "}") {
        index += 1;
        return undefined;
      }
      index += 1;
      skipWhitespace();
    }
    return undefined;
  };

  const parseArray = (path: string): string | undefined => {
    index += 1;
    skipWhitespace();
    if (source[index] === "]") {
      index += 1;
      return undefined;
    }
    let itemIndex = 0;
    while (index < source.length) {
      const duplicate = parseValue(`${path}[${itemIndex}]`);
      if (duplicate !== undefined) return duplicate;
      itemIndex += 1;
      skipWhitespace();
      if (source[index] === "]") {
        index += 1;
        return undefined;
      }
      index += 1;
      skipWhitespace();
    }
    return undefined;
  };

  skipWhitespace();
  return parseValue("$");
}

export function validateAdapter(input: unknown): AdapterValidationResult {
  const errors = new ErrorCollector();
  try {
    validateRoot(input, errors);
  } catch {
    return {
      ok: false,
      errors: [{
        path: "$",
        code: "non-json-value",
        message: "Structured input could not be inspected safely.",
      }],
    };
  }
  if (errors.errors.length > 0) return { ok: false, errors: errors.errors };

  try {
    const value = structuredClone(input) as ValidatedForumForgeAdapterV1;
    for (const match of value.matches) Object.freeze(match);
    Object.freeze(value.matches);
    Object.freeze(value.detect);
    Object.freeze(value.thread.title);
    Object.freeze(value.thread);
    for (const read of Object.values(value.posts.fields)) Object.freeze(read);
    Object.freeze(value.posts.fields);
    Object.freeze(value.posts);
    Object.freeze(value);
    validatedAdapters.add(value);
    return {
      ok: true,
      value,
    };
  } catch {
    return {
      ok: false,
      errors: [{ path: "$", code: "non-json-value", message: "Expected JSON data." }],
    };
  }
}

export function isValidatedAdapter(
  value: unknown,
): value is ValidatedForumForgeAdapterV1 {
  return typeof value === "object" && value !== null && validatedAdapters.has(value);
}

export function parseAdapterJson(source: string): AdapterValidationResult {
  const byteLength = utf8ByteLengthUpTo(source, ADAPTER_VALIDATION_LIMITS.utf8JsonBytes);
  if (byteLength > ADAPTER_VALIDATION_LIMITS.utf8JsonBytes) {
    return {
      ok: false,
      errors: [{
        path: "$",
        code: "input-too-large",
        message: `Adapter JSON exceeds ${ADAPTER_VALIDATION_LIMITS.utf8JsonBytes} UTF-8 bytes.`,
      }],
    };
  }

  const nestingIssue = jsonNestingIssue(source);
  if (nestingIssue !== undefined) {
    return {
      ok: false,
      errors: [{ path: "$", code: "limit", message: nestingIssue }],
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(source) as unknown;
  } catch (error) {
    const message = error instanceof SyntaxError
      ? error.message.match(/position\s+\d+/i)?.[0]
      : undefined;
    return {
      ok: false,
      errors: [{
        path: "$",
        code: "invalid-json",
        message: message === undefined ? "Invalid JSON." : `Invalid JSON at ${message.toLowerCase()}.`,
      }],
    };
  }

  const duplicatePath = duplicateJsonPropertyPath(source);
  if (duplicatePath !== undefined) {
    return {
      ok: false,
      errors: [{
        path: duplicatePath,
        code: "duplicate",
        message: "Duplicate JSON property.",
      }],
    };
  }
  return validateAdapter(input);
}
