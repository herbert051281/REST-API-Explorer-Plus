// When the user clicks the toolbar icon, inject the panel into the current tab.
// world: 'MAIN' is required because the bookmarklet reads window.g_ck (ServiceNow CSRF token)
// from the host page's JavaScript context — not accessible from an isolated content script.
// The bookmarklet already contains toggle logic, so clicking again hides/shows the panel.
chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['bookmarklet.min.js'],
    world: 'MAIN',
  });
});
