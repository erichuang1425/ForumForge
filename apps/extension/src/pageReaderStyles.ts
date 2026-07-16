/**
 * Styles for the in-page reading studio. The stylesheet lives inside a closed
 * shadow root: selectors cannot escape to the forum, and forum selectors cannot
 * reach these controls. It deliberately uses only local/system resources.
 */
export const PAGE_READER_STYLES = String.raw`
  :host {
    all: initial;
    color-scheme: light dark;
    --ff-ink: #18202c;
    --ff-ink-soft: #4e5968;
    --ff-canvas: #eee9e0;
    --ff-paper: #fffdf8;
    --ff-paper-muted: #f7f3eb;
    --ff-line: #d8d0c3;
    --ff-line-strong: #b9ad9b;
    --ff-night: #17243e;
    --ff-night-hover: #20345a;
    --ff-orange: #c86216;
    --ff-orange-soft: #f8e4d4;
    --ff-green: #28745d;
    --ff-green-soft: #deeee8;
    --ff-blue-soft: #e3eaf7;
    --ff-focus: #d77a22;
    --ff-danger: #a83d35;
    --ff-shadow-soft: 0 12px 36px rgb(38 29 17 / 0.10);
    --ff-shadow-deep: 0 28px 90px rgb(22 18 13 / 0.24);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }

  @media (prefers-color-scheme: dark) {
    :host {
      --ff-ink: #f3eee5;
      --ff-ink-soft: #bbb5aa;
      --ff-canvas: #11161d;
      --ff-paper: #1a2028;
      --ff-paper-muted: #202731;
      --ff-line: #353d48;
      --ff-line-strong: #596270;
      --ff-night: #e8edf8;
      --ff-night-hover: #ffffff;
      --ff-orange: #f4a261;
      --ff-orange-soft: #4b3021;
      --ff-green: #85d5b9;
      --ff-green-soft: #203d35;
      --ff-blue-soft: #27354e;
      --ff-focus: #ffb36b;
      --ff-danger: #ffaaa2;
      --ff-shadow-soft: 0 14px 40px rgb(0 0 0 / 0.25);
      --ff-shadow-deep: 0 32px 100px rgb(0 0 0 / 0.55);
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button,
  textarea {
    font: inherit;
  }

  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }

  :where(button, a, textarea, [tabindex]):focus-visible {
    outline: 3px solid var(--ff-focus);
    outline-offset: 3px;
  }

  .ff-launcher {
    position: fixed;
    z-index: 2;
    top: 42%;
    left: 0;
    display: grid;
    width: 48px;
    height: 92px;
    padding: 0;
    place-items: center;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.22);
    border-left: 0;
    border-radius: 0 24px 24px 0;
    background: linear-gradient(165deg, #21355c 0%, #15233d 72%);
    box-shadow: 0 14px 34px rgb(13 24 45 / 0.32);
    color: #fff9ef;
    cursor: pointer;
    pointer-events: auto;
    transform: translateX(-32px);
    transition: transform 180ms ease, box-shadow 180ms ease;
  }

  .ff-launcher::after {
    position: absolute;
    top: 11px;
    right: 4px;
    width: 4px;
    height: 70px;
    border-radius: 999px;
    background: #ed8738;
    content: "";
  }

  .ff-launcher:hover,
  .ff-launcher:focus-visible,
  .ff-launcher[aria-expanded="true"] {
    box-shadow: 0 18px 44px rgb(13 24 45 / 0.42);
    transform: translateX(0);
  }

  .ff-launcher__mark {
    position: relative;
    display: block;
    width: 24px;
    height: 38px;
    margin-right: 4px;
    border: 3px solid currentColor;
    border-top-color: transparent;
    border-left-color: transparent;
    border-radius: 8px 14px 16px 12px;
    transform: rotate(-14deg);
  }

  .ff-launcher__mark::before,
  .ff-launcher__mark::after {
    position: absolute;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    content: "";
  }

  .ff-launcher__mark::before {
    top: 2px;
    right: -4px;
    box-shadow: -8px -4px 0 currentColor;
  }

  .ff-launcher__mark::after {
    right: 3px;
    bottom: 3px;
    background: #ed8738;
  }

  .ff-reader[hidden] {
    display: none;
  }

  .ff-reader {
    position: fixed;
    z-index: 1;
    inset: 0;
    display: block;
    min-width: 0;
    background: rgb(15 20 28 / 0.48);
    backdrop-filter: blur(10px) saturate(0.85);
    color: var(--ff-ink);
    pointer-events: auto;
  }

  .ff-reader__dialog {
    position: absolute;
    inset: 12px;
    display: grid;
    min-width: 0;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.24);
    border-radius: 24px;
    background:
      radial-gradient(circle at 14% 0%, rgb(200 98 22 / 0.10), transparent 31rem),
      var(--ff-canvas);
    box-shadow: var(--ff-shadow-deep);
  }

  .ff-reader__topbar {
    position: relative;
    z-index: 2;
    display: flex;
    min-width: 0;
    min-height: 68px;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 16px 10px 18px;
    border-bottom: 1px solid var(--ff-line);
    background: color-mix(in srgb, var(--ff-paper) 92%, transparent);
    backdrop-filter: blur(18px);
  }

  .ff-reader__brand {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 11px;
  }

  .ff-reader__brand-mark {
    position: relative;
    display: grid;
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    place-items: center;
    overflow: hidden;
    border-radius: 13px;
    background: var(--ff-night);
    color: var(--ff-paper);
    font: 800 20px/1 ui-sans-serif, system-ui, sans-serif;
  }

  .ff-reader__brand-mark::after {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 9px;
    height: 9px;
    border-radius: 2px;
    background: var(--ff-orange);
    content: "";
    transform: rotate(45deg);
  }

  .ff-reader__brand-copy {
    min-width: 0;
  }

  .ff-reader__app-name,
  .ff-reader__source {
    margin: 0;
  }

  .ff-reader__app-name {
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .ff-reader__source {
    max-width: min(46vw, 34rem);
    margin-top: 2px;
    color: var(--ff-ink-soft);
    font-size: 11px;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ff-reader__top-actions {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .ff-reader__button,
  .ff-reader__jump,
  .ff-reader__library,
  .ff-post__save,
  .ff-post__note-toggle,
  .ff-post__note-save {
    min-height: 36px;
    border: 1px solid var(--ff-line-strong);
    border-radius: 999px;
    background: var(--ff-paper);
    color: var(--ff-ink);
    cursor: pointer;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.2;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease,
      transform 140ms ease;
  }

  .ff-reader__button:hover,
  .ff-reader__jump:hover,
  .ff-reader__library:hover,
  .ff-post__save:hover,
  .ff-post__note-toggle:hover,
  .ff-post__note-save:hover {
    border-color: var(--ff-orange);
    color: var(--ff-orange);
  }

  .ff-reader__button:active,
  .ff-reader__jump:active,
  .ff-reader__library:active,
  .ff-post__save:active,
  .ff-post__note-toggle:active,
  .ff-post__note-save:active {
    transform: translateY(1px);
  }

  .ff-reader__button {
    padding: 8px 13px;
  }

  .ff-reader__close {
    border-color: var(--ff-night);
    background: var(--ff-night);
    color: var(--ff-paper);
  }

  .ff-reader__close:hover {
    border-color: var(--ff-night-hover);
    background: var(--ff-night-hover);
    color: var(--ff-paper);
  }

  .ff-reader__viewport {
    min-width: 0;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    scrollbar-color: var(--ff-line-strong) transparent;
  }

  .ff-reader__workspace {
    display: grid;
    width: min(100%, 1500px);
    min-width: 0;
    min-height: 100%;
    grid-template-columns: minmax(220px, 290px) minmax(0, 820px) minmax(200px, 250px);
    align-items: start;
    justify-content: center;
    gap: clamp(20px, 3vw, 48px);
    margin: 0 auto;
    padding: clamp(28px, 4vw, 64px) clamp(20px, 3vw, 52px) 88px;
  }

  .ff-reader__rail,
  .ff-reader__tools {
    position: sticky;
    top: 28px;
    min-width: 0;
  }

  .ff-reader__eyebrow {
    margin: 0 0 12px;
    color: var(--ff-orange);
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 0.15em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .ff-reader__rail-title {
    margin: 0;
    color: var(--ff-ink);
    font: 700 clamp(28px, 3vw, 44px)/1.04 ui-serif, Charter, "Iowan Old Style",
      "Palatino Linotype", Georgia, serif;
    letter-spacing: -0.035em;
    overflow-wrap: anywhere;
  }

  .ff-reader__dek {
    margin: 18px 0 0;
    color: var(--ff-ink-soft);
    font: 16px/1.65 ui-serif, Charter, Georgia, serif;
  }

  .ff-reader__metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: 24px 0 0;
  }

  .ff-reader__metric {
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid var(--ff-line);
    border-radius: 14px;
    background: color-mix(in srgb, var(--ff-paper) 76%, transparent);
  }

  .ff-reader__metric strong,
  .ff-reader__metric span {
    display: block;
  }

  .ff-reader__metric strong {
    font: 800 22px/1 ui-sans-serif, system-ui, sans-serif;
  }

  .ff-reader__metric span {
    margin-top: 5px;
    color: var(--ff-ink-soft);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .ff-reader__jump-list {
    display: grid;
    gap: 8px;
    margin: 26px 0 0;
    padding: 20px 0 0;
    border-top: 1px solid var(--ff-line);
  }

  .ff-reader__jump {
    display: flex;
    width: 100%;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 13px;
    text-align: left;
  }

  .ff-reader__jump span:last-child {
    color: var(--ff-ink-soft);
    font-weight: 650;
  }

  .ff-reader__main {
    min-width: 0;
  }

  .ff-reader__intro {
    display: flex;
    min-width: 0;
    align-items: end;
    justify-content: space-between;
    gap: 18px;
    margin: 0 0 22px;
    padding: 0 2px 16px;
    border-bottom: 1px solid var(--ff-line-strong);
  }

  .ff-reader__intro h2,
  .ff-reader__intro p {
    margin: 0;
  }

  .ff-reader__intro h2 {
    font: 750 22px/1.2 ui-serif, Charter, Georgia, serif;
    letter-spacing: -0.02em;
  }

  .ff-reader__intro p {
    color: var(--ff-ink-soft);
    font-size: 12px;
  }

  .ff-reader__status {
    min-height: 1.5em;
    margin: 0 0 14px;
    color: var(--ff-ink-soft);
    font-size: 12px;
    line-height: 1.5;
  }

  .ff-reader__status[data-state="error"] {
    color: var(--ff-danger);
  }

  .ff-reader__status[data-state="success"] {
    color: var(--ff-green);
  }

  .ff-thread,
  .ff-posts {
    min-width: 0;
  }

  .ff-posts {
    display: grid;
    gap: 18px;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: post;
  }

  .ff-post {
    position: relative;
    min-width: 0;
    padding: clamp(18px, 2.5vw, 28px);
    border: 1px solid var(--ff-line);
    border-radius: 20px;
    background: var(--ff-paper);
    box-shadow: var(--ff-shadow-soft);
    counter-increment: post;
  }

  .ff-post::before {
    position: absolute;
    top: 22px;
    bottom: 22px;
    left: -10px;
    width: 3px;
    border-radius: 99px;
    background: transparent;
    content: "";
  }

  .ff-post:first-child {
    border-color: color-mix(in srgb, var(--ff-orange) 45%, var(--ff-line));
  }

  .ff-post:first-child::before,
  .ff-post[data-new="true"]::before {
    background: var(--ff-orange);
  }

  .ff-post[data-saved="true"] {
    border-color: color-mix(in srgb, var(--ff-green) 48%, var(--ff-line));
  }

  .ff-post__meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
    margin-bottom: 18px;
  }

  .ff-post__identity {
    display: grid;
    min-width: 0;
    flex: 1 1 15rem;
    grid-template-columns: auto minmax(0, auto) auto auto;
    grid-template-rows: auto auto;
    align-items: center;
    justify-content: start;
    gap: 3px 8px;
  }

  .ff-post__avatar {
    display: grid;
    width: 42px;
    height: 42px;
    grid-row: 1 / span 2;
    place-items: center;
    border-radius: 13px;
    background: var(--ff-blue-soft);
    color: var(--ff-night);
    font-size: 12px;
    font-weight: 850;
    letter-spacing: 0.03em;
  }

  .ff-post[data-tone="1"] .ff-post__avatar {
    background: var(--ff-orange-soft);
    color: var(--ff-orange);
  }

  .ff-post[data-tone="2"] .ff-post__avatar {
    background: var(--ff-green-soft);
    color: var(--ff-green);
  }

  .ff-post__author {
    min-width: 0;
    overflow: hidden;
    color: var(--ff-ink);
    font-size: 14px;
    font-weight: 820;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ff-post__time {
    grid-column: 2 / -1;
    color: var(--ff-ink-soft);
    font-size: 11px;
    line-height: 1.35;
  }

  .ff-post__role,
  .ff-post__new {
    padding: 3px 7px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: 0.06em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .ff-post__role {
    background: var(--ff-blue-soft);
    color: var(--ff-night);
  }

  .ff-post__new {
    background: var(--ff-orange-soft);
    color: var(--ff-orange);
  }

  .ff-post__actions {
    display: flex;
    flex: 0 1 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
  }

  .ff-post__ordinal {
    margin-right: 3px;
    color: var(--ff-ink-soft);
    font: 750 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .ff-post__save,
  .ff-post__note-toggle,
  .ff-post__note-save {
    min-height: 32px;
    padding: 6px 11px;
    font-size: 11px;
  }

  .ff-post__save[aria-pressed="true"] {
    border-color: var(--ff-green);
    background: var(--ff-green-soft);
    color: var(--ff-green);
  }

  .ff-post[data-has-note="true"] .ff-post__note-toggle::after {
    color: var(--ff-orange);
    content: "  •";
  }

  .ff-post__body {
    min-width: 0;
    color: var(--ff-ink);
    font: 17px/1.72 ui-serif, Charter, "Iowan Old Style", "Palatino Linotype", Georgia,
      serif;
    overflow-wrap: anywhere;
  }

  .ff-post__body > :first-child {
    margin-top: 0;
  }

  .ff-post__body > :last-child {
    margin-bottom: 0;
  }

  .ff-post__body p,
  .ff-post__text {
    margin: 0 0 1em;
  }

  .ff-post__body h1,
  .ff-post__body h2,
  .ff-post__body h3,
  .ff-post__body h4,
  .ff-post__body h5,
  .ff-post__body h6 {
    margin: 1.45em 0 0.55em;
    font-family: ui-sans-serif, system-ui, sans-serif;
    line-height: 1.25;
  }

  .ff-post__body a {
    color: var(--ff-orange);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.16em;
  }

  .ff-post__body blockquote {
    margin: 1.2em 0;
    padding: 14px 18px;
    border-left: 3px solid var(--ff-orange);
    border-radius: 0 12px 12px 0;
    background: var(--ff-paper-muted);
    color: var(--ff-ink-soft);
  }

  .ff-post__body pre {
    max-width: 100%;
    overflow: auto;
    padding: 14px;
    border: 1px solid var(--ff-line);
    border-radius: 12px;
    background: var(--ff-paper-muted);
    font: 13px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .ff-post__body :not(pre) > code {
    padding: 0.14em 0.32em;
    border-radius: 5px;
    background: var(--ff-paper-muted);
    font: 0.88em/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .ff-post__body table {
    display: block;
    max-width: 100%;
    overflow: auto;
    border-collapse: collapse;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
  }

  .ff-post__body th,
  .ff-post__body td {
    padding: 8px 10px;
    border: 1px solid var(--ff-line);
    text-align: left;
  }

  .ff-post__note {
    display: grid;
    gap: 9px;
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--ff-line);
  }

  .ff-post__note[hidden] {
    display: none;
  }

  .ff-post__note-input {
    display: block;
    width: 100%;
    min-height: 82px;
    resize: vertical;
    padding: 11px 12px;
    border: 1px solid var(--ff-line-strong);
    border-radius: 12px;
    background: var(--ff-paper-muted);
    color: var(--ff-ink);
    line-height: 1.5;
  }

  .ff-post__note-save {
    justify-self: end;
  }

  .ff-empty {
    padding: 40px;
    border: 1px dashed var(--ff-line-strong);
    border-radius: 20px;
    background: var(--ff-paper);
    text-align: center;
  }

  .ff-empty__title,
  .ff-empty__guidance {
    margin: 0;
  }

  .ff-empty__guidance {
    margin-top: 8px;
    color: var(--ff-ink-soft);
  }

  .ff-reader__tools-card {
    padding: 18px;
    border: 1px solid var(--ff-line);
    border-radius: 18px;
    background: color-mix(in srgb, var(--ff-paper) 84%, transparent);
    box-shadow: var(--ff-shadow-soft);
  }

  .ff-reader__tools-label {
    margin: 0;
    color: var(--ff-green);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .ff-reader__tools-card h2 {
    margin: 7px 0 8px;
    font: 750 18px/1.25 ui-serif, Charter, Georgia, serif;
  }

  .ff-reader__tools-card p {
    margin: 0;
    color: var(--ff-ink-soft);
    font-size: 12px;
    line-height: 1.6;
  }

  .ff-reader__tools-list {
    display: grid;
    gap: 9px;
    margin: 16px 0;
    padding: 14px 0;
    border-top: 1px solid var(--ff-line);
    border-bottom: 1px solid var(--ff-line);
    color: var(--ff-ink-soft);
    font-size: 11px;
    line-height: 1.45;
    list-style: none;
  }

  .ff-reader__tools-list li {
    position: relative;
    padding-left: 16px;
  }

  .ff-reader__tools-list li::before {
    position: absolute;
    top: 0.38em;
    left: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ff-green);
    content: "";
  }

  .ff-reader__library {
    width: 100%;
    padding: 8px 12px;
  }

  button[disabled],
  textarea[disabled] {
    cursor: default;
    opacity: 0.52;
  }

  @media (max-width: 1120px) {
    .ff-reader__workspace {
      grid-template-columns: minmax(205px, 260px) minmax(0, 790px);
    }

    .ff-reader__tools {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .ff-launcher {
      top: auto;
      bottom: 18%;
    }

    .ff-reader__dialog {
      inset: 0;
      border: 0;
      border-radius: 0;
    }

    .ff-reader__topbar {
      min-height: 62px;
      padding: 8px 10px;
    }

    .ff-reader__brand-mark {
      width: 36px;
      height: 36px;
      flex-basis: 36px;
    }

    .ff-reader__source,
    .ff-reader__refresh,
    .ff-reader__top-library {
      display: none;
    }

    .ff-reader__button {
      min-height: 38px;
    }

    .ff-reader__workspace {
      display: block;
      padding: 24px 14px 64px;
    }

    .ff-reader__rail {
      position: static;
      margin: 0 2px 30px;
    }

    .ff-reader__rail-title {
      font-size: clamp(30px, 10vw, 42px);
    }

    .ff-reader__dek {
      font-size: 15px;
    }

    .ff-reader__jump-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ff-reader__intro {
      align-items: start;
      flex-direction: column;
      gap: 4px;
    }

    .ff-post {
      padding: 17px 15px;
      border-radius: 16px;
    }

    .ff-post__identity {
      flex-basis: 100%;
    }

    .ff-post__actions {
      width: 100%;
      justify-content: flex-start;
    }

    .ff-post__body {
      font-size: 16px;
      line-height: 1.68;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
