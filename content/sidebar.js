// Minimal content script for Sidebar Search

const DATA_URL = chrome.runtime.getURL('data.json');
const SEARCH_PARAM_KEYS = [
    'q',
    'keyword',
    'key',
    'searchKeyWord',
    'kw',
    'wd',
    'text',
    'w',
    's',
    'exxshu'
];
const inferenceCache = new Map();


// Load configuration from storage or fallback to bundled data.json
async function loadConfig() {
    const storage = await chrome.storage.local.get(['sidebarConfig']);

    let raw = storage && (storage.sidebarConfig);
    if (!raw) {
        try {
            const res = await fetch(DATA_URL);
            raw = await res.json();

            // normalize config
            raw.listData = raw.listData.map(g => ({
                name: g.name || g.title || '',
                items: (g.items || g.list || []).map(it => ({
                    name: it.name || it.title || 'unnamed',
                    urlTemplate: it.urlTemplate || it.engine || it.url || ''
                }))
            }));

            chrome.storage.local.set({ sidebarConfig: raw });
        } catch (e) {
            console.error('Failed to load data.json', e);
            raw = { setting: {}, listData: [] };
        }
    }

    return { setting: raw.setting || {}, groups: raw.listData || [] };
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
        const pathPrefix = rawPath === '/' ? '/' : rawPath.replace(/\/+/g, '/').replace(/\/$/, '');
        const strict = `${protocol}//${host}${port}${pathPrefix}*`;
        const parts = host.split('.');
        const root = parts.length > 2 ? parts.slice(-2).join('.') : host;
        const loose = `${protocol}//*.${root}/*`;
        return { protocol, host, port, pathPrefix, strict, loose, root };
    } catch (e) {
        return null;
    }
}

function getInference(template) {
    if (!template) return null;
    if (inferenceCache.has(template)) return inferenceCache.get(template);
    const inferred = inferFromTemplate(template);
    inferenceCache.set(template, inferred);
    return inferred;
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

    // merged panel + edge element
    const panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.tabIndex = 0; // make focusable for keyboard
    panel.title = 'Sidebar Search';

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
            // fetch favicon via favicon.im based on inferred host
            const host = getInference(item.urlTemplate);
            const faviconUrl = host ? `https://favicon.im/${host.host}` : '';
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
            const inferred = host;
            if (inferred) {
                it.dataset._inf_host = inferred.host;
                it.dataset._inf_protocol = inferred.protocol;
            }
            g.appendChild(it);
        });
        list.appendChild(g);
    });

    panel.appendChild(list);
    root.appendChild(panel);
    document.body.appendChild(root);

    function expand() { root.classList.remove('ss-collapsed'); root.classList.add('ss-expanded'); }
    function collapse() { root.classList.remove('ss-expanded'); root.classList.add('ss-collapsed'); }
    
    // initial collapsed
    collapse();
    // open on hover, click or focus for better reliability across sites
    panel.addEventListener('mouseenter', expand);
    panel.addEventListener('click', () => root.classList.toggle('ss-expanded'));
    panel.addEventListener('focus', expand);
    // close when leaving panel area
    root.addEventListener('mouseleave', collapse);
    // close on Escape
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') collapse(); });

    // update active states based on current location
    function updateActiveStates() {
        const items = root.querySelectorAll('.ss-item');
        items.forEach(el => {
            const tpl = el.dataset.urlTemplate;
            const inf = getInference(tpl);
            if (inf && isLocationMatch(inf)) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    // initial update
    updateActiveStates();
}

// 获取当前搜索关键词
function parseParams(source) {
    if (!source) return null;
    const params = new URLSearchParams(source);
    for (const key of SEARCH_PARAM_KEYS) {
        const value = params.get(key);
        if (value) {
            try {
                return decodeURIComponent(value.replace(/\+/g, ' '));
            } catch (e) {
                return value.replace(/\+/g, ' ');
            }
        }
    }
    return null;
}

function extractKeyword() {
    const direct = parseParams(location.search.slice(1));
    if (direct) return direct;
    const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
    const hashValue = parseParams(hashQuery);
    if (hashValue) return hashValue;

    const inputs = document.getElementsByTagName('input');
    let decodedHref = location.href;
    try { decodedHref = decodeURIComponent(location.href); } catch (e) { /* noop */ }
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (
            input.clientWidth > 80 &&
            input.clientHeight > 0 &&
            input.value &&
            decodedHref.includes(input.value)
        ) {
            return input.value;
        }
    }
    return '';
}

function onClickEngine(template) {
    if (!template) return;
    const keyword = extractKeyword();
    const encoded = keyword ? encodeURIComponent(keyword) : '';
    const url = template.replace(/\{keyword\}/g, encoded).replace(/%s/g, encoded);
    // navigate: default replace current page
    try {
        window.location.assign(url);
    } catch (e) {
        window.open(url, '_blank');
    }
}

(async function () {
    // Init
    const cfg = await loadConfig();
    // Quick check: see if current location matches any inferred host
    const matchedAny = cfg.groups.some(g => g.items.some(it => {
        const inf = getInference(it.urlTemplate);
        return inf && isLocationMatch(inf);
    }));
    if (!matchedAny) {
        // Nothing to show on this page
        return;
    }
    createSidebar(cfg.groups, cfg.setting);
})();
