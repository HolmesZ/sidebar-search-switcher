// 侧边栏搜索（Sidebar Search）的最小内容脚本

// 扩展内置配置文件地址
const DATA_URL = chrome.runtime.getURL('data.json');
// 常见的搜索参数键名（优先级按顺序）
const SEARCH_PARAM_KEYS = [
    'q',
    'query',
    'queryText',
    'AllField',
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
let matchItemName = '';

// 从本地存储读取配置；若无则回退到扩展包内的 data.json，并写回缓存
async function loadConfig() {
    const storage = await chrome.storage.local.get(['sidebarConfig']);

    let raw = storage && (storage.sidebarConfig);
    if (!raw) {
        try {
            const res = await fetch(DATA_URL);
            raw = await res.json();

            // 归一化配置结构：将不同字段名映射为统一的 name / urlTemplate
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

function matchUrl(urlTemplate) {
    return location.href.startsWith(urlTemplate.split('?')[0]);
}

function createSidebar(groups, setting) {
    // 防重：全局仅创建一次根容器
    if (document.getElementById('sidebar-search-root')) return;

    const root = document.createElement('div');
    root.id = 'sidebar-search-root';
    root.className = 'ss-root ss-collapsed';

    // 面板容器（用于悬浮/点击展开）
    const panel = document.createElement('div');
    panel.className = 'ss-panel';
    panel.tabIndex = 0; // 允许通过键盘聚焦
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

            // 图标（通过 favicon 服务推断）
            const img = document.createElement('img');
            img.src = `https://favicon.im/${item.urlTemplate}`;
            img.alt = item.name || '';
            it.appendChild(img);

            // 名称文本
            const span = document.createElement('div');
            span.textContent = item.name;
            it.appendChild(span);

            // 数据属性：保留模板与推断结果（字符串化缓存）
            it.dataset.urlTemplate = item.urlTemplate;

            // 高亮当前匹配项
            if (matchItemName && matchItemName === item.name || matchUrl(item.urlTemplate)) {
                it.classList.add('active');
            }

            // 点击事件：导航至对应搜索结果
            it.addEventListener('click', (e) => {
                onClickEngine(item.urlTemplate);
            });

            g.appendChild(it);
        });
        list.appendChild(g);
    });

    panel.appendChild(list);
    root.appendChild(panel);
    document.body.appendChild(root);

    function expand() { root.classList.remove('ss-collapsed'); root.classList.add('ss-expanded'); }
    function collapse() { root.classList.remove('ss-expanded'); root.classList.add('ss-collapsed'); }
    
    // 初始折叠
    collapse();
    // 悬浮/点击/聚焦触发展开，提高在不同站点的可用性
    panel.addEventListener('mouseenter', expand);
    panel.addEventListener('click', () => root.classList.toggle('ss-expanded'));
    panel.addEventListener('focus', expand);
    // 鼠标离开根容器时收起
    root.addEventListener('mouseleave', collapse);
}

// 安全解码工具：将 + 视为空格并尝试解码 URI 组件
function safeDecode(v) {
    try { return decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return v.replace(/\+/g, ' '); }
}

// 解析 query string，按 SEARCH_PARAM_KEYS 顺序返回第一个匹配值
function parseParams(source) {
    if (!source) return null;
    const params = new URLSearchParams(source);
    for (const key of SEARCH_PARAM_KEYS) {
        const value = params.get(key);
        if (value) return safeDecode(value);
    }
    return null;
}

// 提取当前页面中的搜索关键词：依次从 URL 查询参数、哈希参数、以及常见文本输入框中推断
function extractKeyword() {
    const direct = parseParams(location.search.slice(1));
    if (direct) return direct;
    const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
    const hashQuery = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
    const hashValue = parseParams(hashQuery);
    if (hashValue) return hashValue;

    // 仅查询常见文本/搜索输入；保持原有可见性与包含性判断
    let decodedHref = location.href;
    try { decodedHref = decodeURIComponent(location.href); } catch (e) { /* noop */ }
    const inputs = document.querySelectorAll('input[type="search"], input[type="text"], input:not([type])');
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
    // 导航：默认在当前页跳转，失败则尝试新开标签页
    try {
        window.location.assign(url);
    } catch (e) {
        window.open(url, '_blank');
    }
}

(async function () {
    // 初始化
    const cfg = await loadConfig();

    // 快速判断：当前页面是否匹配任一引擎主机与路径前缀
    const matchedAny = cfg.groups.some(g => g.items.some(it => {
        if (matchUrl(it.urlTemplate)) {
            matchItemName = it.name;
            return true;
        }
    }));

    if (!matchedAny) {
        // 当前页面没有可关联的引擎，直接返回
        return;
    }
    createSidebar(cfg.groups, cfg.setting);
})();
