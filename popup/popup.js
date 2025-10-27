// Popup script

const btnOptions = document.getElementById('btnOptions');
const versionText = document.getElementById('version');

btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// 显示当前版本号
const manifest = chrome.runtime.getManifest();
versionText.textContent = `v${manifest.version}`;
