import { ADAPTER_EXTRACTION_LIMITS } from "./limits";
import {
  EMPTY_BUNDLED_ADAPTER_CATALOG,
} from "./provenance";
import {
  selectAdapterForPage,
  type AdapterDetectionRoot,
  type AdapterFallbackReason,
} from "./match";
import type {
  AdapterContentReadV1,
  AdapterLayout,
  AdapterScalarReadV1,
  ValidatedForumForgeAdapterV1,
} from "./types";

export type AdapterExtractedPostV1 = {
  id: string;
  author: string;
  timestamp?: string;
  contentText: string;
  /** Hostile page markup. It must pass through the established sanitizer. */
  contentHtml?: string;
  permalink?: string;
  parentId?: string;
};

export type AdapterExtractedThreadV1 = {
  adapterId: string;
  baseUrl: string;
  layout: AdapterLayout;
  title: string;
  posts: AdapterExtractedPostV1[];
};

export type AdapterExtractionFallbackReason =
  | AdapterFallbackReason
  | "duplicate-post-id"
  | "no-posts"
  | "query-failed"
  | "required-field-missing";

export type AdapterExtractionResult =
  | {
      kind: "adapter";
      htmlTrust: "untrusted-page-html";
      thread: AdapterExtractedThreadV1;
    }
  | {
      kind: "generic";
      reason: AdapterExtractionFallbackReason;
      path?: string;
    };

type Failure = Extract<AdapterExtractionResult, { kind: "generic" }> & { ok: false };
type Attempt<T> = { ok: true; value: T } | Failure;

type ExtractionBudget = {
  selectorQueries: number;
  selectedNodes: number;
  fieldReads: number;
  domNodes: number;
  htmlAttributes: number;
  rawCodeUnits: number;
  retainedCodeUnits: number;
};

type ContentValue = {
  text: string;
  html?: string;
};

type WalkEvent =
  | { kind: "node"; node: Node }
  | { kind: "close"; tagName: string };

type ChildFrame = {
  collection: unknown;
  index: number;
  length: number;
};

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function failure(reason: AdapterExtractionFallbackReason, path?: string): Failure {
  return {
    ok: false,
    kind: "generic",
    reason,
    ...(path === undefined ? {} : { path }),
  };
}

function publicFailure(value: Failure): AdapterExtractionResult {
  const { ok: _ok, ...result } = value;
  return result;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function consume(
  budget: ExtractionBudget,
  key: keyof ExtractionBudget,
  amount: number,
  maximum: number,
): boolean {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum - budget[key]) {
    return false;
  }
  budget[key] += amount;
  return true;
}

function consumeRaw(
  budget: ExtractionBudget,
  codeUnits: number,
  path: string,
): Failure | undefined {
  return consume(
    budget,
    "rawCodeUnits",
    codeUnits,
    ADAPTER_EXTRACTION_LIMITS.rawCodeUnits,
  )
    ? undefined
    : failure("budget-exhausted", path);
}

function retain(
  budget: ExtractionBudget,
  value: string,
  path: string,
): Failure | undefined {
  return consume(
    budget,
    "retainedCodeUnits",
    value.length,
    ADAPTER_EXTRACTION_LIMITS.totalRetainedCodeUnits,
  )
    ? undefined
    : failure("budget-exhausted", path);
}

function collectionItem(collection: unknown, index: number): unknown {
  const value = collection as { item?: unknown; [key: number]: unknown };
  return typeof value.item === "function"
    ? value.item.call(collection, index)
    : value[index];
}

function isElement(value: unknown): value is Element {
  return typeof value === "object" && value !== null &&
    (value as { nodeType?: unknown }).nodeType === 1;
}

function queryOne(
  scope: ParentNode,
  selector: string,
  budget: ExtractionBudget,
  path: string,
): Attempt<Element | undefined> {
  if (!consume(
    budget,
    "selectorQueries",
    1,
    ADAPTER_EXTRACTION_LIMITS.selectorQueries,
  )) {
    return failure("budget-exhausted", path);
  }
  try {
    const selected = scope.querySelector(selector);
    if (selected === null) return { ok: true, value: undefined };
    if (!isElement(selected)) return failure("query-failed", path);
    if (!consume(
      budget,
      "selectedNodes",
      1,
      ADAPTER_EXTRACTION_LIMITS.selectedNodes,
    )) {
      return failure("budget-exhausted", path);
    }
    return { ok: true, value: selected };
  } catch {
    return failure("query-failed", path);
  }
}

function childFrame(container: ParentNode | Node, path: string): Attempt<ChildFrame> {
  try {
    const collection = (container as Node).childNodes;
    const length = collection.length;
    if (!Number.isSafeInteger(length) || length < 0) return failure("query-failed", path);
    return { ok: true, value: { collection, index: 0, length } };
  } catch {
    return failure("query-failed", path);
  }
}

function queryPosts(
  root: ParentNode,
  selector: string,
  budget: ExtractionBudget,
): Attempt<Element[]> {
  const path = "$.posts";
  if (!consume(
    budget,
    "selectorQueries",
    1,
    ADAPTER_EXTRACTION_LIMITS.selectorQueries,
  )) {
    return failure("budget-exhausted", path);
  }
  const initialFrame = childFrame(root, path);
  if (!initialFrame.ok) return initialFrame;
  const frames: ChildFrame[] = [initialFrame.value];
  const posts: Element[] = [];

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame === undefined) break;
    if (frame.index >= frame.length) {
      frames.pop();
      continue;
    }
    if (!consume(
      budget,
      "domNodes",
      1,
      ADAPTER_EXTRACTION_LIMITS.domNodes,
    )) {
      return failure("budget-exhausted", path);
    }

    let node: unknown;
    try {
      node = collectionItem(frame.collection, frame.index);
      frame.index += 1;
    } catch {
      return failure("query-failed", path);
    }
    if (typeof node !== "object" || node === null) return failure("query-failed", path);

    let nodeType: number;
    try {
      nodeType = (node as Node).nodeType;
    } catch {
      return failure("query-failed", path);
    }
    if (nodeType === 1) {
      const element = node as Element;
      let matches: boolean;
      try {
        matches = element.matches(selector);
      } catch {
        return failure("query-failed", path);
      }
      if (typeof matches !== "boolean") return failure("query-failed", path);
      if (matches) {
        if (posts.length >= ADAPTER_EXTRACTION_LIMITS.posts) {
          return failure("budget-exhausted", path);
        }
        if (!consume(
          budget,
          "selectedNodes",
          1,
          ADAPTER_EXTRACTION_LIMITS.selectedNodes,
        )) {
          return failure("budget-exhausted", path);
        }
        posts.push(element);
      }
    }
    if (nodeType === 1 || nodeType === 9 || nodeType === 11) {
      const nestedFrame = childFrame(node as Node, path);
      if (!nestedFrame.ok) return nestedFrame;
      if (nestedFrame.value.length > 0) frames.push(nestedFrame.value);
    }
  }

  return { ok: true, value: posts };
}

function scheduleChildren(
  container: Node,
  stack: WalkEvent[],
  budget: ExtractionBudget,
  path: string,
): Failure | undefined {
  try {
    const children = container.childNodes;
    const length = children.length;
    if (!Number.isSafeInteger(length) || length < 0) return failure("query-failed", path);
    if (!consume(
      budget,
      "domNodes",
      length,
      ADAPTER_EXTRACTION_LIMITS.domNodes,
    )) {
      return failure("budget-exhausted", path);
    }
    for (let index = length - 1; index >= 0; index -= 1) {
      const child = collectionItem(children, index);
      if (typeof child !== "object" || child === null) return failure("query-failed", path);
      stack.push({ kind: "node", node: child as Node });
    }
    return undefined;
  } catch {
    return failure("query-failed", path);
  }
}

function readElementContent(
  target: Element,
  includeHtml: boolean,
  textLimit: number,
  budget: ExtractionBudget,
  path: string,
): Attempt<ContentValue> {
  const textChunks: string[] = [];
  let textLength = 0;
  const htmlChunks: string[] = [];
  let htmlLength = 0;

  const appendHtml = (value: string): boolean => {
    if (value.length > ADAPTER_EXTRACTION_LIMITS.htmlContentCodeUnits - htmlLength) {
      return false;
    }
    htmlChunks.push(value);
    htmlLength += value.length;
    return true;
  };

  const appendEscaped = (value: string, attribute: boolean): boolean => {
    let chunk = "";
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index] ?? "";
      const escaped = character === "&"
        ? "&amp;"
        : character === "<"
          ? "&lt;"
          : character === ">" && !attribute
            ? "&gt;"
            : character === '"' && attribute
              ? "&quot;"
              : character;
      if (escaped.length > ADAPTER_EXTRACTION_LIMITS.htmlContentCodeUnits - htmlLength - chunk.length) {
        return false;
      }
      chunk += escaped;
      if (chunk.length >= 1_024) {
        if (!appendHtml(chunk)) return false;
        chunk = "";
      }
    }
    return chunk === "" || appendHtml(chunk);
  };

  const stack: WalkEvent[] = [];
  const initialFailure = scheduleChildren(target, stack, budget, path);
  if (initialFailure !== undefined) return initialFailure;

  while (stack.length > 0) {
    const event = stack.pop();
    if (event === undefined) break;
    if (event.kind === "close") {
      if (includeHtml && !appendHtml(`</${event.tagName}>`)) {
        return failure("budget-exhausted", path);
      }
      continue;
    }

    let nodeType: number;
    try {
      nodeType = event.node.nodeType;
    } catch {
      return failure("query-failed", path);
    }

    if (nodeType === 3 || nodeType === 4) {
      let dataLength: number;
      try {
        dataLength = (event.node as CharacterData).length;
      } catch {
        return failure("query-failed", path);
      }
      if (!Number.isSafeInteger(dataLength) || dataLength < 0) {
        return failure("query-failed", path);
      }
      if (dataLength > textLimit - textLength) return failure("budget-exhausted", path);
      const rawFailure = consumeRaw(budget, dataLength, path);
      if (rawFailure !== undefined) return rawFailure;
      for (let offset = 0; offset < dataLength; offset += 4_096) {
        const count = Math.min(4_096, dataLength - offset);
        let chunk: string;
        try {
          chunk = (event.node as CharacterData).substringData(offset, count);
        } catch {
          return failure("query-failed", path);
        }
        if (typeof chunk !== "string" || chunk.length !== count) {
          return failure("query-failed", path);
        }
        textChunks.push(chunk);
        if (includeHtml && !appendEscaped(chunk, false)) {
          return failure("budget-exhausted", path);
        }
      }
      textLength += dataLength;
      continue;
    }

    if (nodeType === 11) {
      const nestedFailure = scheduleChildren(event.node, stack, budget, path);
      if (nestedFailure !== undefined) return nestedFailure;
      continue;
    }
    if (nodeType !== 1) continue;

    const element = event.node as Element;
    let tagName = "";
    if (includeHtml) {
      try {
        const rawTagName = element.tagName;
        if (
          typeof rawTagName !== "string" ||
          rawTagName.length < 1 ||
          rawTagName.length > 128 ||
          !/^[A-Za-z][A-Za-z0-9:._-]*$/.test(rawTagName)
        ) {
          return failure("query-failed", path);
        }
        tagName = rawTagName.toLowerCase();
        const rawFailure = consumeRaw(budget, rawTagName.length, path);
        if (rawFailure !== undefined) return rawFailure;
        if (!appendHtml(`<${tagName}`)) return failure("budget-exhausted", path);

        const attributes = element.attributes;
        const attributeCount = attributes.length;
        if (!Number.isSafeInteger(attributeCount) || attributeCount < 0) {
          return failure("query-failed", path);
        }
        if (!consume(
          budget,
          "htmlAttributes",
          attributeCount,
          ADAPTER_EXTRACTION_LIMITS.htmlAttributes,
        )) {
          return failure("budget-exhausted", path);
        }
        for (let index = 0; index < attributeCount; index += 1) {
          const attribute = collectionItem(attributes, index) as Attr | null;
          if (attribute === null || typeof attribute !== "object") {
            return failure("query-failed", path);
          }
          const name = attribute.name;
          const value = attribute.value;
          if (
            typeof name !== "string" ||
            typeof value !== "string" ||
            name.length < 1 ||
            name.length > 128 ||
            !/^[^\s"'<>/=\u0000-\u001f\u007f]+$/.test(name)
          ) {
            return failure("query-failed", path);
          }
          const rawFailure = consumeRaw(budget, name.length + value.length, path);
          if (rawFailure !== undefined) return rawFailure;
          if (!appendHtml(` ${name.toLowerCase()}="`) ||
              !appendEscaped(value, true) ||
              !appendHtml('"')) {
            return failure("budget-exhausted", path);
          }
        }
        if (!appendHtml(">")) return failure("budget-exhausted", path);
      } catch {
        return failure("query-failed", path);
      }
    }

    const isVoid = includeHtml && VOID_ELEMENTS.has(tagName);
    if (!isVoid) {
      if (includeHtml) stack.push({ kind: "close", tagName });
      const nestedFailure = scheduleChildren(element, stack, budget, path);
      if (nestedFailure !== undefined) return nestedFailure;
    }
  }

  const value: ContentValue = { text: textChunks.join("") };
  if (includeHtml) value.html = htmlChunks.join("");
  return { ok: true, value };
}

function beginFieldRead(
  budget: ExtractionBudget,
  path: string,
): Failure | undefined {
  return consume(
    budget,
    "fieldReads",
    1,
    ADAPTER_EXTRACTION_LIMITS.fieldReads,
  )
    ? undefined
    : failure("budget-exhausted", path);
}

function readTarget(
  scope: Element | ParentNode,
  selector: string | undefined,
  budget: ExtractionBudget,
  path: string,
): Attempt<Element | undefined> {
  if (selector === undefined) {
    return isElement(scope)
      ? { ok: true, value: scope }
      : failure("query-failed", path);
  }
  return queryOne(scope, selector, budget, path);
}

function readScalar(
  scope: Element | ParentNode,
  rule: AdapterScalarReadV1,
  limit: number,
  budget: ExtractionBudget,
  path: string,
): Attempt<string | undefined> {
  const fieldFailure = beginFieldRead(budget, path);
  if (fieldFailure !== undefined) return fieldFailure;
  const target = readTarget(scope, rule.selector, budget, path);
  if (!target.ok) return target;
  if (target.value === undefined) return { ok: true, value: undefined };

  if (rule.source === "attribute") {
    try {
      const value = target.value.getAttribute(rule.attribute);
      if (value === null) return { ok: true, value: undefined };
      if (typeof value !== "string") return failure("query-failed", path);
      if (value.length > limit) return failure("budget-exhausted", path);
      const rawFailure = consumeRaw(budget, value.length, path);
      if (rawFailure !== undefined) return rawFailure;
      return { ok: true, value };
    } catch {
      return failure("query-failed", path);
    }
  }

  const content = readElementContent(target.value, false, limit, budget, path);
  return content.ok
    ? { ok: true, value: content.value.text }
    : content;
}

function readContent(
  scope: Element,
  rule: AdapterContentReadV1,
  budget: ExtractionBudget,
  path: string,
): Attempt<ContentValue | undefined> {
  const fieldFailure = beginFieldRead(budget, path);
  if (fieldFailure !== undefined) return fieldFailure;
  const target = readTarget(scope, rule.selector, budget, path);
  if (!target.ok) return target;
  if (target.value === undefined) return { ok: true, value: undefined };
  return readElementContent(
    target.value,
    rule.source === "html",
    ADAPTER_EXTRACTION_LIMITS.textContentCodeUnits,
    budget,
    path,
  );
}

function normalizePermalink(
  value: string | undefined,
  pageUrl: URL,
  path: string,
): Attempt<string | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  const trimmed = value.trim();
  if (trimmed === "" || hasAsciiControl(trimmed)) return { ok: true, value: undefined };
  try {
    const resolved = new URL(trimmed, pageUrl);
    if (
      (resolved.protocol !== "http:" && resolved.protocol !== "https:") ||
      resolved.username !== "" ||
      resolved.password !== "" ||
      resolved.origin !== pageUrl.origin
    ) {
      return { ok: true, value: undefined };
    }
    if (resolved.href.length > ADAPTER_EXTRACTION_LIMITS.permalinkCodeUnits) {
      return failure("budget-exhausted", path);
    }
    return { ok: true, value: resolved.href };
  } catch {
    return { ok: true, value: undefined };
  }
}

function extractSelected(
  adapter: ValidatedForumForgeAdapterV1,
  pageUrl: URL,
  root: ParentNode,
): AdapterExtractionResult {
  const budget: ExtractionBudget = {
    selectorQueries: 0,
    selectedNodes: 0,
    fieldReads: 0,
    domNodes: 0,
    htmlAttributes: 0,
    rawCodeUnits: 0,
    retainedCodeUnits: 0,
  };

  const selectedPosts = queryPosts(root, adapter.posts.selector, budget);
  if (!selectedPosts.ok) return publicFailure(selectedPosts);
  if (selectedPosts.value.length === 0) {
    return publicFailure(failure("no-posts", "$.posts"));
  }

  const titleRead = readScalar(
    root,
    adapter.thread.title,
    ADAPTER_EXTRACTION_LIMITS.threadTitleCodeUnits,
    budget,
    "$.thread.title",
  );
  if (!titleRead.ok) return publicFailure(titleRead);
  const title = titleRead.value === undefined ? "" : normalizeWhitespace(titleRead.value);
  if (title === "") return publicFailure(failure("required-field-missing", "$.thread.title"));
  const titleRetainFailure = retain(budget, title, "$.thread.title");
  if (titleRetainFailure !== undefined) return publicFailure(titleRetainFailure);

  const posts: AdapterExtractedPostV1[] = [];
  const seenIds = new Set<string>();
  for (let index = 0; index < selectedPosts.value.length; index += 1) {
    const selectedPost = selectedPosts.value[index];
    if (selectedPost === undefined) return publicFailure(failure("query-failed", "$.posts"));
    const basePath = `$.posts[${index}].fields`;

    const idRead = readScalar(
      selectedPost,
      adapter.posts.fields.id,
      ADAPTER_EXTRACTION_LIMITS.postIdCodeUnits,
      budget,
      `${basePath}.id`,
    );
    if (!idRead.ok) return publicFailure(idRead);
    const id = idRead.value?.trim() ?? "";
    if (id === "" || hasAsciiControl(id)) {
      return publicFailure(failure("required-field-missing", `${basePath}.id`));
    }
    if (seenIds.has(id)) {
      return publicFailure(failure("duplicate-post-id", `${basePath}.id`));
    }
    const idRetainFailure = retain(budget, id, `${basePath}.id`);
    if (idRetainFailure !== undefined) return publicFailure(idRetainFailure);

    const authorRead = readScalar(
      selectedPost,
      adapter.posts.fields.author,
      ADAPTER_EXTRACTION_LIMITS.authorCodeUnits,
      budget,
      `${basePath}.author`,
    );
    if (!authorRead.ok) return publicFailure(authorRead);
    if (authorRead.value === undefined) {
      return publicFailure(failure("required-field-missing", `${basePath}.author`));
    }
    const author = normalizeWhitespace(authorRead.value) || "Unknown";
    const authorRetainFailure = retain(budget, author, `${basePath}.author`);
    if (authorRetainFailure !== undefined) return publicFailure(authorRetainFailure);

    const contentRead = readContent(
      selectedPost,
      adapter.posts.fields.content,
      budget,
      `${basePath}.content`,
    );
    if (!contentRead.ok) return publicFailure(contentRead);
    if (contentRead.value === undefined) {
      return publicFailure(failure("required-field-missing", `${basePath}.content`));
    }
    const contentText = cleanText(contentRead.value.text);
    const contentHtml = contentRead.value.html?.trim()
      ? contentRead.value.html
      : undefined;
    const textRetainFailure = retain(budget, contentText, `${basePath}.content`);
    if (textRetainFailure !== undefined) return publicFailure(textRetainFailure);
    if (contentHtml !== undefined) {
      const htmlRetainFailure = retain(budget, contentHtml, `${basePath}.content`);
      if (htmlRetainFailure !== undefined) return publicFailure(htmlRetainFailure);
    }

    const timestampRead = adapter.posts.fields.timestamp === undefined
      ? { ok: true as const, value: undefined }
      : readScalar(
          selectedPost,
          adapter.posts.fields.timestamp,
          ADAPTER_EXTRACTION_LIMITS.timestampCodeUnits,
          budget,
          `${basePath}.timestamp`,
        );
    if (!timestampRead.ok) return publicFailure(timestampRead);
    const timestamp = timestampRead.value === undefined
      ? undefined
      : normalizeWhitespace(timestampRead.value) || undefined;
    if (timestamp !== undefined) {
      const timestampRetainFailure = retain(budget, timestamp, `${basePath}.timestamp`);
      if (timestampRetainFailure !== undefined) return publicFailure(timestampRetainFailure);
    }

    const permalinkRead = adapter.posts.fields.permalink === undefined
      ? { ok: true as const, value: undefined }
      : readScalar(
          selectedPost,
          adapter.posts.fields.permalink,
          ADAPTER_EXTRACTION_LIMITS.permalinkCodeUnits,
          budget,
          `${basePath}.permalink`,
        );
    if (!permalinkRead.ok) return publicFailure(permalinkRead);
    const permalinkResult = normalizePermalink(
      permalinkRead.value,
      pageUrl,
      `${basePath}.permalink`,
    );
    if (!permalinkResult.ok) return publicFailure(permalinkResult);
    const permalink = permalinkResult.value;
    if (permalink !== undefined) {
      const permalinkRetainFailure = retain(budget, permalink, `${basePath}.permalink`);
      if (permalinkRetainFailure !== undefined) return publicFailure(permalinkRetainFailure);
    }

    const parentRead = adapter.posts.fields.parentId === undefined
      ? { ok: true as const, value: undefined }
      : readScalar(
          selectedPost,
          adapter.posts.fields.parentId,
          ADAPTER_EXTRACTION_LIMITS.parentIdCodeUnits,
          budget,
          `${basePath}.parentId`,
        );
    if (!parentRead.ok) return publicFailure(parentRead);
    const parentCandidate = parentRead.value?.trim();
    const parentId = parentCandidate !== undefined &&
      parentCandidate !== "" &&
      !hasAsciiControl(parentCandidate) &&
      seenIds.has(parentCandidate)
      ? parentCandidate
      : undefined;
    if (parentId !== undefined) {
      const parentRetainFailure = retain(budget, parentId, `${basePath}.parentId`);
      if (parentRetainFailure !== undefined) return publicFailure(parentRetainFailure);
    }

    const post: AdapterExtractedPostV1 = { id, author, contentText };
    if (contentHtml !== undefined) post.contentHtml = contentHtml;
    if (timestamp !== undefined) post.timestamp = timestamp;
    if (permalink !== undefined) post.permalink = permalink;
    if (parentId !== undefined) post.parentId = parentId;
    posts.push(post);
    seenIds.add(id);
  }

  const layout: AdapterLayout = adapter.layout === "nested" &&
    posts.some((post) => post.parentId !== undefined)
    ? "nested"
    : "linear";
  return {
    kind: "adapter",
    htmlTrust: "untrusted-page-html",
    thread: {
      adapterId: adapter.id,
      baseUrl: pageUrl.href,
      layout,
      title,
      posts,
    },
  };
}

export function extractThreadWithAdapter(
  adapter: ValidatedForumForgeAdapterV1,
  pageUrl: string,
  root: ParentNode,
): AdapterExtractionResult {
  const selection = selectAdapterForPage(
    { bundled: EMPTY_BUNDLED_ADAPTER_CATALOG, local: [adapter] },
    pageUrl,
    root as AdapterDetectionRoot,
  );
  if (selection.kind === "generic") return selection;

  try {
    return extractSelected(selection.adapter, new URL(pageUrl), root);
  } catch {
    return { kind: "generic", reason: "query-failed", path: "$" };
  }
}
