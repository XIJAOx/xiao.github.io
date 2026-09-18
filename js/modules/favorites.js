/* ==========================================================================
   梦角 · Dream Corner
   收藏模块  js/modules/favorites.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-favorites
       - #fav-tabs（我的收藏 / TA 的收藏）
       - #btn-favorites-multi-select（多选按钮）
       - #fav-list（收藏列表）
       - #fav-empty（空状态）
       - #fav-multi-actions（多选操作栏）
         - #btn-fav-delete
         - #btn-fav-cancel

   数据结构（KEYS.FAVORITES）：
     {
       my: [{ id, text, source, ts }],
       ta: [{ id, text, source, ts }]
     }

   来源：
     - 聊天长按收藏（source: 'chat'）
     - 信件收藏（source: 'letter'）
     - 手动添加（source: 'manual'）
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setVisible, setText,
    formatChatTime,
    uid, randomInt, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 来源标签 */
const SOURCE_LABEL = {
    chat:   '聊天',
    letter: '信件',
    moment: '朋友圈',
    manual: '手动添加'
};

/** TA 收藏的初始语料（首次打开时填充几条，避免空列表太冷清） */
const TA_SEED_FAVORITES = [
    '你上次说想吃的那家店，我记下来了。',
    '你说过最喜欢冬天晒太阳，我也开始喜欢了。',
    '你笑起来的样子，我想收藏一辈子。',
    '你说"我在"的时候，心跳漏了一拍。',
    '你说想和我一起去看海，这句话我记住了。'
];


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

let _currentTab = 'my';        // my / ta
let _multiSelectMode = false;  // 是否在多选模式
const _selectedIds = new Set(); // 多选模式下选中的 id


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initFavorites() {
    if (_initialized) return;
    _initialized = true;

    ensureFavoritesData();
    bindTabs();
    bindMultiSelect();
    bindMultiActions();

    renderCurrentTab();

    _unsubs.push(
        bus.on('favorites:update', () => renderCurrentTab()),
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-favorites') {
                // 进入页面时退出多选模式
                exitMultiSelect();
                renderCurrentTab();
            }
        })
    );
}

export function destroyFavorites() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensureFavoritesData() {
    const data = get(KEYS.FAVORITES);
    if (!Array.isArray(data.my)) data.my = [];
    if (!Array.isArray(data.ta)) data.ta = [];

    // 首次给 TA 填充几条，方便演示
    if (data.ta.length === 0 && data.my.length === 0) {
        data.ta = TA_SEED_FAVORITES.map((text, i) => ({
            id: uid('fav'),
            text,
            source: 'chat',
            ts: Date.now() - (i + 1) * 3600 * 1000
        }));
    }

    set(KEYS.FAVORITES, data);
    return data;
}

function getList(tab) {
    const data = ensureFavoritesData();
    return data[tab] || [];
}

function saveList(tab, list) {
    const data = get(KEYS.FAVORITES);
    data[tab] = list;
    set(KEYS.FAVORITES, data);
}


/* ==========================================================================
   05. Tab 切换
   ========================================================================== */

function bindTabs() {
    const wrap = byId('fav-tabs');
    if (!wrap) return;

    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fav-tab]');
        if (!btn) return;
        switchTab(btn.dataset.favTab);
    });
}

export function switchTab(tab) {
    if (tab !== 'my' && tab !== 'ta') return;
    _currentTab = tab;

    // 更新按钮
    const wrap = byId('fav-tabs');
    if (wrap) {
        wrap.querySelectorAll('[data-fav-tab]').forEach((btn) => {
            const active = btn.dataset.favTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    // 切换 tab 时退出多选
    exitMultiSelect();
    renderCurrentTab();
}


/* ==========================================================================
   06. 多选模式
   ========================================================================== */

function bindMultiSelect() {
    const btn = byId('btn-favorites-multi-select');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (_multiSelectMode) {
            exitMultiSelect();
        } else {
            enterMultiSelect();
        }
    });
}

function enterMultiSelect() {
    _multiSelectMode = true;
    _selectedIds.clear();

    const btn = byId('btn-favorites-multi-select');
    if (btn) btn.textContent = '完成';

    const actions = byId('fav-multi-actions');
    if (actions) actions.hidden = false;

    renderCurrentTab();
}

function exitMultiSelect() {
    _multiSelectMode = false;
    _selectedIds.clear();

    const btn = byId('btn-favorites-multi-select');
    if (btn) btn.textContent = '多选';

    const actions = byId('fav-multi-actions');
    if (actions) actions.hidden = true;

    renderCurrentTab();
}

function bindMultiActions() {
    const delBtn = byId('btn-fav-delete');
    if (delBtn) delBtn.addEventListener('click', deleteSelected);

    const cancelBtn = byId('btn-fav-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', exitMultiSelect);
}

function deleteSelected() {
    if (_selectedIds.size === 0) {
        toast('还没有选择');
        return;
    }

    if (!window.confirm(`确定删除选中的 ${_selectedIds.size} 条收藏吗？`)) return;

    const list = getList(_currentTab).filter((f) => !_selectedIds.has(f.id));
    saveList(_currentTab, list);

    _selectedIds.clear();
    _multiSelectMode = false;

    const btn = byId('btn-favorites-multi-select');
    if (btn) btn.textContent = '多选';
    const actions = byId('fav-multi-actions');
    if (actions) actions.hidden = true;

    renderCurrentTab();
    toast('已删除');
    bus.emit('favorites:update');
}


/* ==========================================================================
   07. 渲染列表
   --------------------------------------------------------------------------
   DOM 结构对齐 CSS：
     .fav-item
       .fav-check      （多选时显示）
       .fav-main
         .fav-text
         .fav-meta
   ========================================================================== */

function renderCurrentTab() {
    const wrap = byId('fav-list');
    const empty = byId('fav-empty');
    if (!wrap) return;

    const list = getList(_currentTab).slice().sort((a, b) => b.ts - a.ts);

    // 清空
    Array.from(wrap.children).forEach((child) => {
        if (child !== empty) child.remove();
    });

    if (!list.length) {
        if (empty) empty.hidden = false;
        if (_multiSelectMode) exitMultiSelect();
        return;
    }
    if (empty) empty.hidden = true;

    const fragment = document.createDocumentFragment();
    list.forEach((fav) => fragment.appendChild(createFavEl(fav)));
    wrap.appendChild(fragment);
}

/**
 * 创建单条收藏 DOM
 * @param {Object} fav
 * @returns {HTMLElement}
 */
function createFavEl(fav) {
    const item = document.createElement('div');
    item.className = 'fav-item';
    item.dataset.favId = fav.id;

    if (_multiSelectMode && _selectedIds.has(fav.id)) {
        item.classList.add('selected');
    }

    // 多选勾选圈
    if (_multiSelectMode) {
        const check = document.createElement('span');
        check.className = 'fav-check';
        item.appendChild(check);
    }

    // 主体
    const main = document.createElement('div');
    main.className = 'fav-main';

    const textEl = document.createElement('div');
    textEl.className = 'fav-text';
    textEl.textContent = fav.text || '';
    main.appendChild(textEl);

    const meta = document.createElement('div');
    meta.className = 'fav-meta';

    const sourceEl = document.createElement('span');
    sourceEl.textContent = SOURCE_LABEL[fav.source] || '收藏';
    meta.appendChild(sourceEl);

    const timeEl = document.createElement('span');
    timeEl.textContent = formatChatTime(fav.ts);
    meta.appendChild(timeEl);

    main.appendChild(meta);
    item.appendChild(main);

    // 事件
    if (_multiSelectMode) {
        item.addEventListener('click', () => toggleSelect(fav.id, item));
    } else {
        item.addEventListener('click', () => showFavDetail(fav));
        // 长按删除
        attachLongPressDelete(item, fav);
    }

    return item;
}

/**
 * 多选：切换选中
 */
function toggleSelect(id, itemEl) {
    if (_selectedIds.has(id)) {
        _selectedIds.delete(id);
        itemEl.classList.remove('selected');
    } else {
        _selectedIds.add(id);
        itemEl.classList.add('selected');
    }
}


/* ==========================================================================
   08. 详情 & 长按删除
   ========================================================================== */

/**
 * 展示收藏详情（弹 prompt 复制）
 */
function showFavDetail(fav) {
    const choice = window.prompt(
        '输入序号操作：\n1. 复制\n2. 删除',
        '1'
    );
    if (choice === null) return;

    const n = parseInt(choice, 10);
    if (n === 1) {
        copyText(fav.text || '');
    } else if (n === 2) {
        if (window.confirm('删除这条收藏？')) {
            const list = getList(_currentTab).filter((f) => f.id !== fav.id);
            saveList(_currentTab, list);
            renderCurrentTab();
            toast('已删除');
        }
    }
}

function copyText(text) {
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
            () => toast('已复制'),
            () => toast('复制失败')
        );
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('已复制'); }
        catch (e) { toast('复制失败'); }
        ta.remove();
    }
}

/**
 * 长按删除
 */
function attachLongPressDelete(el, fav) {
    let pressTimer = null;

    const start = () => {
        pressTimer = setTimeout(() => {
            if (window.confirm('删除这条收藏？')) {
                const list = getList(_currentTab).filter((f) => f.id !== fav.id);
                saveList(_currentTab, list);
                renderCurrentTab();
                toast('已删除');
            }
        }, 700);
    };
    const cancel = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('touchcancel', cancel);

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancel();
        if (window.confirm('删除这条收藏？')) {
            const list = getList(_currentTab).filter((f) => f.id !== fav.id);
            saveList(_currentTab, list);
            renderCurrentTab();
            toast('已删除');
        }
    });
}


/* ==========================================================================
   09. 对外 API：添加收藏
   --------------------------------------------------------------------------
   供 chat.js / letters.js 等模块调用
   ========================================================================== */

/**
 * 添加一条收藏
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.source='manual']  chat / letter / moment / manual
 * @param {'my'|'ta'} [options.owner='my']
 * @returns {Object}
 */
export function addFavorite(text, options = {}) {
    const { source = 'manual', owner = 'my' } = options;
    const trimmed = String(text || '').trim();
    if (!trimmed) return null;

    const data = get(KEYS.FAVORITES);
    if (!Array.isArray(data[owner])) data[owner] = [];

    const fav = {
        id: uid('fav'),
        text: trimmed,
        source,
        ts: Date.now()
    };
    data[owner].push(fav);
    set(KEYS.FAVORITES, data);

    bus.emit('favorites:update');
    return fav;
}

/**
 * 判断某段文本是否已收藏
 * @param {string} text
 * @param {'my'|'ta'} [owner='my']
 * @returns {boolean}
 */
export function isFavorited(text, owner = 'my') {
    const list = getList(owner);
    return list.some((f) => f.text === text);
}


/* ==========================================================================
   10. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const favoritesActions = {
    'toggle-fav-multi-select': () => {
        if (_multiSelectMode) exitMultiSelect();
        else enterMultiSelect();
    },
    'delete-selected-fav': () => deleteSelected(),
    'cancel-fav-multi-select': () => exitMultiSelect()
};

export const favoritesNavs = {
    'favorites': () => {
        ensureFavoritesData();
        exitMultiSelect();
        renderCurrentTab();
        showScreen('screen-favorites');
    }
};


/* ==========================================================================
   11. 对外导出
   ========================================================================== */

export default {
    initFavorites,
    destroyFavorites,
    switchTab,
    addFavorite,
    isFavorited,
    favoritesActions,
    favoritesNavs
};