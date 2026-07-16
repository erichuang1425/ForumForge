export type {
  ForumForgePost,
  ForumPostKind,
  ForumReaction,
  ForumRole,
} from "./post";
export { createPost, isForumForgePost, type PostInput } from "./factory";
export { normalizeWhitespace, cleanText, dedupeLinks } from "./text";
