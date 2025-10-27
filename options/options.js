// Options page script with dark mode support
(function () {
  const ta = document.getElementById('ta');
  const btnLoad = document.getElementById('btnLoad');
  const btnSave = document.getElementById('btnSave');
  const btnExport = document.getElementById('btnExport');
  const fileInput = document.getElementById('file');
  const btnImport = document.getElementById('btnImport');
  const alertElement = document.getElementById('alert');
  const themeIndicator = document.getElementById('themeIndicator');

  // Alert utility function
  function showAlert(message, type = 'success') {
    alertElement.textContent = message;
    alertElement.className = `alert ${type} show`;
    setTimeout(() => {
      alertElement.classList.remove('show');
    }, 3000);
  }

  // Theme detection and indicator
  function updateThemeIndicator() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeIndicator.textContent = isDark ? '🌙 暗色模式' : '☀️ 亮色模式';
  }

  // Listen for theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeIndicator);

  // Initialize theme indicator
  updateThemeIndicator();

  async function loadDefault() {
    try {
      const url = chrome.runtime.getURL('data.json');
      const res = await fetch(url);
      const json = await res.text();
      ta.value = json;
      showAlert('✓ 已恢复默认配置', 'success');
    } catch (e) {
      ta.value = '{\n  "error": "failed to load data.json"\n}';
      showAlert('✗ 加载默认配置失败', 'error');
    }
  }

  btnLoad.addEventListener('click', loadDefault);

  btnSave.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(ta.value);
      // save under unified key 'sidebarConfig'
      chrome.storage.local.set({ sidebarConfig: parsed }, () => {
        showAlert('✓ 配置已保存', 'success');
      });
    } catch (e) {
      showAlert('✗ JSON 格式无效：' + e.message, 'error');
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
      showAlert('✓ 配置已导出', 'success');
    });
  });

  btnImport.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) {
      showAlert('✗ 请先选择一个 JSON 文件', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        ta.value = JSON.stringify(parsed, null, 2);
        chrome.storage.local.set({ sidebarConfig: parsed }, () => {
          showAlert('✓ 配置已导入并保存', 'success');
          fileInput.value = ''; // Reset file input
        });
      } catch (err) {
        showAlert('✗ JSON 格式无效', 'error');
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
