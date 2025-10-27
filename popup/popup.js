// Popup script
(function () {
  const btnOptions = document.getElementById('btnOptions');

  btnOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
})();
