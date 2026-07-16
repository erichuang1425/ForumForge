import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import {
  ADAPTER_EXTRACTION_LIMITS,
  extractThreadWithAdapter,
  parseAdapterJson,
  validateAdapter,
  type AdapterExtractionFallbackReason,
  type AdapterExtractionResult,
  type ForumForgeAdapterV1,
  type ValidatedForumForgeAdapterV1,
} from "../src/index";

const adapterSource = readFileSync(
  new URL("./fixtures/example.adapter.json", import.meta.url),
  "utf8",
);
const fixtureHtml = readFileSync(
  new URL("./fixtures/example-thread.html", import.meta.url),
  "utf8",
);
const pageUrl = "https://forum.example.test/threads/42";

function loadAdapter(): ValidatedForumForgeAdapterV1 {
  const result = parseAdapterJson(adapterSource);
  if (!result.ok) throw new Error("Expected the adapter fixture to validate.");
  return result.value;
}

function validate(input: ForumForgeAdapterV1): ValidatedForumForgeAdapterV1 {
  const result = validateAdapter(input);
  if (!result.ok) throw new Error("Expected the test adapter to validate.");
  return result.value;
}

function extract(
  markup = fixtureHtml,
  adapter = loadAdapter(),
  url = pageUrl,
): AdapterExtractionResult {
  const { document } = parseHTML(markup);
  return extractThreadWithAdapter(adapter, url, document as unknown as ParentNode);
}

function expectFallback(
  result: AdapterExtractionResult,
  reason: AdapterExtractionFallbackReason,
  path?: string,
): void {
  expect(result).toMatchObject({ kind: "generic", reason, ...(path ? { path } : {}) });
}

function editableAdapter(): ForumForgeAdapterV1 {
  return structuredClone(loadAdapter()) as ForumForgeAdapterV1;
}

function nodeList(values: readonly object[]) {
  return {
    length: values.length,
    item(index: number) {
      return values[index] ?? null;
    },
  };
}

function syntheticTextElement(text: string, tagName = "SPAN") {
  return {
    nodeType: 1,
    tagName,
    attributes: nodeList([]),
    childNodes: nodeList([{
      nodeType: 3,
      length: text.length,
      substringData(offset: number, count: number) {
        return text.slice(offset, offset + count);
      },
    }]),
    getAttribute: () => null,
    querySelector: () => null,
  };
}

describe("bounded declarative extraction", () => {
  it("extracts deterministic core posts from the offline fixture", () => {
    const first = extract();
    const second = extract();

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      kind: "adapter",
      htmlTrust: "untrusted-page-html",
      thread: {
        adapterId: "example-forum",
        baseUrl: pageUrl,
        layout: "linear",
        title: "A small synthetic discussion",
        posts: [
          {
            id: "101",
            author: "reader-one",
            timestamp: "2026-07-16T08:00:00Z",
            contentText: "Opening thought with emphasis.",
            permalink: `${pageUrl}#post-101`,
          },
          {
            id: "102",
            author: "reader-two",
            timestamp: "2026-07-16T08:04:00Z",
            contentText: "A concise reply.",
            permalink: `${pageUrl}#post-102`,
            parentId: "101",
          },
        ],
      },
    });
    if (first.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(first.thread.posts[0]?.contentHtml).toContain("<strong>emphasis</strong>");
    expect(first.thread.posts[0]?.parentId).toBeUndefined();
  });

  it("rechecks URL and detector evidence before reading fields", () => {
    expectFallback(
      extract(fixtureHtml, loadAdapter(), "https://other.example.test/threads/42"),
      "no-url-match",
    );
    expectFallback(
      extract(fixtureHtml.replace('class="thread-title"', 'class="other-title"')),
      "detection-failed",
    );
  });

  it("fails closed when a required field is absent or empty", () => {
    expectFallback(
      extract(fixtureHtml.replace('<p class="username">reader-two</p>', "")),
      "required-field-missing",
      "$.posts[1].fields.author",
    );
    expectFallback(
      extract(fixtureHtml.replace("A small synthetic discussion", "")),
      "required-field-missing",
      "$.thread.title",
    );
  });

  it("uses the core Unknown author fallback for a present but empty author field", () => {
    const result = extract(fixtureHtml.replace("reader-two", ""));

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts[1]?.author).toBe("Unknown");
  });

  it("omits absent optional fields without dropping the post", () => {
    const result = extract(
      fixtureHtml
        .replace('<time datetime="2026-07-16T08:04:00Z">08:04</time>', "")
        .replace('<span class="post-number"><a href="/threads/42#post-102">#2</a></span>', ""),
    );

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts[1]).toMatchObject({ id: "102", parentId: "101" });
    expect(result.thread.posts[1]?.timestamp).toBeUndefined();
    expect(result.thread.posts[1]?.permalink).toBeUndefined();
  });

  it("rejects duplicate post identities", () => {
    expectFallback(
      extract(fixtureHtml.replace('data-post-id="102"', 'data-post-id="101"')),
      "duplicate-post-id",
      "$.posts[1].fields.id",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/plain,unsafe",
    "blob:https://forum.example.test/example",
    "file:///tmp/example",
    "https://other.example.test/threads/42#post-102",
    "https://user:pass@forum.example.test/threads/42#post-102",
    "http://[invalid",
  ])("omits an unsafe optional permalink value %s", (unsafeHref) => {
    const result = extract(fixtureHtml.replace("/threads/42#post-102", unsafeHref));

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts[1]?.permalink).toBeUndefined();
  });

  it("ignores hostile page base state when resolving a relative permalink", () => {
    const result = extract(fixtureHtml.replace(
      "<head>",
      '<head><base href="https://other.example.test/redirect/">',
    ));

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts[0]?.permalink).toBe(`${pageUrl}#post-101`);
  });

  it.each([
    ['data-parent-id="101"', 'data-parent-id="999"', 1],
    ['data-post-id="101"', 'data-post-id="101" data-parent-id="102"', 0],
  ])("omits an unknown, self, or forward parent instead of creating a cycle", (before, after, index) => {
    const result = extract(fixtureHtml.replace(before, after));

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts[index]?.parentId).toBeUndefined();
  });

  it("rejects an empty selected post set after valid page detection", () => {
    const adapter = editableAdapter();
    adapter.detect = ["h1.thread-title"];
    expectFallback(
      extract(fixtureHtml.replaceAll('class="post"', 'class="entry"'), validate(adapter)),
      "no-posts",
      "$.posts",
    );
  });

  it("rejects a post set above the hard cap before reading any post fields", () => {
    const posts = Array.from(
      { length: ADAPTER_EXTRACTION_LIMITS.posts + 1 },
      (_, index) => `<article class="post" data-post-id="${index + 1}"></article>`,
    ).join("");
    expectFallback(
      extract(`<h1 class="thread-title">Synthetic</h1>${posts}`),
      "budget-exhausted",
      "$.posts",
    );
  });

  it("accepts exactly the hard post cap", () => {
    const posts = Array.from(
      { length: ADAPTER_EXTRACTION_LIMITS.posts },
      (_, index) => `
        <article class="post" data-post-id="${index + 1}">
          <span class="username">reader</span>
          <div class="post-body">reply</div>
        </article>`,
    ).join("");
    const result = extract(`<h1 class="thread-title">Synthetic</h1>${posts}`);

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts).toHaveLength(ADAPTER_EXTRACTION_LIMITS.posts);
  });

  it("accepts the derived selector, selected-node, and field-read maxima", () => {
    const adapter = editableAdapter();
    adapter.posts.fields.id.selector = ".post-id";
    if (adapter.posts.fields.parentId === undefined) {
      throw new Error("Expected a parent rule in the fixture adapter.");
    }
    adapter.posts.fields.parentId.selector = ".parent";
    const boundedAdapter = validate(adapter);
    const posts = Array.from(
      { length: ADAPTER_EXTRACTION_LIMITS.posts },
      (_, index) => {
        const id = String(index + 1);
        const parent = index === 0 ? "" : ` data-parent-id="${index}"`;
        return `
          <article class="post" data-post-id="${id}">
            <span class="post-id" data-post-id="${id}"></span>
            <span class="username">reader</span>
            <div class="post-body">reply</div>
            <time datetime="2026-07-16T08:00:00Z"></time>
            <span class="post-number"><a href="/threads/42#post-${id}">#</a></span>
            <span class="parent"${parent}></span>
          </article>`;
      },
    ).join("");
    const result = extract(
      `<h1 class="thread-title">Synthetic</h1>${posts}`,
      boundedAdapter,
    );

    expect(result).toMatchObject({ kind: "adapter" });
    if (result.kind !== "adapter") throw new Error("Expected adapter extraction.");
    expect(result.thread.posts).toHaveLength(ADAPTER_EXTRACTION_LIMITS.posts);
    expect(result.thread.posts[499]?.parentId).toBe("499");
  });

  it("rejects an overlong field without retaining a truncated value", () => {
    const oversized = "a".repeat(ADAPTER_EXTRACTION_LIMITS.textContentCodeUnits + 1);
    expectFallback(
      extract(fixtureHtml.replace("Opening thought with <strong>emphasis</strong>.", oversized)),
      "budget-exhausted",
      "$.posts[0].fields.content",
    );
  });

  it.each([
    {
      name: "thread title",
      path: "$.thread.title",
      exact: () => fixtureHtml.replace(
        "A small synthetic discussion",
        "t".repeat(ADAPTER_EXTRACTION_LIMITS.threadTitleCodeUnits),
      ),
      oversized: () => fixtureHtml.replace(
        "A small synthetic discussion",
        "t".repeat(ADAPTER_EXTRACTION_LIMITS.threadTitleCodeUnits + 1),
      ),
    },
    {
      name: "post ID",
      path: "$.posts[0].fields.id",
      exact: () => fixtureHtml.replace(
        'data-post-id="101"',
        `data-post-id="${"i".repeat(ADAPTER_EXTRACTION_LIMITS.postIdCodeUnits)}"`,
      ),
      oversized: () => fixtureHtml.replace(
        'data-post-id="101"',
        `data-post-id="${"i".repeat(ADAPTER_EXTRACTION_LIMITS.postIdCodeUnits + 1)}"`,
      ),
    },
    {
      name: "author",
      path: "$.posts[1].fields.author",
      exact: () => fixtureHtml.replace(
        "reader-two",
        "a".repeat(ADAPTER_EXTRACTION_LIMITS.authorCodeUnits),
      ),
      oversized: () => fixtureHtml.replace(
        "reader-two",
        "a".repeat(ADAPTER_EXTRACTION_LIMITS.authorCodeUnits + 1),
      ),
    },
    {
      name: "timestamp",
      path: "$.posts[0].fields.timestamp",
      exact: () => fixtureHtml.replace(
        "2026-07-16T08:00:00Z",
        "t".repeat(ADAPTER_EXTRACTION_LIMITS.timestampCodeUnits),
      ),
      oversized: () => fixtureHtml.replace(
        "2026-07-16T08:00:00Z",
        "t".repeat(ADAPTER_EXTRACTION_LIMITS.timestampCodeUnits + 1),
      ),
    },
    {
      name: "permalink",
      path: "$.posts[1].fields.permalink",
      exact: () => {
        const prefix = "https://forum.example.test/";
        const value = prefix + "p".repeat(ADAPTER_EXTRACTION_LIMITS.permalinkCodeUnits - prefix.length);
        return fixtureHtml.replace("/threads/42#post-102", value);
      },
      oversized: () => {
        const prefix = "https://forum.example.test/";
        const value = prefix + "p".repeat(ADAPTER_EXTRACTION_LIMITS.permalinkCodeUnits + 1 - prefix.length);
        return fixtureHtml.replace("/threads/42#post-102", value);
      },
    },
    {
      name: "parent ID",
      path: "$.posts[1].fields.parentId",
      exact: () => fixtureHtml.replace(
        'data-parent-id="101"',
        `data-parent-id="${"p".repeat(ADAPTER_EXTRACTION_LIMITS.parentIdCodeUnits)}"`,
      ),
      oversized: () => fixtureHtml.replace(
        'data-parent-id="101"',
        `data-parent-id="${"p".repeat(ADAPTER_EXTRACTION_LIMITS.parentIdCodeUnits + 1)}"`,
      ),
    },
    {
      name: "plain content",
      path: "$.posts[0].fields.content",
      exact: () => fixtureHtml.replace(
        "Opening thought with <strong>emphasis</strong>.",
        "c".repeat(ADAPTER_EXTRACTION_LIMITS.textContentCodeUnits),
      ),
      oversized: () => fixtureHtml.replace(
        "Opening thought with <strong>emphasis</strong>.",
        "c".repeat(ADAPTER_EXTRACTION_LIMITS.textContentCodeUnits + 1),
      ),
    },
    {
      name: "serialized HTML",
      path: "$.posts[0].fields.content",
      exact: () => fixtureHtml.replace(
        "<p>Opening thought with <strong>emphasis</strong>.</p>",
        `<span data-x="${"h".repeat(ADAPTER_EXTRACTION_LIMITS.htmlContentCodeUnits - 23)}"></span>`,
      ),
      oversized: () => fixtureHtml.replace(
        "<p>Opening thought with <strong>emphasis</strong>.</p>",
        `<span data-x="${"h".repeat(ADAPTER_EXTRACTION_LIMITS.htmlContentCodeUnits - 22)}"></span>`,
      ),
    },
  ])("accepts the exact $name limit and rejects one code unit more", ({ exact, oversized, path }) => {
    expect(extract(exact())).toMatchObject({ kind: "adapter" });
    expectFallback(extract(oversized()), "budget-exhausted", path);
  });

  it("caps aggregate retained content independently of per-field limits", () => {
    const adapter = editableAdapter();
    delete adapter.posts.fields.timestamp;
    delete adapter.posts.fields.permalink;
    delete adapter.posts.fields.parentId;
    const boundedAdapter = validate(adapter);
    const body = "x".repeat(17_000);
    const posts = Array.from({ length: ADAPTER_EXTRACTION_LIMITS.posts }, (_, index) => ({
      nodeType: 1,
      tagName: "ARTICLE",
      attributes: nodeList([]),
      childNodes: nodeList([]),
      matches: () => true,
      getAttribute(attribute: string) {
        return attribute === "data-post-id" ? String(index + 1) : null;
      },
      querySelector(selector: string) {
        if (selector === ".username") return syntheticTextElement("reader");
        if (selector === ".post-body") return syntheticTextElement(body);
        return null;
      },
    }));
    const title = syntheticTextElement("Synthetic", "H1");
    const root = {
      childNodes: nodeList(posts),
      querySelector(selector: string) {
        if (selector === "h1.thread-title") return title;
        if (selector === ".post[data-post-id]") return posts[0] ?? null;
        return null;
      },
    };

    expectFallback(
      extractThreadWithAdapter(boundedAdapter, pageUrl, root as unknown as ParentNode),
      "budget-exhausted",
    );
  });

  it("caps raw text work even when whitespace normalization retains almost nothing", () => {
    const adapter = editableAdapter();
    adapter.posts.fields.content = { selector: ".post-body", source: "text" };
    delete adapter.posts.fields.timestamp;
    delete adapter.posts.fields.permalink;
    delete adapter.posts.fields.parentId;
    const boundedAdapter = validate(adapter);
    const author = syntheticTextElement("reader");
    const body = syntheticTextElement(" ".repeat(34_000), "DIV");
    const posts = Array.from({ length: ADAPTER_EXTRACTION_LIMITS.posts }, (_, index) => ({
      nodeType: 1,
      tagName: "ARTICLE",
      attributes: nodeList([]),
      childNodes: nodeList([]),
      matches: () => true,
      getAttribute(attribute: string) {
        return attribute === "data-post-id" ? String(index + 1) : null;
      },
      querySelector(selector: string) {
        if (selector === ".username") return author;
        if (selector === ".post-body") return body;
        return null;
      },
    }));
    const title = syntheticTextElement("Synthetic", "H1");
    const root = {
      childNodes: nodeList(posts),
      querySelector(selector: string) {
        if (selector === "h1.thread-title") return title;
        if (selector === ".post[data-post-id]") return posts[0] ?? null;
        return null;
      },
    };

    expectFallback(
      extractThreadWithAdapter(boundedAdapter, pageUrl, root as unknown as ParentNode),
      "budget-exhausted",
    );
  });

  it("rejects an oversized child collection before indexing it", () => {
    const adapter = editableAdapter();
    delete adapter.posts.fields.timestamp;
    delete adapter.posts.fields.permalink;
    delete adapter.posts.fields.parentId;
    const boundedAdapter = validate(adapter);
    let itemCalls = 0;
    const body = {
      nodeType: 1,
      tagName: "DIV",
      attributes: nodeList([]),
      childNodes: {
        length: ADAPTER_EXTRACTION_LIMITS.domNodes + 1,
        item() {
          itemCalls += 1;
          throw new Error("must not index an oversized child collection");
        },
      },
      getAttribute: () => null,
      querySelector: () => null,
    };
    const author = syntheticTextElement("reader");
    const post = {
      nodeType: 1,
      tagName: "ARTICLE",
      attributes: nodeList([]),
      childNodes: nodeList([]),
      matches: () => true,
      getAttribute(attribute: string) {
        return attribute === "data-post-id" ? "1" : null;
      },
      querySelector(selector: string) {
        if (selector === ".username") return author;
        if (selector === ".post-body") return body;
        return null;
      },
    };
    const title = syntheticTextElement("Synthetic", "H1");
    const root = {
      childNodes: nodeList([post]),
      querySelector(selector: string) {
        if (selector === "h1.thread-title") return title;
        if (selector === ".post[data-post-id]") return post;
        return null;
      },
    };

    expectFallback(
      extractThreadWithAdapter(boundedAdapter, pageUrl, root as unknown as ParentNode),
      "budget-exhausted",
      "$.posts[0].fields.content",
    );
    expect(itemCalls).toBe(0);
  });

  it("rejects an oversized attribute collection before indexing it", () => {
    const adapter = editableAdapter();
    delete adapter.posts.fields.timestamp;
    delete adapter.posts.fields.permalink;
    delete adapter.posts.fields.parentId;
    const boundedAdapter = validate(adapter);
    let itemCalls = 0;
    const child = {
      nodeType: 1,
      tagName: "SPAN",
      attributes: {
        length: ADAPTER_EXTRACTION_LIMITS.htmlAttributes + 1,
        item() {
          itemCalls += 1;
          throw new Error("must not index an oversized attribute collection");
        },
      },
      childNodes: nodeList([]),
    };
    const body = {
      nodeType: 1,
      tagName: "DIV",
      attributes: nodeList([]),
      childNodes: nodeList([child]),
      getAttribute: () => null,
      querySelector: () => null,
    };
    const author = syntheticTextElement("reader");
    const post = {
      nodeType: 1,
      tagName: "ARTICLE",
      attributes: nodeList([]),
      childNodes: nodeList([]),
      matches: () => true,
      getAttribute(attribute: string) {
        return attribute === "data-post-id" ? "1" : null;
      },
      querySelector(selector: string) {
        if (selector === ".username") return author;
        if (selector === ".post-body") return body;
        return null;
      },
    };
    const title = syntheticTextElement("Synthetic", "H1");
    const root = {
      childNodes: nodeList([post]),
      querySelector(selector: string) {
        if (selector === "h1.thread-title") return title;
        if (selector === ".post[data-post-id]") return post;
        return null;
      },
    };

    expectFallback(
      extractThreadWithAdapter(boundedAdapter, pageUrl, root as unknown as ParentNode),
      "budget-exhausted",
      "$.posts[0].fields.content",
    );
    expect(itemCalls).toBe(0);
  });

  it("stops after the first over-budget post without indexing the remainder", () => {
    const post = {
      nodeType: 1,
      childNodes: nodeList([]),
      matches: () => true,
    };
    let itemCalls = 0;
    const root = {
      childNodes: {
        length: 1_000,
        item() {
          itemCalls += 1;
          return post;
        },
      },
      querySelector: () => post,
    };

    expectFallback(
      extractThreadWithAdapter(loadAdapter(), pageUrl, root as unknown as ParentNode),
      "budget-exhausted",
      "$.posts",
    );
    expect(itemCalls).toBe(ADAPTER_EXTRACTION_LIMITS.posts + 1);
  });

  it("contains DOM read failures and rejects forged validated values", () => {
    const { document } = parseHTML(fixtureHtml);
    let childItemCalls = 0;
    const throwingRoot = {
      querySelector: document.querySelector.bind(document),
      childNodes: {
        length: 1,
        item() {
          childItemCalls += 1;
          throw new Error("synthetic DOM failure");
        },
      },
    };
    expectFallback(
      extractThreadWithAdapter(loadAdapter(), pageUrl, throwingRoot as unknown as ParentNode),
      "query-failed",
      "$.posts",
    );
    expect(childItemCalls).toBe(1);

    const throwingMatch = {
      nodeType: 1,
      childNodes: nodeList([]),
      matches() {
        throw new Error("private selector detail");
      },
    };
    expect(
      extractThreadWithAdapter(
        loadAdapter(),
        pageUrl,
        {
          childNodes: nodeList([throwingMatch]),
          querySelector: () => throwingMatch,
        } as unknown as ParentNode,
      ),
    ).toEqual({ kind: "generic", reason: "query-failed", path: "$.posts" });

    expectFallback(
      extractThreadWithAdapter(
        editableAdapter() as ValidatedForumForgeAdapterV1,
        pageUrl,
        document as unknown as ParentNode,
      ),
      "invalid-registry",
    );
  });

  it("contains hostile field accessors without exposing exception details", () => {
    const adapter = editableAdapter();
    delete adapter.posts.fields.timestamp;
    delete adapter.posts.fields.permalink;
    delete adapter.posts.fields.parentId;
    const boundedAdapter = validate(adapter);
    const title = syntheticTextElement("Synthetic", "H1");
    const author = syntheticTextElement("reader");

    const run = (post: object) => extractThreadWithAdapter(
      boundedAdapter,
      pageUrl,
      {
        childNodes: nodeList([post]),
        querySelector(selector: string) {
          if (selector === "h1.thread-title") return title;
          if (selector === ".post[data-post-id]") return post;
          return null;
        },
      } as unknown as ParentNode,
    );
    const makePost = (body: object, getId: () => string | null = () => "1") => ({
      nodeType: 1,
      tagName: "ARTICLE",
      attributes: nodeList([]),
      childNodes: nodeList([]),
      matches: () => true,
      getAttribute: getId,
      querySelector(selector: string) {
        if (selector === ".username") return author;
        if (selector === ".post-body") return body;
        return null;
      },
    });

    const safeBody = syntheticTextElement("reply", "DIV");
    expect(run(makePost(safeBody, () => {
      throw new Error("private attribute detail");
    }))).toEqual({
      kind: "generic",
      reason: "query-failed",
      path: "$.posts[0].fields.id",
    });

    const throwingText = {
      nodeType: 1,
      tagName: "DIV",
      attributes: nodeList([]),
      childNodes: nodeList([{
        nodeType: 3,
        get length() {
          throw new Error("private text detail");
        },
      }]),
      getAttribute: () => null,
      querySelector: () => null,
    };
    expect(run(makePost(throwingText))).toEqual({
      kind: "generic",
      reason: "query-failed",
      path: "$.posts[0].fields.content",
    });

    const throwingAttributes = {
      nodeType: 1,
      tagName: "SPAN",
      get attributes() {
        throw new Error("private markup detail");
      },
      childNodes: nodeList([]),
    };
    const bodyWithThrowingChild = {
      nodeType: 1,
      tagName: "DIV",
      attributes: nodeList([]),
      childNodes: nodeList([throwingAttributes]),
      getAttribute: () => null,
      querySelector: () => null,
    };
    expect(run(makePost(bodyWithThrowingChild))).toEqual({
      kind: "generic",
      reason: "query-failed",
      path: "$.posts[0].fields.content",
    });
  });

  it("never materializes native innerHTML and marks serialized HTML as untrusted", () => {
    const { document } = parseHTML(fixtureHtml);
    const body = document.querySelector(".post-body");
    if (body === null) throw new Error("Expected fixture body.");
    Object.defineProperty(body, "innerHTML", {
      configurable: true,
      get() {
        throw new Error("innerHTML must not be read");
      },
    });

    const result = extractThreadWithAdapter(
      loadAdapter(),
      pageUrl,
      document as unknown as ParentNode,
    );
    expect(result).toMatchObject({
      kind: "adapter",
      htmlTrust: "untrusted-page-html",
    });
  });

  it("degrades a semantic layout that version 1 cannot map to linear", () => {
    const adapter = editableAdapter();
    adapter.layout = "qa";
    const result = extract(fixtureHtml, validate(adapter));

    expect(result).toMatchObject({ kind: "adapter", thread: { layout: "linear" } });
  });
});
