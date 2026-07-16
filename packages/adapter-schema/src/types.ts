export const ADAPTER_SCHEMA_VERSION = 1 as const;

export type AdapterLayout =
  | "linear"
  | "article-comments"
  | "nested"
  | "ptt"
  | "imageboard"
  | "qa";

export type AdapterUrlMatchV1 = {
  origin: string;
  pathname: string;
};

export type AdapterTextReadV1 = {
  selector?: string;
  source: "text";
};

export const ADAPTER_READ_ATTRIBUTES = [
  "aria-label",
  "data-author",
  "data-id",
  "data-parent",
  "data-parent-id",
  "data-post-id",
  "data-time",
  "data-timestamp",
  "data-username",
  "datetime",
  "href",
  "id",
  "name",
  "title",
] as const;

export type AdapterReadAttribute = (typeof ADAPTER_READ_ATTRIBUTES)[number];
export type AdapterThreadTitleAttribute = "aria-label" | "title";
export type AdapterIdAttribute = "data-id" | "data-post-id" | "id" | "name";
export type AdapterAuthorAttribute = "aria-label" | "data-author" | "data-username" | "title";
export type AdapterTimestampAttribute = "data-time" | "data-timestamp" | "datetime" | "title";
export type AdapterPermalinkAttribute = "href";
export type AdapterParentIdAttribute = "data-parent" | "data-parent-id";

export type AdapterAttributeReadV1<
  Attribute extends AdapterReadAttribute = AdapterReadAttribute,
> = {
  selector?: string;
  source: "attribute";
  attribute: Attribute;
};

export type AdapterHtmlReadV1 = {
  selector?: string;
  source: "html";
};

export type AdapterScalarReadV1 = AdapterTextReadV1 | AdapterAttributeReadV1;
export type AdapterContentReadV1 = AdapterTextReadV1 | AdapterHtmlReadV1;
export type AdapterSelectedTextReadV1 = AdapterTextReadV1 & { selector: string };
export type AdapterSelectedAttributeReadV1<
  Attribute extends AdapterReadAttribute = AdapterReadAttribute,
> = AdapterAttributeReadV1<Attribute> & { selector: string };
export type AdapterThreadTitleReadV1 =
  | AdapterSelectedTextReadV1
  | AdapterSelectedAttributeReadV1<AdapterThreadTitleAttribute>;

export type AdapterPostFieldsV1 = {
  id: AdapterTextReadV1 | AdapterAttributeReadV1<AdapterIdAttribute>;
  author: AdapterTextReadV1 | AdapterAttributeReadV1<AdapterAuthorAttribute>;
  content: AdapterContentReadV1;
  timestamp?: AdapterTextReadV1 | AdapterAttributeReadV1<AdapterTimestampAttribute>;
  permalink?: AdapterTextReadV1 | AdapterAttributeReadV1<AdapterPermalinkAttribute>;
  parentId?: AdapterTextReadV1 | AdapterAttributeReadV1<AdapterParentIdAttribute>;
};

export type ForumForgeAdapterV1 = {
  schemaVersion: typeof ADAPTER_SCHEMA_VERSION;
  id: string;
  name: string;
  matches: AdapterUrlMatchV1[];
  detect: string[];
  layout?: AdapterLayout;
  thread: {
    title: AdapterThreadTitleReadV1;
  };
  posts: {
    selector: string;
    fields: AdapterPostFieldsV1;
  };
};
