// Minimal background service worker for Sidebar Search
chrome.runtime.onInstalled.addListener(() => {
  console.log('Sidebar Search installed');
});

// Simple message handlers: get/set config, import/export
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'getConfig') {
    chrome.storage.local.get(['data'], res => {
      sendResponse({ data: res.data });
    });
    return true; // async
  }
  if (msg && msg.type === 'saveConfig') {
    chrome.storage.local.set({ data: msg.data }, () => sendResponse({ ok: true }));
    return true;
  }
});
