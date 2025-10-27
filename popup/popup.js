// Popup script

const btnOptions = document.getElementById('btnOptions');

btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});
