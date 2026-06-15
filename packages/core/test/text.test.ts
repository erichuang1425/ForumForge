import { describe, it, expect } from "vitest";
import { normalizeWhitespace, cleanText, dedupeLinks } from "../src/index";

describe("normalizeWhitespace", () => {
  it("collapses runs of whitespace and trims", () => {
    expect(normalizeWhitespace("  hello   world \n\t! ")).toBe("hello world !");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeWhitespace("   \n  ")).toBe("");
  });
});

describe("cleanText", () => {
  it("returns an empty string for nullish input", () => {
    expect(cleanText(undefined)).toBe("");
    expect(cleanText(null)).toBe("");
  });

  it("normalizes newlines and trims spaces around line breaks", () => {
    expect(cleanText("line one  \r\n  line two")).toBe("line one\nline two");
  });

  it("preserves a single blank line but caps longer runs", () => {
    expect(cleanText("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("dedupeLinks", () => {
  it("drops duplicates and empties while preserving order", () => {
    expect(dedupeLinks(["  a ", "b", "a", "", "  ", "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns an empty array for undefined", () => {
    expect(dedupeLinks(undefined)).toEqual([]);
  });
});
