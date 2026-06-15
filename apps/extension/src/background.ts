/**
 * Background service worker — the extension shell.
 *
 * Clicking the toolbar action opens the side panel. We open it from this
 * `action.onClicked` handler rather than via
 * `setPanelBehavior({ openPanelOnActionClick: true })`: that built-in path opens
 * the panel but does **not** confer the `activeTab` grant the panel relies on to
 * read the page (crbug.com/40916430). Because the manifest declares no host
 * permissions, the panel's later `scripting.executeScript` would then reject on
 * ordinary forum pages. Handling the click ourselves means its `activeTab` grant
 * covers the tab, so on-demand content-script injection succeeds.
 */
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  chrome.sidePanel.open({ tabId: tab.id }).catch((error: unknown) => {
    console.error("ForumForge: failed to open the side panel", error);
  });
});

export {};
