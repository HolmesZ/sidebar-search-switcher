// Minimal background service worker for Sidebar Search
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Sidebar Search installed', details);
  try {
    chrome.storage.local.get(['sidebarConfig', 'data'], async (res) => {
      if (res && (res.sidebarConfig || res.data)) {
        console.log('Existing config found; skipping default write.');
        return;
      }
      // no config found — load bundled data.json and save as sidebarConfig
      try {
        const url = chrome.runtime.getURL('data.json');
        const resp = await fetch(url);
        const json = await resp.json();
        chrome.storage.local.set({ sidebarConfig: json }, () => {
          console.log('Default sidebarConfig written to storage');
        });
      } catch (err) {
        console.error('Failed to load bundled data.json during onInstalled:', err);
      }
    });
  } catch (e) {
    console.error('onInstalled handler error:', e);
  }
});

// Simple message handlers: get/set config, import/export
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'getConfig') {
    chrome.storage.local.get(['sidebarConfig'], res => {
      // prefer sidebarConfig, fallback to legacy data
      sendResponse({ data: res.sidebarConfig || res.data || null });
    });
    return true; // async
  }
  if (msg && msg.type === 'saveConfig') {
    // save under sidebarConfig for future
    chrome.storage.local.set({ sidebarConfig: msg.data }, () => sendResponse({ ok: true }));
    return true;
  }
});
