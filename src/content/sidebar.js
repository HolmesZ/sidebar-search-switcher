// Minimal content script for Sidebar Search
(async function () {
  const DATA_URL = chrome.runtime.getURL('data.json');

  // Helper: fetch and normalize data.json (support old keys)
  async function loadConfig() {
    try {
      const res = await fetch(DATA_URL);
      const raw = await res.json();
      const setting = raw.setting || {};
      const listData = raw.listData || raw.list || [];
      // normalize groups: items vs list
      const groups = listData.map(g => ({
        name: g.name || g.title || '',
        icon: g.icon || '',
        items: (g.items || g.list || []).map(it => ({
          name: it.name || it.title || 'unnamed',
          urlTemplate: it.urlTemplate || it.engine || it.url || '',
          icon: it.icon || it.favicon || ''
        }))
      }));
      return { setting, groups };
    } catch (e) {
      console.error('Failed to load data.json', e);
      return { setting: {}, groups: [] };
    }
  }

  function inferFromTemplate(template) {
    if (!template) return null;
    const token = 'XKEYWORDX';
    let attempt = template.replace(/\{keyword\}/g, token).replace(/%s/g, token);
    // handle protocol-relative URLs like //example.com/path
    if (attempt.startsWith('//')) attempt = location.protocol + attempt;
    // try parse; if fails and attempt starts with '/', assume relative to current host
    let url = null;
    try { url = new URL(attempt); } catch (e) { url = null; }
    if (!url && attempt.startsWith('/')) {
      try { url = new URL(location.protocol + '//' + location.hostname + attempt); } catch (e) { url = null; }
    }
    if (!url) return null;
    try {
      const protocol = url.protocol || 'https:';
      const host = url.hostname;
      const port = url.port ? ':' + url.port : '';
      const rawPath = url.pathname || '/';
      const pathPrefix = rawPath === '/' ? '/' : rawPath.replace(/\/+/, '/').replace(/\/$/, '');
      const strict = `${protocol}//${host}${port}${pathPrefix}*`;
      const parts = host.split('.');
      const root = parts.length > 2 ? parts.slice(-2).join('.') : host;
      const loose = `${protocol}//*.${root}/*`;
      return { protocol, host, port, pathPrefix, strict, loose, root };
    } catch (e) {
      return null;
    }
  }

  function isLocationMatch(inferred) {
    if (!inferred) return false;
    const locHost = location.hostname;
    // normalize common www prefix for comparison
    const normalize = (h) => (h || '').replace(/^www\./, '').toLowerCase();
    const locNorm = normalize(locHost);
    const infNorm = normalize(inferred.host);
    // strict host match (ignoring leading www.)
    if (locNorm !== infNorm) return false;
    // if inferred has a pathPrefix other than '/', require location.pathname to match segment-wise
    try {
      const locPath = location.pathname || '/';
      const infPath = inferred.pathPrefix || '/';
      if (infPath && infPath !== '/') {
        // exact segment match: locPath === infPath OR locPath starts with infPath + '/'
        if (locPath === infPath) return true;
        if (locPath.startsWith(infPath + '/')) return true;
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  function createSidebar(groups, setting) {
    // guard: only create once
    if (document.getElementById('sidebar-search-root')) return;

    const root = document.createElement('div');
    root.id = 'sidebar-search-root';
    root.className = 'ss-root ss-collapsed';

    const style = document.createElement('style');
    style.innerText = `
      /* theme variables */
      :root{
        --ss-bg: #ffffff;
        --ss-text: #111827;
        --ss-edge-start: rgba(0,0,0,0.18);
        --ss-edge-end: rgba(0,0,0,0.06);
        --ss-panel-shadow: 2px 0 8px rgba(0,0,0,0.18);
        --ss-item-hover: #f2f2f2;
        --ss-item-active: #e6f0ff;
      }
      @media (prefers-color-scheme: dark){
        :root{
          --ss-bg: #0b1220;
          --ss-text: #e6eef8;
          --ss-edge-start: rgba(255,255,255,0.06);
          --ss-edge-end: rgba(255,255,255,0.02);
          --ss-panel-shadow: 2px 0 12px rgba(0,0,0,0.6);
          --ss-item-hover: rgba(255,255,255,0.04);
          --ss-item-active: rgba(70,130,180,0.18);
        }
      }

      /* root is just a container */
      .ss-root{position:fixed;left:0;top:0;height:100vh;z-index:2147483647;pointer-events:none}
      /* visible edge handle */
      .ss-edge{position:fixed;left:0;top:0;height:100vh;width:10px;background:linear-gradient(90deg,var(--ss-edge-start),var(--ss-edge-end));cursor:pointer;pointer-events:auto;border-top-right-radius:4px;border-bottom-right-radius:4px}
      .ss-edge:focus{outline:2px solid rgba(25,118,210,0.6)}
      /* panel sits above page content, hidden by translateX */
      .ss-panel{position:fixed;left:0;top:0;transform:translateX(-100%);width:320px;max-width:40vw;height:100vh;background:var(--ss-bg);color:var(--ss-text);box-shadow:var(--ss-panel-shadow);overflow:auto;pointer-events:auto}
      .ss-root.ss-expanded .ss-panel{transform:translateX(0);transition:transform .18s ease}
      .ss-root.ss-collapsed .ss-panel{transform:translateX(-100%);transition:transform .18s ease}
      .ss-list{padding:8px;font-family:Segoe UI, Arial, Helvetica, sans-serif}
      .ss-group{margin-bottom:8px}
      .ss-item{display:flex;align-items:center;padding:6px;border-radius:4px;cursor:pointer;color:var(--ss-text)}
      .ss-item:hover{background:var(--ss-item-hover)}
      .ss-item.active{background:var(--ss-item-active)}
      .ss-item img{width:18px;height:18px;margin-right:8px}
    `;

    const edge = document.createElement('div');
    edge.className = 'ss-edge';
    edge.tabIndex = 0; // make focusable for keyboard
    edge.title = 'Sidebar Search';

    const panel = document.createElement('div');
    panel.className = 'ss-panel';

    const list = document.createElement('div');
    list.className = 'ss-list';

    groups.forEach(group => {
      const g = document.createElement('div');
      g.className = 'ss-group';
      const title = document.createElement('div');
      title.textContent = group.name || '';
      title.style.fontWeight = '600';
      title.style.margin = '6px 0';
      g.appendChild(title);
      group.items.forEach(item => {
        const it = document.createElement('div');
        it.className = 'ss-item';
        const img = document.createElement('img');
        // try to use favicon service if no icon
        const host = inferFromTemplate(item.urlTemplate);
        const faviconUrl = item.icon || (host ? `https://favicon.im/${host.host}` : '');
        if (faviconUrl) img.src = faviconUrl;
        img.alt = '';
        it.appendChild(img);
        const span = document.createElement('div');
        span.textContent = item.name;
        it.appendChild(span);
        // store template
        it.dataset.urlTemplate = item.urlTemplate;
        it.addEventListener('click', () => onClickEngine(item.urlTemplate));
        // mark element with inferred info for later active checks
        const inferred = inferFromTemplate(item.urlTemplate);
        if (inferred) {
          it.dataset._inf_host = inferred.host;
          it.dataset._inf_protocol = inferred.protocol;
        }
        g.appendChild(it);
      });
      list.appendChild(g);
    });

    panel.appendChild(list);
    root.appendChild(style);
    root.appendChild(edge);
    root.appendChild(panel);
    document.body.appendChild(root);

    function expand() { root.classList.remove('ss-collapsed'); root.classList.add('ss-expanded'); }
    function collapse() { root.classList.remove('ss-expanded'); root.classList.add('ss-collapsed'); }
    // initial collapsed
    collapse();
    // open on hover, click or focus for better reliability across sites
    edge.addEventListener('mouseenter', expand);
    edge.addEventListener('click', () => root.classList.toggle('ss-expanded'));
    edge.addEventListener('focus', expand);
    // close when leaving panel area
    root.addEventListener('mouseleave', collapse);
    // close on Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') collapse(); });

    // update active states based on current location
    function updateActiveStates() {
      const items = root.querySelectorAll('.ss-item');
      items.forEach(el => {
        const tpl = el.dataset.urlTemplate;
        const inf = inferFromTemplate(tpl);
        if (inf && isLocationMatch(inf)) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }

    // listen for SPA navigation: create a custom event when pushState/replaceState called
    (function () {
      const _wr = (type) => {
        const orig = history[type];
        return function () {
          const rv = orig.apply(this, arguments);
          const ev = new Event('locationchange');
          window.dispatchEvent(ev);
          return rv;
        };
      };
      history.pushState = _wr('pushState');
      history.replaceState = _wr('replaceState');
      window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
      window.addEventListener('locationchange', updateActiveStates);
    })();

    // initial update
    updateActiveStates();
  }

  // 获取当前搜索关键词
  function extractKeyword() {
    let keywordTemporary = ''
    const params = new URLSearchParams(
      document.location.search.substring(1) || document.location.hash,
    )
    const kw =
      params.get('exxshu') ||
      params.get('q') ||
      params.get('wd') ||
      params.get('text') ||
      params.get('w') ||
      params.get('s') ||
      params.get('key') ||
      params.get('searchKeyWord') ||
      params.get('keyword') ||
      params.get('kw')

    if (kw) {
      keywordTemporary = kw
    } else {
      const dom = document.getElementsByTagName('input')
      for (let i = 0; i < dom.length; i++) {
        if (
          dom[i].clientWidth > 80 &&
          dom[i].clientHeight > 0 &&
          dom[i].value &&
          decodeURI(document.location.href).includes(dom[i].value)
        )
          keywordTemporary = dom[i].value
      }
    }

    return keywordTemporary
  }

  function onClickEngine(template) {
    const keyword = extractKeyword();
    const encoded = encodeURIComponent(keyword || '');
    let url = template.replace(/\{keyword\}/g, encoded).replace(/%s/g, encoded);
    // navigate: default replace current page
    try {
      window.location.href = url;
    } catch (e) {
      window.open(url, '_blank');
    }
  }

  // init
  const cfg = await loadConfig();
  // quick check: see if current location matches any inferred host
  const matchedAny = cfg.groups.some(g => g.items.some(it => {
    const inf = inferFromTemplate(it.urlTemplate);
    return inf && isLocationMatch(inf);
  }));
  if (!matchedAny) {
    // nothing to show on this page
    return;
  }
  createSidebar(cfg.groups, cfg.setting);

})();
