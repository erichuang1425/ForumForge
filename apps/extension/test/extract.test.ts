import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { extractThreadFromDocument } from "../src/extract";

// A small, hand-authored thread — never a live site (see docs/FIXTURES.md).
const HTML = `<!doctype html>
<html><body>
  <h1>Speaker crackle after firmware update</h1>
  <article class="post"><div class="username">ada</div>
    <time>2026-02-01</time>
    <div class="post-body">Anyone else hearing crackle since v2.1?</div>
  </article>
  <article class="post"><div class="username">grace</div>
    <time>2026-02-02</time>
    <div class="post-body">Rolling back to v2.0 fixed it for me.</div>
  </article>
</body></html>`;

function extract() {
  const { document } = parseHTML(HTML);
  return extractThreadFromDocument(document as unknown as Document);
}

describe("extractThreadFromDocument", () => {
  it("delegates to the generic parser to read the thread", () => {
    const thread = extract();
    expect(thread.title).toBe("Speaker crackle after firmware update");
    expect(thread.posts).toHaveLength(2);
    expect(thread.posts.map((p) => p.author)).toEqual(["ada", "grace"]);
  });

  it("marks the thread starter as OP", () => {
    expect(extract().posts[0]?.role).toBe("op");
  });

  it("picks the Discourse adapter when the generator meta tag says so", () => {
    const html = `<!doctype html>
      <html><head><meta name="generator" content="Discourse 3.2.0" /></head>
      <body><article class="topic-post topic-owner" data-post-number="1">
        <div class="names"><a class="username" href="/u/ada"><span>ada</span></a></div>
        <div class="cooked"><p>Hello from Discourse.</p></div>
      </article></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.author).toBe("ada");
    expect(thread.posts[0]?.role).toBe("op");
  });

  it("picks the Hacker News adapter when the page has #hnmain", () => {
    const html = `<!doctype html>
      <html op="item"><body><table id="hnmain"><tr><td>
        <table class="comment-tree">
          <tr class="athing comtr" id="1">
            <td><table border="0"><tr>
              <td class="ind" indent="0"><img src="s.gif" width="0" /></td>
              <td class="default">
                <span class="comhead"><a href="user?id=bob" class="hnuser">bob</a></span>
                <div class="comment"><span class="commtext">Hello from HN.</span></div>
              </td>
            </tr></table></td>
          </tr>
        </table>
      </td></tr></table></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.author).toBe("bob");
  });

  it("picks the phpBB adapter only for a signed topic page", () => {
    const html = `<!doctype html>
      <html><body id="phpbb" class="section-viewtopic"><div id="page-body">
        <h2 class="topic-title"><a href="./viewtopic.php?t=8">Synthetic topic</a></h2>
        <div id="p81" class="post"><dl class="postprofile">
          <dt><a class="username" href="./memberlist.php?u=4">ivy</a></dt>
        </dl><div class="postbody">
          <h3><a href="./viewtopic.php?p=81#p81">Synthetic topic</a></h3>
          <p class="author"><time datetime="2026-06-01T08:00:00Z">June 1</time></p>
          <div class="content">Hello from phpBB.</div>
        </div></div>
      </div></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Synthetic topic");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.id).toBe("81");
    expect(thread.posts[0]?.author).toBe("ivy");
  });

  it("picks the XenForo adapter only for a signed 2.3 public thread view", () => {
    const html = `<!doctype html><html id="XF" data-xf="2.3" data-app="public"><body
      data-template="thread_view"><h1 class="p-title-value">Synthetic thread</h1>
      <article class="message message--post js-post" data-author="ivy"
        data-content="post-91" id="js-post-91"><div class="message-inner">
        <aside class="message-cell message-cell--user"><h4 class="message-name">
          <a class="username" href="/members/ivy.4/">ivy</a>
        </h4></aside><div class="message-cell message-cell--main">
          <header><ul class="message-attribution-main"><li><a href="/posts/91/">
            <time class="u-dt" datetime="2026-06-02T08:00:00Z">June 2</time>
          </a></li></ul></header>
          <article class="message-body"><div class="bbWrapper">Hello from XenForo.</div></article>
        </div></div></article></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Synthetic thread");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.id).toBe("91");
    expect(thread.posts[0]?.author).toBe("ivy");
  });

  it("picks the vBulletin adapter only for a signed 4.x showthread page", () => {
    const html = `<!doctype html><html id="vbulletin_html"><head>
      <meta name="generator" content="vBulletin 4.2.5" /></head><body>
      <div id="pagetitle"><h1><span class="threadtitle">Synthetic thread</span></h1></div>
      <ol id="posts"><li class="postbitlegacy" id="post_101">
        <div class="posthead"><span class="postdate"><span class="date">June 3</span></span>
          <a class="postcounter" href="showthread.php?1#post101">#1</a></div>
        <div class="postdetails"><div class="userinfo"><div class="username_container">
          <a class="username" href="member.php?2">ivy</a></div></div>
          <div class="postbody"><blockquote class="postcontent restore">
            <div id="post_message_101">Hello from vBulletin.</div>
          </blockquote></div></div>
      </li></ol></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Synthetic thread");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.id).toBe("101");
    expect(thread.posts[0]?.author).toBe("ivy");
    expect(thread.posts[0]?.role).toBeUndefined();
  });

  it("picks the Nairaland adapter only for a paired numeric topic post", () => {
    const html = `<!doctype html><html><body><div class="body">
      <h2><a href="/80/synthetic-topic">Synthetic topic</a></h2>
      <table summary="posts"><tbody>
        <tr><td><a href="/post/801#801">Synthetic topic</a>
          by <a class="user" href="/user/ivy">ivy</a><span>(op)</span>:
          8:00am On Jul 16, 2026</td></tr>
        <tr><td><div class="narrow">Hello from Nairaland.</div></td></tr>
      </tbody></table></div></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Synthetic topic");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]?.id).toBe("801");
    expect(thread.posts[0]?.author).toBe("ivy");
    expect(thread.posts[0]?.role).toBe("op");
  });

  it("picks the PTT adapter only for a signed article page", () => {
    const html = `<!doctype html><html><body>
      <div id="main-content" class="bbs-screen bbs-content">
        <div class="article-metaline"><span class="article-meta-tag">作者</span>
          <span class="article-meta-value">ivy (小艾)</span></div>
        <div class="article-metaline"><span class="article-meta-tag">看板</span>
          <span class="article-meta-value">FixIt</span></div>
        <div class="article-metaline"><span class="article-meta-tag">標題</span>
          <span class="article-meta-value">[討論] 合成主題</span></div>
        <div class="article-metaline"><span class="article-meta-tag">時間</span>
          <span class="article-meta-value">Thu Jul 16 10:00:00 2026</span></div>
        <p>來自 PTT 的合成文章。</p>
        <span class="f2">※ 發信站: 批踢踢實業坊(ptt.cc)</span>
        <div class="push"><span class="push-tag">推</span>
          <span class="push-userid">mira</span>
          <span class="push-content">: 合成回覆。</span></div>
      </div></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("[討論] 合成主題");
    expect(thread.posts).toHaveLength(2);
    expect(thread.posts[0]).toMatchObject({
      id: "article",
      author: "ivy (小艾)",
      role: "op",
    });
    expect(thread.posts[1]).toMatchObject({
      id: "push-1",
      author: "mira",
      contentText: "推 合成回覆。",
      parentId: "article",
    });
  });

  it("picks the 4chan adapter only for a coherent thread page", () => {
    const html = `<!doctype html><html><body class="is_thread board_tg">
      <div class="board"><div class="thread" id="t500">
        <div class="postContainer opContainer" id="pc500">
          <div class="post op" id="p500"><div class="postInfo">
            <span class="subject">Synthetic imageboard thread</span>
            <span class="name">ivy</span><span class="postNum">
              <a href="/tg/thread/500#p500">No.500</a></span></div>
            <blockquote class="postMessage" id="m500">Hello from 4chan.</blockquote>
          </div>
        </div>
      </div></div></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Synthetic imageboard thread");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "500", author: "ivy", role: "op" });
  });

  it("picks the Arca adapter only for a canonical board article", () => {
    const html = `<!doctype html><html><body><article class="board-article">
      <div class="article-view"><div class="article-wrapper"><div class="article-head">
        <div class="title-row"><div class="title">합성 아카라이브 글</div></div>
        <div class="member-info"><span class="user-info"><a href="/u/@ivy">ivy</a></span></div>
      </div><div class="article-link"><a href="/b/tools/900">원문</a></div>
      <div class="article-body"><div class="article-content">본문입니다.</div></div>
      <div class="article-comment"><div class="comment-wrapper">
        <div class="comment-item" id="c_901"><div class="content">
          <div class="info-row"><span class="user-info"><a href="/u/@mira">mira</a></span></div>
          <div class="message">댓글입니다.</div>
        </div></div>
      </div></div></div></div></article></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("합성 아카라이브 글");
    expect(thread.posts).toHaveLength(2);
    expect(thread.posts[0]).toMatchObject({ id: "900", author: "ivy", role: "op" });
    expect(thread.posts[1]).toMatchObject({ id: "901", author: "mira", parentId: "900" });
  });

  it("picks the DC Inside adapter only for a numeric gallery article", () => {
    const html = `<!doctype html><html><body><div class="view_content_wrap">
      <header><div class="gallview_head ub-content">
        <h3><span class="title_subject">합성 디시인사이드 글</span></h3>
        <div class="gall_writer ub-writer" data-nick="ivy" data-uid="ivy01">
          <span class="gall_date">2026.07.16 13:00:00</span>
        </div>
      </div></header>
      <div class="gallview_contents"><div class="writing_view_box">
        <div class="write_div">본문입니다.</div>
      </div></div>
      <div class="btn_recommend_box"><button data-no="950"></button></div>
    </div>
    <div class="view_comment"><div class="comment_wrap" id="comment_wrap_950"></div></div>
    </body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("합성 디시인사이드 글");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "950", author: "ivy", role: "op" });
  });

  it("picks the FMKorea adapter only for a coherent numeric article", () => {
    const html = `<!doctype html><html><body><div class="rd" data-docsrl="960">
      <div class="rd_hd"><div class="top_area"><span class="date m_no">2026.07.16</span>
        <h1>합성 에펨코리아 글</h1></div><div class="btm_area">
        <a class="member_10 member_plate" href="#popup_menu_area">ivy</a></div></div>
      <div class="rd_body"><div class="document_address"><a href="/best/960">원문</a></div>
        <article><div class="document_960_10 xe_content">본문입니다.</div></article></div>
      <div class="fdb_lst" id="960_comment"><ul class="fdb_lst_ul"></ul></div>
    </div></body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("합성 에펨코리아 글");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "960", author: "ivy", role: "op" });
  });

  it("picks the Stack Overflow adapter for a coherent question", () => {
    const html = `<!doctype html><html><body>
      <h1><a class="question-hyperlink" href="/questions/970/example">Example question</a></h1>
      <div id="question" class="question" data-questionid="970" data-author-username="ivy">
        <div class="s-prose js-post-body">Question body.</div>
        <div class="post-signature owner"><div class="user-action-time">
          <span class="relativetime" title="2026-07-16 16:00:00Z"></span></div>
          <div class="user-details"><a href="/users/10/ivy">ivy</a></div></div>
        <div class="js-post-menu"><a class="js-share-link" href="/q/970">Share</a></div>
      </div><div id="answers"></div>
    </body></html>`;
    const { document } = parseHTML(html);
    const thread = extractThreadFromDocument(document as unknown as Document);
    expect(thread.title).toBe("Example question");
    expect(thread.posts).toHaveLength(1);
    expect(thread.posts[0]).toMatchObject({ id: "970", author: "ivy", role: "op" });
  });
});
