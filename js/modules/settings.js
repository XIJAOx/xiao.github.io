/* ==========================================================================
   梦角 · Dream Corner
   设置模块  js/modules/settings.js
   ========================================================================== */

import {
    $, $$, byId,
    showScreen, openModal, closeModal,
    toast,
    setVisible, setText,
    setSwitch, getSwitch, setCheck, getCheck,
    formatDate, formatChatTime,
    uid, randomInt,
    escapeHtml,
    downloadFile, readFileAsText
} from '../utils/dom.js';

import {
    KEYS, DEFAULTS,
    get, set, update, remove, ensure,
    clearAll, exportAll, importAll,
    renderStorageSizes, formatBytes
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';

import { mjPrompt, mjConfirm, mjAlert, mjTextarea } from '../utils/dialogs.js';


const WORD_CARD_TABS = {
    main:     'main',
    kaomoji:  'kaomoji',
    emoji:    'emoji',
    sticker:  'sticker',
    voice:    'voice'
};

const THEMES = ['system', 'dark', 'light'];

const NOTIFICATION_PERMISSION_MAP = {
    granted: '已授权',
    denied:  '已拒绝',
    default: '未询问'
};

let _initialized = false;
let _unsubs = [];
let _currentWordCardTab = 'main';
let _currentWordCardFolder = null;
let _wordCardSelectMode = false;
const _selectedWordCardIds = new Set();

/* ==========================================================================
   入口
   ========================================================================== */

export function initSettings() {
    if (_initialized) return;
    _initialized = true;

    applyTheme(get(KEYS.THEME));

    bindReplyInputs();
    bindLetterInputs();
    bindMomentsInputs();
    bindWordCardTabs();

    _unsubs.push(
        bus.on('switch:change', onSwitchChange)
    );

    syncAllSwitches();
}

export function destroySettings() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   主题
   ========================================================================== */

export function applyTheme(mode) {
    if (!THEMES.includes(mode)) mode = 'system';

    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    set(KEYS.THEME, mode);

    updateDarkModeChecks(mode);
    bus.emit('theme:change', mode);
}

function updateDarkModeChecks(mode) {
    setCheck(byId('check-dark-system'), mode === 'system');
    setCheck(byId('check-dark-black'),  mode === 'dark');
    setCheck(byId('check-dark-white'),  mode === 'light');
}


/* ==========================================================================
   输入框持久化
   ========================================================================== */

function bindReplyInputs() {
    const map = {
        'reply-min-speed':  'minSpeed',
        'reply-max-speed':  'maxSpeed',
        'reply-min-count':  'minCount',
        'reply-max-count':  'maxCount'
    };
    Object.entries(map).forEach(([elId, key]) => {
        const el = byId(elId);
        if (!el) return;
        el.addEventListener('change', () => {
            const v = clampNumber(el.value, el.min, el.max, el.defaultValue);
            el.value = v;
            const s = get(KEYS.SETTINGS);
            s.reply[key] = parseInt(v, 10);
            set(KEYS.SETTINGS, s);
            bus.emit('settings:changed', { section: 'reply', key, value: v });
        });
    });
}

function bindLetterInputs() {
    const map = {
        'letter-min-time':  'minTime',
        'letter-max-time':  'maxTime',
        'letter-min-cards': 'minCards',
        'letter-max-cards': 'maxCards'
    };
    Object.entries(map).forEach(([elId, key]) => {
        const el = byId(elId);
        if (!el) return;
        el.addEventListener('change', () => {
            const v = clampNumber(el.value, el.min, el.max, el.defaultValue);
            el.value = v;
            const s = get(KEYS.SETTINGS);
            s.letter[key] = parseInt(v, 10);
            set(KEYS.SETTINGS, s);
            bus.emit('settings:changed', { section: 'letter', key, value: v });
        });
    });
}

function bindMomentsInputs() {
    const map = {
        'moments-min-time':  'minTime',
        'moments-max-time':  'maxTime',
        'moments-min-cards': 'minCards',
        'moments-max-cards': 'maxCards'
    };
    Object.entries(map).forEach(([elId, key]) => {
        const el = byId(elId);
        if (!el) return;
        el.addEventListener('change', () => {
            const v = clampNumber(el.value, el.min, el.max, el.defaultValue);
            el.value = v;
            const s = get(KEYS.SETTINGS);
            s.moments[key] = parseInt(v, 10);
            set(KEYS.SETTINGS, s);
            bus.emit('settings:changed', { section: 'moments', key, value: v });
        });
    });
}

function clampNumber(v, min, max, fallback) {
    const n = parseInt(v, 10);
    const lo = parseInt(min, 10);
    const hi = parseInt(max, 10);
    if (Number.isNaN(n)) return fallback;
    if (!Number.isNaN(lo) && n < lo) return String(lo);
    if (!Number.isNaN(hi) && n > hi) return String(hi);
    return String(n);
}


/* ==========================================================================
   开关持久化
   ========================================================================== */

function onSwitchChange({ id, value }) {
    if (!id) return;
    const s = get(KEYS.SETTINGS);
    if (!s.reply) s.reply = {};
    if (!s.moments) s.moments = {};
    if (!s.notification) s.notification = {};

    if (id === 'spell-card')       { s.reply.spellCard = value; set(KEYS.SETTINGS, s); return; }
    if (id === 'read-no-reply')    { s.reply.readNoReply = value; set(KEYS.SETTINGS, s); return; }
    if (id === 'ta-proactive')     { s.reply.taProactive = value; set(KEYS.SETTINGS, s); return; }
    if (id === 'moments-all-dream'){ s.moments.allDream = value; set(KEYS.SETTINGS, s); return; }
    if (id === 'moments-cross-comment') { s.moments.crossComment = value; set(KEYS.SETTINGS, s); return; }
    if (id === 'notification') {
        s.notification.enabled = value;
        set(KEYS.SETTINGS, s);
        if (value) requestNotificationPermission();
        return;
    }
    if (id === 'background-keepalive') {
        s.notification.backgroundKeepalive = value;
        set(KEYS.SETTINGS, s);
        return;
    }
}

function syncAllSwitches() {
    const s = get(KEYS.SETTINGS);
    setSwitch(byId('switch-spell-card'),     !!s.reply?.spellCard);
    setSwitch(byId('switch-read-no-reply'),  !!s.reply?.readNoReply);
    setSwitch(byId('switch-ta-proactive'),   !!s.reply?.taProactive);
    setSwitch(byId('switch-moments-all-dream'),     s.moments?.allDream !== false);
    setSwitch(byId('switch-moments-cross-comment'), s.moments?.crossComment !== false);
    setSwitch(byId('switch-notification'),          !!s.notification?.enabled);
    setSwitch(byId('switch-background-keepalive'),  !!s.notification?.backgroundKeepalive);
}


/* ==========================================================================
   弹窗同步
   ========================================================================== */

function setInputValue(id, value) {
    const el = byId(id);
    if (el && value !== undefined && value !== null) el.value = value;
}

export function syncReplyModal() {
    const s = get(KEYS.SETTINGS).reply || {};
    setInputValue('reply-min-speed', s.minSpeed);
    setInputValue('reply-max-speed', s.maxSpeed);
    setInputValue('reply-min-count', s.minCount);
    setInputValue('reply-max-count', s.maxCount);
    setSwitch(byId('switch-spell-card'),    !!s.spellCard);
    setSwitch(byId('switch-read-no-reply'), !!s.readNoReply);
    setSwitch(byId('switch-ta-proactive'),  !!s.taProactive);
}

export function syncLetterModal() {
    const s = get(KEYS.SETTINGS).letter || {};
    setInputValue('letter-min-time',  s.minTime);
    setInputValue('letter-max-time',  s.maxTime);
    setInputValue('letter-min-cards', s.minCards);
    setInputValue('letter-max-cards', s.maxCards);
}

export function syncMomentsModal() {
    const s = get(KEYS.SETTINGS).moments || {};
    setInputValue('moments-min-time',  s.minTime);
    setInputValue('moments-max-time',  s.maxTime);
    setInputValue('moments-min-cards', s.minCards);
    setInputValue('moments-max-cards', s.maxCards);
    setSwitch(byId('switch-moments-all-dream'),     s.allDream !== false);
    setSwitch(byId('switch-moments-cross-comment'), s.crossComment !== false);
}

export function syncNotificationModal() {
    const s = get(KEYS.SETTINGS).notification || {};
    setSwitch(byId('switch-notification'),         !!s.enabled);
    setSwitch(byId('switch-background-keepalive'), !!s.backgroundKeepalive);

    if ('Notification' in window) {
        const perm = NOTIFICATION_PERMISSION_MAP[Notification.permission] || '未知';
        const testBtn = byId('btn-test-notification');
        if (testBtn) testBtn.textContent = `测试（权限：${perm}）`;
    }
}


/* ==========================================================================
   后台通知
   ========================================================================== */

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        toast('当前浏览器不支持通知');
        return;
    }
    if (Notification.permission === 'granted') return;
    try {
        const result = await Notification.requestPermission();
        if (result === 'granted') toast('已开启通知权限');
        else if (result === 'denied') toast('通知权限被拒绝');
    } catch (e) {
        toast('通知权限请求失败');
    }
}

export function sendTestNotification() {
    if (!('Notification' in window)) {
        toast('当前浏览器不支持通知');
        return;
    }
    if (Notification.permission !== 'granted') {
        requestNotificationPermission();
        return;
    }
    try {
        new Notification('梦角', {
            body: '这是一条测试通知，如果你看到了它，说明通知功能正常 ♥'
        });
        toast('已发送测试通知');
    } catch (e) {
        toast('测试通知发送失败');
    }
}


/* ==========================================================================
   数据管理
   ========================================================================== */

export function exportData() {
    try {
        const json = exportAll();
        const filename = `mengjiao-backup-${formatDate()}.json`;
        downloadFile(json, filename);
        toast('数据已导出');
        closeModal('modal-data-settings');
    } catch (e) {
        toast('导出失败：' + (e.message || '未知错误'));
    }
}

export function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        const ok = await mjConfirm('导入会覆盖当前数据，确定继续吗？', {
            title: '导入数据'
        });
        if (!ok) return;

        try {
            const text = await readFileAsText(file);
            const result = importAll(text, { replace: true });
            if (!result.ok) {
                toast('导入失败：' + (result.error || '未知错误'));
                return;
            }
            toast(`成功导入 ${result.count} 项数据`);
            closeModal('modal-data-settings');
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            toast('导入失败：文件读取错误');
        }
    };
    input.click();
}

export async function clearData() {
    const ok1 = await mjConfirm('确定清除全部数据吗？此操作不可恢复！', {
        title: '清除数据'
    });
    if (!ok1) return;

    const ok2 = await mjConfirm('再次确认：所有聊天记录、信件、收藏等都会被删除。', {
        title: '最后确认'
    });
    if (!ok2) return;

    clearAll();
    toast('数据已清除，正在重启…');
    setTimeout(() => window.location.reload(), 800);
}


/* ==========================================================================
   存储
   ========================================================================== */

export function refreshStorageView() {
    try {
        renderStorageSizes();
    } catch (e) {
        console.warn('[settings] 刷新存储失败：', e);
    }
}


/* ==========================================================================
   字卡库
   ========================================================================== */

function bindWordCardTabs() {
    const tabsEl = byId('word-card-tabs');
    if (!tabsEl) return;
    tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-word-card-tab]');
        if (!btn) return;
        switchWordCardTab(btn.dataset.wordCardTab);
    });
}

export function switchWordCardTab(tab) {
    if (!WORD_CARD_TABS[tab]) return;
    _currentWordCardTab = tab;

    const tabsEl = byId('word-card-tabs');
    if (tabsEl) {
        tabsEl.querySelectorAll('[data-word-card-tab]').forEach((btn) => {
            const active = btn.dataset.wordCardTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    const data = get(KEYS.WORD_CARD);
    data.activeTab = tab;
    set(KEYS.WORD_CARD, data);

    renderWordCardList();
}

function renderWordCardList() {
    const wrap = byId('word-card-list');
    if (!wrap) return;

    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];

    if (!list.length) {
        wrap.innerHTML = `
            <div class="word-card-empty">
                <div class="word-card-empty-icon">🔍</div>
                <div class="word-card-empty-text">列表空空如也</div>
                <div class="word-card-empty-sub">暂无内容</div>
            </div>
        `;
        return;
    }

    wrap.innerHTML = '';

    list.forEach((item) => {
        const el = document.createElement('div');
        el.className = 'word-card-item';
        el.dataset.wordCardId = item.id;

        const textEl = document.createElement('span');
        textEl.textContent = item.text || item.name || item.url || '';
        textEl.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        el.appendChild(textEl);

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.style.cssText = 'flex:0 0 auto;padding:2px 8px;color:var(--c-text-3);border-radius:999px;font-size:12px;';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteWordCardItem(item.id);
        });
        el.appendChild(delBtn);

        el.addEventListener('click', () => {
            const content = item.text || item.url || '';
            if (content) copyToClipboard(content);
        });

        wrap.appendChild(el);
    });
}

export async function addWordCardItem() {
    const tab = _currentWordCardTab;
    let promptText = '输入内容：';
    if (tab === 'sticker') promptText = '输入图片 URL：';
    else if (tab === 'voice') promptText = '输入语音 URL：';

    const input = await mjPrompt(promptText, {
        placeholder: tab === 'sticker' || tab === 'voice' ? 'https://...' : '',
        confirmText: '添加'
    });
    if (input === null) return;
    const trimmed = String(input).trim();
    if (!trimmed) return;

    const data = get(KEYS.WORD_CARD);
    if (!Array.isArray(data[tab])) data[tab] = [];

    const item = { id: uid('wc') };
    if (tab === 'sticker') {
        item.url = trimmed;
        item.name = trimmed.slice(0, 20);
    } else if (tab === 'voice') {
        item.url = trimmed;
        item.duration = 0;
    } else {
        item.text = trimmed;
    }

    data[tab].push(item);
    set(KEYS.WORD_CARD, data);

    renderWordCardList();
    toast('已添加');
}

async function deleteWordCardItem(id) {
    const ok = await mjConfirm('删除这张字卡？', { title: '删除字卡' });
    if (!ok) return;

    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];
    data[_currentWordCardTab] = list.filter((x) => x.id !== id);
    set(KEYS.WORD_CARD, data);

    renderWordCardList();
    toast('已删除');
}

async function onWordCardSearch() {
    const kw = await mjPrompt('搜索字卡', {
        placeholder: '输入关键词',
        confirmText: '搜索'
    });
    if (!kw) return;
    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];
    const matched = list.filter((x) => {
        const s = x.text || x.name || x.url || '';
        return s.includes(kw);
    });
    toast(`找到 ${matched.length} 张匹配的字卡`);
}

function onWordCardFolder() {
    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];

    if (_wordCardSelectMode && _selectedWordCardIds.size > 0) {
        const name = window.prompt('把这些字卡归入哪个分组？（输入新名字即创建）', '');
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return;

        let count = 0;
        list.forEach((it) => {
            if (_selectedWordCardIds.has(it.id)) {
                it.folder = trimmed;
                count++;
            }
        });
        set(KEYS.WORD_CARD, data);

        _selectedWordCardIds.clear();
        _wordCardSelectMode = false;
        updateWordCardButtons();
        renderWordCardList();
        toast(`已将 ${count} 张字卡归入「${trimmed}」`);
        return;
    }

    const folders = {};
    list.forEach((it) => {
        const f = it.folder || '';
        if (f) folders[f] = (folders[f] || 0) + 1;
    });
    const folderNames = Object.keys(folders);

    const lines = ['0. 全部'];
    folderNames.forEach((name, i) => {
        lines.push(`${i + 1}. ${name}（${folders[name]} 张）`);
    });
    lines.push('');
    lines.push(`当前：${_currentWordCardFolder || '全部'}`);
    lines.push('');
    lines.push('输入序号筛选。');
    lines.push('提示：进入"多选"选中字卡后再点这里，可把它们归入分组。');

    const ans = window.prompt(lines.join('\n'), '0');
    if (ans === null) return;
    const trimmed = ans.trim();
    if (!trimmed) return;

    const n = parseInt(trimmed, 10);
    if (isNaN(n)) return;

    if (n === 0) {
        _currentWordCardFolder = null;
    } else if (n >= 1 && n <= folderNames.length) {
        _currentWordCardFolder = folderNames[n - 1];
    } else {
        return;
    }

    renderWordCardList();
    toast(_currentWordCardFolder ? `筛选：${_currentWordCardFolder}` : '显示全部');
}

function onWordCardSelect() {
    if (_wordCardSelectMode) {
        if (_selectedWordCardIds.size === 0) {
            _wordCardSelectMode = false;
            updateWordCardButtons();
            renderWordCardList();
            return;
        }
        if (!window.confirm(`确定删除选中的 ${_selectedWordCardIds.size} 张字卡吗？`)) return;

        const data = get(KEYS.WORD_CARD);
        const list = data[_currentWordCardTab] || [];
        data[_currentWordCardTab] = list.filter((x) => !_selectedWordCardIds.has(x.id));
        set(KEYS.WORD_CARD, data);

        _selectedWordCardIds.clear();
        _wordCardSelectMode = false;
        updateWordCardButtons();
        renderWordCardList();
        toast('已删除');
    } else {
        _wordCardSelectMode = true;
        _selectedWordCardIds.clear();
        updateWordCardButtons();
        renderWordCardList();
        toast('已进入多选模式，点击字卡选中，再点一下方块删除');
    }
}

function updateWordCardButtons() {
    const selectBtn = byId('btn-word-card-select');
    if (selectBtn) {
        selectBtn.textContent = _wordCardSelectMode
            ? (_selectedWordCardIds.size > 0 ? `🗑${_selectedWordCardIds.size}` : '⬜')
            : '⬛';
    }
}

function onWordCardImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        try {
            const text = await readFileAsText(file);
            const parsed = JSON.parse(text);

            if (!parsed || typeof parsed !== 'object') {
                toast('文件格式不正确');
                return;
            }

            const data = get(KEYS.WORD_CARD);
            const validKeys = ['main', 'kaomoji', 'emoji', 'sticker', 'voice'];
            validKeys.forEach((k) => {
                if (!Array.isArray(data[k])) data[k] = [];
            });

            let totalAdded = 0;

            // ---------- 情况 1：我们自己的格式 ----------
            const ourKeys = ['main', 'kaomoji', 'emoji', 'sticker', 'voice'];
            const hasOurKey = ourKeys.some((k) => Array.isArray(parsed[k]));
            const target = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
            const hasOurKeyInData = ourKeys.some((k) => Array.isArray(target[k]));

            if (hasOurKey || hasOurKeyInData) {
                const src = hasOurKeyInData ? target : parsed;
                ourKeys.forEach((k) => {
                    if (!Array.isArray(src[k])) return;
                    src[k].forEach((it) => {
                        if (!it || typeof it !== 'object') return;
                        if (!it.id) it.id = uid('wc');
                        data[k].push(it);
                        totalAdded++;
                    });
                });
            } else {
                // ---------- 情况 2：外部 App 格式 ----------
                // 尝试多个常见字段名
                const pickArray = (...keys) => {
                    for (const k of keys) {
                        if (Array.isArray(parsed[k]) && parsed[k].length) return parsed[k];
                    }
                    return null;
                };

                const normalizeItem = (it, tab) => {
                    if (it == null) return null;

                    // 字符串
                    if (typeof it === 'string') {
                        const s = it.trim();
                        if (!s) return null;
                        return tab === 'emoji'
                            ? { id: uid('wc'), text: s }
                            : { id: uid('wc'), text: s };
                    }

                    // 对象
                    if (typeof it === 'object') {
                        // 优先 text / content / reply / value
                        const textCandidate =
                            it.text ?? it.content ?? it.reply ?? it.value ??
                            it.title ?? it.name ?? it.msg ?? it.message;

                        // 是否明显是 emoji
                        const emojiCandidate = it.emoji ?? it.icon;

                        const obj = { id: it.id || uid('wc') };

                        if (textCandidate != null) obj.text = String(textCandidate);
                        if (emojiCandidate != null) obj.emoji = String(emojiCandidate);
                        if (it.folder) obj.folder = String(it.folder);
                        if (it.group) obj.folder = String(it.group);
                        if (it.url) obj.url = String(it.url);

                        // 至少要有一个内容字段
                        if (!obj.text && !obj.url && !obj.emoji) return null;
                        if (!obj.text && obj.emoji) obj.text = obj.emoji;

                        return obj;
                    }
                    return null;
                };

                const pushAll = (arr, tab) => {
                    if (!Array.isArray(arr)) return;
                    arr.forEach((it) => {
                        const obj = normalizeItem(it, tab);
                        if (!obj) return;
                        data[tab].push(obj);
                        totalAdded++;
                    });
                };

                // 主字卡可能的字段名
                pushAll(
                    pickArray('customReplies', 'replies', 'mottos', 'intros', 'statuses', 'pokes', 'words', 'cards', 'main'),
                    'main'
                );

                // emoji
                pushAll(pickArray('emojis', 'emoji'), 'emoji');

                // 颜文字
                pushAll(pickArray('kaomoji', 'kaomojis', 'faces'), 'kaomoji');
            }

            if (totalAdded === 0) {
                toast('文件里没有可导入的字卡');
                return;
            }

            set(KEYS.WORD_CARD, data);

            // 清空筛选，切到主字卡
            _currentWordCardFolder = null;
            _wordCardSelectMode = false;
            _selectedWordCardIds.clear();

            // 保证当前 tab 有内容
            if (!data[_currentWordCardTab] || !data[_currentWordCardTab].length) {
                _currentWordCardTab = 'main';
                const tabsEl = byId('word-card-tabs');
                if (tabsEl) {
                    tabsEl.querySelectorAll('[data-word-card-tab]').forEach((btn) => {
                        const active = btn.dataset.wordCardTab === 'main';
                        btn.classList.toggle('active', active);
                        btn.setAttribute('aria-selected', active ? 'true' : 'false');
                    });
                }
            }

            renderWordCardList();
            toast(`已导入 ${totalAdded} 张字卡`);
        } catch (e) {
            console.error('[word-card-import]', e);
            toast('导入失败：' + (e.message || '未知错误'));
        }
    };
    input.click();
              }

function onWordCardExport() {
    const data = get(KEYS.WORD_CARD);
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `mengjiao-word-cards-${formatDate()}.json`);
    toast('字卡已导出');
}

function copyToClipboard(text) {
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

export function syncWordCardModal() {
    const data = get(KEYS.WORD_CARD);
    const tab = data.activeTab || 'main';
    switchWordCardTab(tab);
}


/* ==========================================================================
   actions
   ========================================================================== */

export const settingsActions = {
    'open-word-card': () => {
        syncWordCardModal();
        openModal('modal-word-card');
    },
    'open-reply-settings': () => {
        syncReplyModal();
        openModal('modal-reply');
    },
    'open-letter-settings': () => {
        syncLetterModal();
        openModal('modal-letter-settings');
    },
    'open-moments-settings': () => {
        syncMomentsModal();
        openModal('modal-moments-settings');
    },
    'open-dark-mode': () => {
        updateDarkModeChecks(get(KEYS.THEME));
        openModal('modal-dark-mode');
    },
    'open-notification': () => {
        syncNotificationModal();
        openModal('modal-notification');
    },
    'open-data-settings': () => openModal('modal-data-settings'),
    'open-storage': () => {
        refreshStorageView();
        openModal('modal-storage');
    },

    'select-dark-mode': (el) => {
        const mode = el.dataset.mode;
        if (mode) applyTheme(mode);
    },

    'test-notification': () => sendTestNotification(),

    'import-data': () => importData(),
    'export-data': () => exportData(),
    'clear-data':  () => clearData(),

    'save-reply-settings': () => {
        toast('回复设置已保存');
        bus.emit('settings:changed');
        closeModal('modal-reply');
    },
    'save-moments-settings': () => {
        toast('朋友圈设置已保存');
        bus.emit('settings:changed');
        closeModal('modal-moments-settings');
    },

    'word-card-search': () => onWordCardSearch(),
    'word-card-folder': () => onWordCardFolder(),
    'word-card-select': () => onWordCardSelect(),
    'word-card-import': () => onWordCardImport(),
    'word-card-export': () => onWordCardExport(),
    'add-word-card':    () => addWordCardItem()
};


/* ==========================================================================
   对外导出
   ========================================================================== */

export default {
    initSettings,
    destroySettings,
    applyTheme,
    syncReplyModal,
    syncLetterModal,
    syncMomentsModal,
    syncNotificationModal,
    syncWordCardModal,
    refreshStorageView,
    settingsActions
};
