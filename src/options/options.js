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
      chrome.storage.local.set({ data: parsed }, () => alert('Saved'));
    } catch (e) {
      alert('Invalid JSON');
    }
  });

  btnExport.addEventListener('click', () => {
    chrome.storage.local.get(['data'], res => {
      const payload = res.data || {};
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sidebar-search-config.json';
      a.click();
      URL.revokeObjectURL(url);
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
        chrome.storage.local.set({ data: parsed }, () => alert('Imported and saved'));
      } catch (err) {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(f);
  });

  // load saved or default on open
  chrome.storage.local.get(['data'], res => {
    if (res.data) ta.value = JSON.stringify(res.data, null, 2);
    else loadDefault();
  });
})();
