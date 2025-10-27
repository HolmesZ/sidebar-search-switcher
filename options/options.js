// 选项页脚本（支持深色模式指示）

const ta = document.getElementById('ta');
const btnLoad = document.getElementById('btnLoad');
const btnSave = document.getElementById('btnSave');
const btnExport = document.getElementById('btnExport');
const fileInput = document.getElementById('file');
const btnImport = document.getElementById('btnImport');
const alertElement = document.getElementById('alert');
const themeIndicator = document.getElementById('themeIndicator');

// 提示工具函数：显示成功/错误信息，3 秒后自动隐藏
function showAlert(message, type = 'success') {
    alertElement.textContent = message;
    alertElement.className = `alert ${type} show`;
    setTimeout(() => {
        alertElement.classList.remove('show');
    }, 3000);
}

// 主题检测与指示器：根据系统配色方案显示当前模式
function updateThemeIndicator() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeIndicator.textContent = isDark ? '🌙 暗色模式' : '☀️ 亮色模式';
}

// 监听系统主题变化，动态更新指示器
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateThemeIndicator);

// 初始化主题指示器
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
        // 以统一键名 'sidebarConfig' 保存配置
        chrome.storage.local.set({ sidebarConfig: parsed }, () => {
            showAlert('✓ 配置已保存', 'success');
        });
    } catch (e) {
        showAlert('✗ JSON 格式无效：' + e.message, 'error');
    }
});

btnExport.addEventListener('click', async () => {
    // 导出优先顺序：本地存储 sidebarConfig → 兼容旧键 data → 扩展内置 data.json
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
        // 通过 Blob + 对象 URL 生成下载
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

// 处理文件选择并导入配置
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
                fileInput.value = ''; // 重置文件选择框，便于再次选择同一文件
            });
        } catch (err) {
            showAlert('✗ JSON 格式无效', 'error');
        }
    };
    reader.readAsText(f);
});

// 打开页面时加载已保存配置；若无则加载默认配置
chrome.storage.local.get(['sidebarConfig'], res => {
    const payload = res.sidebarConfig;
    if (payload) ta.value = JSON.stringify(payload, null, 2);
    else loadDefault();
});
