/**
 * Background service worker — the extension shell.
 *
 * Phase 0 keeps it deliberately thin: it makes clicking the toolbar action open
 * the side panel, which is where the user drives extraction. Coordination logic
 * grows here as features land.
 */
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error("ForumForge: failed to enable the side panel", error);
  });

export {};
