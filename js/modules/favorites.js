/* ==========================================================================
   梦角 · Dream Corner
   收藏模块  js/modules/favorites.js
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

import { mjPrompt, mjConfirm, mjAlert } from '../utils/dialogs.js';


const SOURCE_LABEL = {
    chat:   '聊天',
    letter: '信件',
    moment: '朋友圈',
    manual: '手动添加'
};

const TA_SEED_FAVORITES = [
    '你上次说想吃的那家店，我记下来了。',
    '你说过最喜欢冬天晒太阳，我也开始喜欢了。',
    '你笑起来的样子，我想收藏一辈子。',
    '你说"我在"的时候，心跳漏了一拍。',
    '你说想和我一起去看海，这句话我记住了。'
];

let _initialized = false;
let _unsubs = [];
let _currentTab = 'my';
let _multiSelectMode = false;
const _selectedIds = new Set();


/* ==========================================================================
   入口
   ========================================================================== */

export function initFavorites() {
    if (_initialized) return;
    _initialized = true;

    ensureFavoritesData();
    bindTabs();
    renderCurrentTab();

    _unsubs.push(
        bus.on('favorites:update', () => renderCurrentTab()),
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-favorites') {
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
   数据
   ========================================================================== */

function ensureFavoritesData() {
    const data = get(KEYS.FAVORITES);
    if (!Array.isArray(data.my)) data.my = [];
    if (!Array.isArray(data.ta)) data.ta = [];

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
   Tab 切换
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

    const wrap = byId('fav-tabs');
    if (wrap) {
        wrap.querySelectorAll('[data-fav-tab]').forEach((btn) => {
            const active = btn.dataset.favTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    exitMultiSelect();
    renderCurrentTab();
}


/* ==========================================================================
   多选模式
   ========================================================================== */

function enterMultiSelect() {
    _multiSelectMode = true;
    _selectedIds.clear();
    updateMultiUI();
    renderCurrentTab();
}

function exitMultiSelect() {
    _multiSelectMode = false;
    _selectedIds.clear();
    updateMultiUI();
}

function updateMultiUI() {
    const btn = byId('btn-favorites-multi-select');
    if (btn) btn.textContent = _multiSelectMode ? '完成' : '多选';

    const actions = byId('fav-multi-actions');
    if (actions) actions.hidden = !_multiSelectMode;
}

export function toggleMultiSelect() {
    if (_multiSelectMode) {
        exitMultiSelect();
        renderCurrentTab();
    } else {
        enterMultiSelect();
    }
}

export async function deleteSelected() {
    if (_selectedIds.size === 0) {
        toast('还没有选择');
        return;
    }

    const ok = await mjConfirm(`确定删除选中的 ${_selectedIds.size} 条收藏吗？`, {
        title: '删除收藏'
    });
    if (!ok) return;

    const list = getList(_currentTab).filter((f) => !_selectedIds.has(f.id));
    saveList(_currentTab, list);

    exitMultiSelect();
    renderCurrentTab();
    toast('已删除');
    bus.emit('favorites:update');
}


/* ==========================================================================
   渲染
   ========================================================================== */

function renderCurrentTab() {
    const wrap = byId('fav-list');
    const empty = byId('fav-empty');
    if (!wrap) return;

    const list = getList(_currentTab).slice().sort((a, b) => b.ts - a.ts);

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

function createFavEl(fav) {
    const item = document.createElement('div');
    item.className = 'fav-item';
    item.dataset.favId = fav.id;

    if (_multiSelectMode && _selectedIds.has(fav.id)) {
        item.classList.add('selected');
    }

    if (_multiSelectMode) {
        const check = document.createElement('span');
        check.className = 'fav-check';
        item.appendChild(check);
    }

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

    if (_multiSelectMode) {
        item.addEventListener('click', () => toggleSelect(fav.id, item));
    } else {
        item.addEventListener('click', () => showFavMenu(fav));
        attachLongPressDelete(item, fav);
    }

    return item;
}

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
   收藏菜单（点击弹出）
   ========================================================================== */

async function showFavMenu(fav) {
    const choice = await mjPrompt('操作这条收藏', {
        placeholder: '1. 复制  2. 删除',
        defaultValue: '1',
        confirmText: '执行'
    });
    if (choice === null) return;

    const n = parseInt(String(choice).trim(), 10);
    if (n === 1) copyText(fav.text || '');
    else if (n === 2) {
        const ok = await mjConfirm('删除这条收藏？', { title: '删除收藏' });
        if (!ok) return;
        const list = getList(_currentTab).filter((f) => f.id !== fav.id);
        saveList(_currentTab, list);
        renderCurrentTab();
        toast('已删除');
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


/* ==========================================================================
   长按删除
   ========================================================================== */

function attachLongPressDelete(el, fav) {
    let pressTimer = null;

    const start = () => {
        pressTimer = setTimeout(async () => {
            const ok = await mjConfirm('删除这条收藏？', { title: '删除收藏' });
            if (!ok) return;
            deleteFavById(fav.id);
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

    el.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        cancel();
        const ok = await mjConfirm('删除这条收藏？', { title: '删除收藏' });
        if (!ok) return;
        deleteFavById(fav.id);
    });
}

function deleteFavById(id) {
    const list = getList(_currentTab).filter((f) => f.id !== id);
    saveList(_currentTab, list);
    renderCurrentTab();
    toast('已删除');
}


/* ==========================================================================
   对外 API
   ========================================================================== */

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

export function isFavorited(text, owner = 'my') {
    const list = getList(owner);
    return list.some((f) => f.text === text);
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const favoritesActions = {
    'toggle-fav-multi-select': () => toggleMultiSelect(),
    'delete-selected-fav':     () => deleteSelected(),
    'cancel-fav-multi-select': () => {
        exitMultiSelect();
        renderCurrentTab();
    }
};

export const favoritesNavs = {
    'favorites': () => {
        ensureFavoritesData();
        exitMultiSelect();
        renderCurrentTab();
        showScreen('screen-favorites');
    }
};

export default {
    initFavorites,
    destroyFavorites,
    switchTab,
    addFavorite,
    isFavorited,
    favoritesActions,
    favoritesNavs
};
