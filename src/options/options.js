// Minimal options page script
(function () {
  const ta = document.getElementById('ta');
  const btnLoad = document.getElementById('btnLoad');
  const btnSave = document.getElementById('btnSave');
  const btnExport = document.getElementById('btnExport');
  const fileInput = document.getElementById('file');
  const btnImport = document.getElementById('btnImport');

  async function loadDefault() {
    try {
      const url = chrome.runtime.getURL('data.json');
      const res = await fetch(url);
      const json = await res.text();
      ta.value = json;
    } catch (e) {
      ta.value = '{\n  "error": "failed to load data.json"\n}';
    }
  }

  btnLoad.addEventListener('click', loadDefault);

  btnSave.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(ta.value);
      // save under unified key 'sidebarConfig'
      chrome.storage.local.set({ sidebarConfig: parsed }, () => alert('Saved'));
    } catch (e) {
      alert('Invalid JSON');
    }
  });

  btnExport.addEventListener('click', async () => {
    // prefer stored sidebarConfig, fallback to legacy data, then to bundled data.json
    chrome.storage.local.get(['sidebarConfig'], async (res) => {
      let payload = res.sidebarConfig || res.data;
      if (!payload) {
        try {
          const url = chrome.runtime.getURL('data.json');
          const r = await fetch(url);
          payload = await r.json();
        } catch (e) {
          payload = {};
        }
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url2 = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2;
      a.download = 'sidebar-search-config.json';
      a.click();
      URL.revokeObjectURL(url2);
    });
  });

  btnImport.addEventListener('click', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return alert('Choose a JSON file');
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        ta.value = JSON.stringify(parsed, null, 2);
        chrome.storage.local.set({ sidebarConfig: parsed }, () => alert('Imported and saved'));
      } catch (err) {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(f);
  });

  // load saved or default on open
  chrome.storage.local.get(['sidebarConfig'], res => {
    const payload = res.sidebarConfig || res.data;
    if (payload) ta.value = JSON.stringify(payload, null, 2);
    else loadDefault();
  });
})();
