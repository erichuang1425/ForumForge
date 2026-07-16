import { describe, expect, it } from "vitest";
import {
  ADAPTER_READ_ATTRIBUTES,
  ADAPTER_SCHEMA_VERSION,
  adapterV1Schema,
  type ForumForgeAdapterV1,
} from "../src/index";

const exampleAdapter: ForumForgeAdapterV1 = {
  schemaVersion: 1,
  id: "example-forum",
  name: "Example Forum",
  matches: [
    {
      origin: "https://forum.example.test",
      pathname: "/threads/*",
    },
  ],
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
      permalink: { selector: ".post-number a", source: "attribute", attribute: "href" },
    },
  },
};

describe("adapter v1 schema contract", () => {
  it("exports one explicit data-only schema version", () => {
    expect(ADAPTER_SCHEMA_VERSION).toBe(1);
    expect(adapterV1Schema).toMatchObject({
      $id: "urn:forumforge:adapter:1",
      additionalProperties: false,
      properties: { schemaVersion: { const: 1 } },
    });
    expect(exampleAdapter.schemaVersion).toBe(ADAPTER_SCHEMA_VERSION);
    expect(adapterV1Schema.$comment).toContain("parseAdapterJson()");
    expect(adapterV1Schema.$comment).toContain("schema-only acceptance is unsupported");
  });

  it("keeps executable and network capabilities outside the v1 vocabulary", () => {
    const propertyNames = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (typeof value !== "object" || value === null) return;
      for (const [key, nested] of Object.entries(value)) {
        if (key === "properties") {
          for (const property of Object.keys(nested as Record<string, unknown>)) {
            propertyNames.add(property);
          }
        }
        visit(nested);
      }
    };
    visit(adapterV1Schema);

    for (const forbidden of [
      "actions",
      "script",
      "code",
      "expression",
      "function",
      "url",
      "request",
      "headers",
      "module",
      "observer",
      "pagination",
      "remote",
      "template",
      "transform",
      "regex",
    ]) {
      expect(propertyNames.has(forbidden)).toBe(false);
    }
  });

  it("closes every object vocabulary and bounds matching and selectors", () => {
    expect(adapterV1Schema.properties.matches).toMatchObject({ maxItems: 16 });
    expect(adapterV1Schema.properties.detect).toMatchObject({ maxItems: 8 });
    expect(adapterV1Schema.$defs.selector).toMatchObject({ maxLength: 256 });
    expect(adapterV1Schema.$defs.attributeName.enum).not.toContain("onclick");
    expect(adapterV1Schema.$defs.urlMatch).toMatchObject({ additionalProperties: false });
    expect(adapterV1Schema.$defs.selectedTextRead).toMatchObject({
      additionalProperties: false,
      required: ["selector", "source"],
    });
    expect(adapterV1Schema.$defs.threadRules).toMatchObject({ additionalProperties: false });
    expect(adapterV1Schema.$defs.postRules).toMatchObject({ additionalProperties: false });
    expect(adapterV1Schema.$defs.postFields).toMatchObject({ additionalProperties: false });
  });

  it("ships compilable gross patterns while runtime validation stays authoritative", () => {
    const selectorPattern = new RegExp(adapterV1Schema.$defs.selector.pattern);
    const pathnamePattern = new RegExp(adapterV1Schema.$defs.urlMatch.properties.pathname.pattern);

    expect(selectorPattern.test(".post[data-post-id]")).toBe(true);
    expect(selectorPattern.test(".post:HAS(span)")).toBe(false);
    expect(selectorPattern.test(".post:h\\61s(span)")).toBe(false);
    expect(pathnamePattern.test("/threads/*/posts/*")).toBe(true);
    expect(pathnamePattern.test("/threads/**")).toBe(false);
    expect(pathnamePattern.test(`/${"*a".repeat(9)}`)).toBe(false);
  });

  it("narrows attribute reads by destination in its structural vocabulary", () => {
    expect(adapterV1Schema.$defs.attributeName.enum).toEqual(ADAPTER_READ_ATTRIBUTES);
    expect(adapterV1Schema.$defs.authorAttributeRead.allOf[1]).toMatchObject({
      properties: { attribute: { enum: expect.not.arrayContaining(["href"]) } },
    });
    expect(adapterV1Schema.$defs.permalinkAttributeRead.allOf[1]).toMatchObject({
      properties: { attribute: { const: "href" } },
    });
    expect(adapterV1Schema.$defs.postFields.properties).toMatchObject({
      id: { $ref: "#/$defs/idRead" },
      author: { $ref: "#/$defs/authorRead" },
      permalink: { $ref: "#/$defs/permalinkRead" },
    });
  });
});
