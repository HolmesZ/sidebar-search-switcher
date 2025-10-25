# Sidebar Search — minimal implementation

This folder contains a minimal browser extension implementing the "搜索边栏" described in `开发需求.md`.

What was added:
- `manifest.json` — MV3 manifest
- `src/content/sidebar.js` — content script: loads `data.json`, infers match, injects a hover-expand sidebar and triggers searches by replacing `{keyword}` or `%s`.
- `src/background/service-worker.js` — minimal background for storage/message handling.
- `src/options/options.html` and `options.js` — simple options page to view/import/export/save configuration.

How to test locally (Chrome / Edge):
1. Open chrome://extensions/ (or edge://extensions/).
2. Enable Developer mode.
3. Click "Load unpacked" and select this project folder (`sidebar-search`).
4. Open a site that exists in `data.json` (e.g. github.com). The left-edge thin line should appear; hover to expand and click an engine to search.

Notes:
- This is a minimal, pragmatic implementation to validate core behaviors. It intentionally keeps implementation small and readable. For production, consider:
  - improving URL matching with a public suffix list for root domain detection;
  - switching to dynamic injection to avoid running the content script on all pages;
  - converting to TypeScript and adding unit tests.
