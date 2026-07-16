import type { ExtractedThread, ThreadLayout, ThreadSource } from "@forumforge/parser";

export type PreviewState = "open" | "launcher";

export type PreviewStory = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly lang: string;
  readonly sourceUrl: string;
  readonly thread: ExtractedThread & {
    readonly layout: ThreadLayout;
    readonly source: ThreadSource;
  };
  readonly newPostIds: readonly string[];
  readonly savedPostIds: readonly string[];
  readonly userNotes: readonly (readonly [author: string, note: string])[];
};

/*
 * Hand-authored, synthetic discussion data for local visual review. The prose,
 * identities, and reserved .example URLs do not come from live communities.
 */
export const PREVIEW_STORIES: readonly PreviewStory[] = [
  {
    id: "nairaland",
    label: "Nairaland · Linear",
    description: "A long-form topic followed by a chronological community discussion.",
    lang: "en",
    sourceUrl: "https://nairaland.example/topic/2048",
    thread: {
      title: "How can a neighbourhood reading room stay useful after opening week?",
      baseUrl: "https://nairaland.example/topic/2048",
      layout: "linear",
      source: "nairaland",
      posts: [
        {
          id: "2048",
          author: "CommunityDesk",
          role: "op",
          kind: "topic",
          timestamp: "08:15",
          contentText:
            "We converted an unused kiosk into a small reading room. What routines make a shared space last?",
          contentHtml:
            "<p>We converted an unused kiosk into a small reading room. What routines make a shared space <strong>last beyond opening week</strong>?</p><p>The room has twelve seats, a noticeboard, and a volunteer key rota.</p>",
          permalink: "https://nairaland.example/topic/2048#2048",
          depth: 0,
        },
        {
          id: "2049",
          author: "Mira North",
          timestamp: "08:44",
          contentText: "Publish the rota where everyone can see it and keep the rules short.",
          contentHtml:
            "<p>Publish the rota where everyone can see it. Keep the rules short enough to fit on one card, then review them with volunteers after a month.</p>",
          permalink: "https://nairaland.example/topic/2048#2049",
          depth: 0,
        },
        {
          id: "2050",
          author: "Ayo Fieldnotes",
          timestamp: "09:03",
          contentText: "A weekly bring-one-book table worked well for our block.",
          contentHtml:
            "<p>A weekly <em>bring-one-book</em> table worked well for our block. It created a small recurring reason to visit without turning the room into an event venue.</p>",
          permalink: "https://nairaland.example/topic/2048#2050",
          depth: 0,
        },
        {
          id: "2051",
          author: "CommunityDesk",
          role: "op",
          timestamp: "09:27",
          contentText: "The one-card rule and recurring table both feel manageable.",
          contentHtml:
            "<p>The one-card rule and recurring table both feel manageable. I will bring those to Saturday's volunteer check-in.</p>",
          permalink: "https://nairaland.example/topic/2048#2051",
          depth: 0,
        },
      ],
    },
    newPostIds: ["2050", "2051"],
    savedPostIds: ["2049"],
    userNotes: [["Ayo Fieldnotes", "Practical examples from another community space."]],
  },
  {
    id: "hacker-news",
    label: "Hacker News · Nested",
    description: "A compact branching conversation with deliberately deep replies.",
    lang: "en",
    sourceUrl: "https://hacker-news.example/item?id=41001",
    thread: {
      title: "Ask HN: What makes a digital archive pleasant to browse?",
      baseUrl: "https://hacker-news.example/item?id=41001",
      layout: "nested",
      source: "hacker-news",
      posts: [
        {
          id: "41001",
          author: "papertrail",
          role: "op",
          kind: "article",
          score: 184,
          timestamp: "3 hours ago",
          contentText:
            "I am collecting examples of archives that reward wandering without hiding their structure.",
          contentHtml:
            "<p>I am collecting examples of archives that reward wandering without hiding their structure. What makes the experience work?</p>",
          permalink: "https://hacker-news.example/item?id=41001",
          depth: 0,
        },
        {
          id: "41002",
          author: "marginalia",
          kind: "comment",
          timestamp: "2 hours ago",
          parentId: "41001",
          depth: 1,
          contentText: "Stable URLs and visible context matter more to me than animation.",
          contentHtml:
            "<p>Stable URLs and visible context matter more to me than animation. I want to know where an item lives before opening it.</p>",
          permalink: "https://hacker-news.example/item?id=41002",
        },
        {
          id: "41003",
          author: "gridless",
          kind: "comment",
          timestamp: "2 hours ago",
          parentId: "41002",
          depth: 2,
          contentText: "That context can be as small as a path and neighbouring items.",
          contentHtml:
            "<p>That context can be as small as a path and two neighbouring items. The archive does not need a dashboard.</p>",
          permalink: "https://hacker-news.example/item?id=41003",
        },
        {
          id: "41004",
          author: "quietindex",
          kind: "comment",
          timestamp: "1 hour ago",
          parentId: "41003",
          depth: 3,
          contentText: "A restrained index also makes older material feel intentional.",
          permalink: "https://hacker-news.example/item?id=41004",
        },
        {
          id: "41005",
          author: "shelflife",
          kind: "comment",
          timestamp: "52 minutes ago",
          parentId: "41004",
          depth: 4,
          contentText: "The typography has to survive long titles and uncertain metadata.",
          permalink: "https://hacker-news.example/item?id=41005",
        },
        {
          id: "41006",
          author: "marginalia",
          kind: "comment",
          timestamp: "41 minutes ago",
          parentId: "41005",
          depth: 5,
          contentText: "Exactly; graceful missing fields are part of the visual design.",
          permalink: "https://hacker-news.example/item?id=41006",
        },
      ],
    },
    newPostIds: ["41005", "41006"],
    savedPostIds: ["41002"],
    userNotes: [["marginalia", "Strong information-architecture perspective."]],
  },
  {
    id: "ptt",
    label: "PTT · Article + reactions",
    description: "Traditional Chinese article text with explicit push, neutral, and boo rows.",
    lang: "zh-Hant",
    sourceUrl: "https://ptt.example/bbs/design/M.2048.html",
    thread: {
      title: "[心得] 讓長篇討論更容易閱讀的小改動",
      baseUrl: "https://ptt.example/bbs/design/M.2048.html",
      layout: "ptt",
      source: "ptt",
      posts: [
        {
          id: "article",
          author: "pagecraft",
          role: "op",
          kind: "article",
          timestamp: "07/16 10:20",
          contentText:
            "整理社群舊文時，我發現清楚的段落、適當的行距，以及保留回應脈絡最重要。",
          contentHtml:
            "<p>整理社群舊文時，我發現清楚的段落、適當的行距，以及保留回應脈絡最重要。</p><p>介面不必把原站變成另一種產品；它應該讓內容更容易呼吸。</p>",
          permalink: "https://ptt.example/bbs/design/M.2048.html",
          depth: 0,
        },
        {
          id: "push-1",
          author: "slowreader",
          kind: "comment",
          reaction: "push",
          timestamp: "07/16 10:31",
          parentId: "article",
          depth: 1,
          contentText: "推，保留原本討論的個性很重要。",
          permalink: "https://ptt.example/bbs/design/M.2048.html#push-1",
        },
        {
          id: "push-2",
          author: "inkstone",
          kind: "comment",
          reaction: "neutral",
          timestamp: "07/16 10:44",
          parentId: "article",
          depth: 1,
          contentText: "→ 窄螢幕也要保留重新整理與返回功能。",
          permalink: "https://ptt.example/bbs/design/M.2048.html#push-2",
        },
        {
          id: "push-3",
          author: "contrastlab",
          kind: "comment",
          reaction: "boo",
          timestamp: "07/16 11:02",
          parentId: "article",
          depth: 1,
          contentText: "噓，只靠顏色區分推噓會看不懂。",
          permalink: "https://ptt.example/bbs/design/M.2048.html#push-3",
        },
      ],
    },
    newPostIds: ["push-3"],
    savedPostIds: ["push-2"],
    userNotes: [],
  },
  {
    id: "4chan",
    label: "4chan · Imageboard",
    description: "Source-numbered compact posts without invented profile cards or remote media.",
    lang: "en",
    sourceUrl: "https://imageboard.example/thread/7719",
    thread: {
      title: "Small museums with unusually good wayfinding",
      baseUrl: "https://imageboard.example/thread/7719",
      layout: "imageboard",
      source: "4chan",
      posts: [
        {
          id: "7719",
          author: "Anonymous",
          kind: "topic",
          timestamp: "07/16/26 Thu 11:08",
          contentText: "Share small museums where the signs help rather than compete with the collection.",
          contentHtml:
            "<p>Share small museums where the signs help rather than compete with the collection. No giant touchscreen examples, please.</p>",
          permalink: "https://imageboard.example/thread/7719#p7719",
          depth: 0,
        },
        {
          id: "7721",
          author: "Anonymous",
          kind: "reply",
          timestamp: "07/16/26 Thu 11:19",
          parentId: "7719",
          depth: 1,
          contentText: ">>7719 The local print archive uses one colour per floor and plain arrows.",
          contentHtml:
            "<p><a href=\"#p7719\">&gt;&gt;7719</a> The local print archive uses one colour per floor and plain arrows.</p>",
          permalink: "https://imageboard.example/thread/7719#p7721",
        },
        {
          id: "7724",
          author: "MapFold",
          kind: "reply",
          timestamp: "07/16/26 Thu 11:43",
          parentId: "7719",
          depth: 1,
          contentText: "The best one I saw printed the full route on the ticket sleeve.",
          permalink: "https://imageboard.example/thread/7719#p7724",
        },
        {
          id: "7730",
          author: "Anonymous",
          kind: "reply",
          timestamp: "07/16/26 Thu 12:07",
          parentId: "7724",
          depth: 1,
          contentText: ">>7724 That works even when the building has poor reception.",
          contentHtml:
            "<p><a href=\"#p7724\">&gt;&gt;7724</a> That works even when the building has poor reception.</p>",
          permalink: "https://imageboard.example/thread/7719#p7730",
        },
      ],
    },
    newPostIds: ["7730"],
    savedPostIds: ["7724"],
    userNotes: [],
  },
  {
    id: "arca",
    label: "Arca · Article + nested comments",
    description: "A Korean article lead with compact, nested community comments.",
    lang: "ko",
    sourceUrl: "https://arca.example/b/reading/3301",
    thread: {
      title: "오래된 게시판을 읽기 편하게 만드는 기준",
      baseUrl: "https://arca.example/b/reading/3301",
      layout: "article-comments",
      source: "arca",
      posts: [
        {
          id: "3301",
          author: "책갈피",
          role: "op",
          kind: "article",
          timestamp: "2026.07.16 12:20",
          contentText: "게시판의 개성을 지우지 않으면서 본문과 댓글의 위계를 정리해 보았습니다.",
          contentHtml:
            "<p>게시판의 개성을 지우지 않으면서 본문과 댓글의 위계를 정리해 보았습니다.</p><p><strong>본문은 차분하게, 댓글은 관계가 보이게</strong> 만드는 것이 핵심입니다.</p>",
          permalink: "https://arca.example/b/reading/3301",
          depth: 0,
        },
        {
          id: "3302",
          author: "여백",
          kind: "comment",
          timestamp: "12:31",
          parentId: "3301",
          depth: 1,
          contentText: "댓글 간격이 너무 넓으면 대화의 속도가 사라지는 것 같아요.",
          permalink: "https://arca.example/b/reading/3301#c_3302",
        },
        {
          id: "3303",
          author: "책갈피",
          role: "op",
          kind: "comment",
          timestamp: "12:38",
          parentId: "3302",
          depth: 2,
          contentText: "맞아요. 본문보다 조밀하지만 답글 관계는 분명해야 합니다.",
          permalink: "https://arca.example/b/reading/3301#c_3303",
        },
        {
          id: "3304",
          author: "모서리",
          kind: "comment",
          timestamp: "12:52",
          parentId: "3301",
          depth: 1,
          contentText: "이미지를 불러오지 않아도 대화 자체가 완전해야 합니다.",
          permalink: "https://arca.example/b/reading/3301#c_3304",
        },
      ],
    },
    newPostIds: ["3304"],
    savedPostIds: ["3302"],
    userNotes: [["여백", "Good observation about conversational density."]],
  },
  {
    id: "dc-inside",
    label: "DC Inside · Article + comments",
    description: "A dense gallery article reorganized into a calm reading hierarchy.",
    lang: "ko",
    sourceUrl: "https://dcinside.example/board/view/?id=design&no=581",
    thread: {
      title: "작은 화면에서 긴 글을 읽을 때 필요한 것",
      baseUrl: "https://dcinside.example/board/view/?id=design&no=581",
      layout: "article-comments",
      source: "dc-inside",
      posts: [
        {
          id: "581",
          author: "종이화면",
          role: "op",
          kind: "article",
          timestamp: "2026.07.16 13:12",
          contentText: "작은 화면에서는 기능을 숨기는 것보다 우선순위를 또렷하게 보여 주는 편이 낫습니다.",
          contentHtml:
            "<p>작은 화면에서는 기능을 숨기는 것보다 우선순위를 또렷하게 보여 주는 편이 낫습니다.</p><blockquote>돌아가기, 새로고침, 보관함은 항상 찾을 수 있어야 합니다.</blockquote>",
          permalink: "https://dcinside.example/board/view/?id=design&no=581",
          depth: 0,
        },
        {
          id: "582",
          author: "ㅇㅇ",
          kind: "comment",
          timestamp: "13:18",
          parentId: "581",
          depth: 1,
          contentText: "아이콘만 쓸 때도 접근성 이름은 남겨야 함.",
          permalink: "https://dcinside.example/board/view/?id=design&no=581#582",
        },
        {
          id: "583",
          author: "layoutlog",
          kind: "comment",
          timestamp: "13:26",
          parentId: "581",
          depth: 1,
          contentText: "본문 줄 길이가 일정하면 확대해도 훨씬 안정적이네요.",
          permalink: "https://dcinside.example/board/view/?id=design&no=581#583",
        },
      ],
    },
    newPostIds: ["583"],
    savedPostIds: [],
    userNotes: [],
  },
  {
    id: "fmkorea",
    label: "FMKorea · Article + reply chains",
    description: "A lively Korean article discussion with explicit reply relationships.",
    lang: "ko",
    sourceUrl: "https://fmkorea.example/reading/9042",
    thread: {
      title: "커뮤니티 글을 뉴스 피드처럼 만들지 않아도 되는 이유",
      baseUrl: "https://fmkorea.example/reading/9042",
      layout: "article-comments",
      source: "fmkorea",
      posts: [
        {
          id: "9042",
          author: "서체연구",
          role: "op",
          kind: "article",
          timestamp: "2026.07.16 14:01",
          contentText: "포럼은 글과 답글의 리듬이 중요해서 일반적인 카드 피드와 다르게 다뤄야 합니다.",
          contentHtml:
            "<p>포럼은 글과 답글의 리듬이 중요해서 일반적인 카드 피드와 다르게 다뤄야 합니다.</p><p>원문, 답글, 작성자 맥락을 지키면서 시각적 소음만 줄이는 방향이 좋습니다.</p>",
          permalink: "https://fmkorea.example/reading/9042",
          depth: 0,
        },
        {
          id: "9043",
          author: "steadyline",
          kind: "comment",
          timestamp: "14:09",
          parentId: "9042",
          depth: 1,
          contentText: "카드마다 그림자를 강하게 넣으면 오히려 댓글 흐름이 끊겨 보여요.",
          permalink: "https://fmkorea.example/reading/9042#comment_9043",
        },
        {
          id: "9044",
          author: "서체연구",
          role: "op",
          kind: "comment",
          timestamp: "14:14",
          parentId: "9043",
          depth: 2,
          contentText: "그래서 답글은 얇은 선과 간격으로만 구분해 봤습니다.",
          permalink: "https://fmkorea.example/reading/9042#comment_9044",
        },
        {
          id: "9045",
          author: "threadkeeper",
          kind: "comment",
          timestamp: "14:27",
          parentId: "9044",
          depth: 3,
          contentText: "깊이가 너무 깊을 때 들여쓰기를 멈추는 것도 필요합니다.",
          permalink: "https://fmkorea.example/reading/9042#comment_9045",
        },
      ],
    },
    newPostIds: ["9045"],
    savedPostIds: ["9043"],
    userNotes: [],
  },
  {
    id: "stack-overflow",
    label: "Stack Overflow · Q&A",
    description: "A question, textual scores, accepted answer, and compact comments.",
    lang: "en",
    sourceUrl: "https://stackoverflow.example/questions/8801",
    thread: {
      title: "How should a local-first reader preserve nested comment context?",
      baseUrl: "https://stackoverflow.example/questions/8801",
      layout: "qa",
      source: "stack-overflow",
      posts: [
        {
          id: "8801",
          author: "RiverStone",
          role: "op",
          kind: "question",
          score: 12,
          timestamp: "asked 2 hours ago",
          contentText:
            "I have a parent-first list of comments. How can I display it without unbounded indentation?",
          contentHtml:
            "<p>I have a parent-first list of comments. How can I display it without unbounded indentation while retaining every item?</p><pre><code>visualDepth = min(parentDepth + 1, limit)</code></pre>",
          permalink: "https://stackoverflow.example/questions/8801",
          depth: 0,
        },
        {
          id: "8802",
          author: "indexcard",
          kind: "comment",
          timestamp: "1 hour ago",
          parentId: "8801",
          depth: 1,
          contentText: "Do forward references occur in your input?",
          permalink: "https://stackoverflow.example/questions/8801#comment8802_8801",
        },
        {
          id: "8803",
          author: "BoundedTree",
          kind: "answer",
          score: 21,
          accepted: true,
          timestamp: "answered 54 minutes ago",
          parentId: "8801",
          depth: 1,
          contentText:
            "Only attach a node to a prior, known parent and cap the visual depth independently.",
          contentHtml:
            "<p>Only attach a node to a prior, known parent. Cap the <strong>visual depth</strong> independently from the source depth, then flatten missing or forward references.</p>",
          permalink: "https://stackoverflow.example/questions/8801#answer-8803",
        },
        {
          id: "8804",
          author: "RiverStone",
          role: "op",
          kind: "comment",
          timestamp: "43 minutes ago",
          parentId: "8803",
          depth: 2,
          contentText: "That also makes cycles impossible in the presentation tree. Thanks.",
          permalink: "https://stackoverflow.example/questions/8801#comment8804_8803",
        },
        {
          id: "8805",
          author: "PlainLoop",
          kind: "answer",
          score: 4,
          timestamp: "answered 31 minutes ago",
          parentId: "8801",
          depth: 1,
          contentText: "A flat list with visible parent links can also be a safe fallback.",
          permalink: "https://stackoverflow.example/questions/8801#answer-8805",
        },
      ],
    },
    newPostIds: ["8805"],
    savedPostIds: ["8803"],
    userNotes: [["BoundedTree", "Explains hostile parent-reference handling clearly."]],
  },
] satisfies readonly PreviewStory[];

export function getPreviewStory(id: string | null): PreviewStory {
  const story = PREVIEW_STORIES.find((candidate) => candidate.id === id);
  if (story) return story;
  const fallback = PREVIEW_STORIES[0];
  if (!fallback) throw new Error("ForumForge preview stories are missing");
  return fallback;
}
