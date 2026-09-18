/* ==========================================================================
   梦角 · Dream Corner
   设置模块  js/modules/settings.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-settings 页面
       8 个入口（都带 data-action）：
         open-word-card        → #modal-word-card     字卡库
         open-reply-settings   → #modal-reply         回复
         open-letter-settings  → #modal-letter-settings 信件
         open-moments-settings → #modal-moments-settings 朋友圈
         open-dark-mode        → #modal-dark-mode     深色模式
         open-notification     → #modal-notification  后台通知
         open-data-settings    → #modal-data-settings 数据
         open-storage          → #modal-storage       存储

   数据来源：
     KEYS.SETTINGS      回复 / 信件 / 朋友圈 / 通知
     KEYS.THEME         深色模式
     KEYS.WORD_CARD     字卡库
     其他 KEYS         数据导入导出 / 存储统计
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


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 字卡 tab 名 → 存储字段名 */
const WORD_CARD_TABS = {
    main:     'main',
    kaomoji:  'kaomoji',
    emoji:    'emoji',
    sticker:  'sticker',
    voice:    'voice'
};

/** 深色模式可选值 */
const THEMES = ['system', 'dark', 'light'];

/** 通知权限状态 */
const NOTIFICATION_PERMISSION_MAP = {
    granted: '已授权',
    denied:  '已拒绝',
    default: '未询问'
};


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

/** 当前字卡库的 tab */
let _currentWordCardTab = 'main';


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initSettings() {
    if (_initialized) return;
    _initialized = true;

    // 应用初始主题
    applyTheme(get(KEYS.THEME));

    // 绑定设置页里所有输入控件的持久化
    bindReplyInputs();
    bindLetterInputs();
    bindMomentsInputs();

    // 绑定各弹窗里需要额外逻辑的按钮
    bindDarkModeChecks();
    bindNotificationButtons();
    bindDataButtons();
    bindWordCardButtons();

    // 全局订阅：所有带 data-switch-id 的开关在变化时持久化
    _unsubs.push(
        bus.on('switch:change', onSwitchChange)
    );

    // 全局订阅：通知相关设置单独处理
    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-settings') {
                // 每次进入设置页，刷新字卡库等
                // 不做强制刷新，让用户主动打开弹窗时再同步
            }
        })
    );

    // 同步一次所有开关的初始状态
    syncAllSwitches();
}

export function destroySettings() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 主题（深色模式）
   ========================================================================== */

/**
 * 应用主题
 * @param {'system'|'dark'|'light'} mode
 */
export function applyTheme(mode) {
    if (!THEMES.includes(mode)) mode = 'system';

    const root = document.documentElement;

    if (mode === 'system') {
        root.setAttribute('data-theme', 'system');
    } else {
        root.setAttribute('data-theme', mode);
    }

    // 持久化
    set(KEYS.THEME, mode);

    // 同步弹窗里的勾选
    updateDarkModeChecks(mode);

    // 通知其他模块
    bus.emit('theme:change', mode);
}

/**
 * 同步深色模式弹窗里三个勾选
 */
function updateDarkModeChecks(mode) {
    setCheck(byId('check-dark-system'), mode === 'system');
    setCheck(byId('check-dark-black'),  mode === 'dark');
    setCheck(byId('check-dark-white'),  mode === 'light');
}

function bindDarkModeChecks() {
    // HTML 里三个按钮都带 data-action="select-dark-mode" 和 data-mode
    // 这里不用 addEventListener，由 event.js 分发 → settingsActions['select-dark-mode']
}


/* ==========================================================================
   05. 回复设置
   --------------------------------------------------------------------------
   HTML 里的 id：
     #reply-min-speed / #reply-max-speed
     #reply-min-count / #reply-max-count
     #switch-spell-card / #switch-read-no-reply / #switch-ta-proactive
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

            const settings = get(KEYS.SETTINGS);
            settings.reply[key] = v;
            set(KEYS.SETTINGS, settings);

            bus.emit('settings:changed', { section: 'reply', key, value: v });
        });
    });
}


/* ==========================================================================
   06. 信件设置
   ========================================================================== */

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

            const settings = get(KEYS.SETTINGS);
            settings.letter[key] = v;
            set(KEYS.SETTINGS, settings);

            bus.emit('settings:changed', { section: 'letter', key, value: v });
        });
    });
}


/* ==========================================================================
   07. 朋友圈设置
   ========================================================================== */

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

            const settings = get(KEYS.SETTINGS);
            settings.moments[key] = v;
            set(KEYS.SETTINGS, settings);

            bus.emit('settings:changed', { section: 'moments', key, value: v });
        });
    });
}


/* ==========================================================================
   08. 开关持久化
   --------------------------------------------------------------------------
   HTML 里所有 .switch 都带 data-switch-id，点击后 event.js 会发 'switch:change'
   这里统一把变化写回对应的设置里。
   ========================================================================== */

function onSwitchChange({ id, value }) {
    if (!id) return;

    // 回复
    if (id === 'spell-card') {
        const s = get(KEYS.SETTINGS);
        s.reply.spellCard = value;
        set(KEYS.SETTINGS, s);
        bus.emit('settings:changed', { section: 'reply', key: 'spellCard', value });
        return;
    }
    if (id === 'read-no-reply') {
        const s = get(KEYS.SETTINGS);
        s.reply.readNoReply = value;
        set(KEYS.SETTINGS, s);
        bus.emit('settings:changed', { section: 'reply', key: 'readNoReply', value });
        return;
    }
    if (id === 'ta-proactive') {
        const s = get(KEYS.SETTINGS);
        s.reply.taProactive = value;
        set(KEYS.SETTINGS, s);
        bus.emit('settings:changed', { section: 'reply', key: 'taProactive', value });
        return;
    }

    // 朋友圈
    if (id === 'moments-all-dream') {
        const s = get(KEYS.SETTINGS);
        s.moments.allDream = value;
        set(KEYS.SETTINGS, s);
        return;
    }
    if (id === 'moments-cross-comment') {
        const s = get(KEYS.SETTINGS);
        s.moments.crossComment = value;
        set(KEYS.SETTINGS, s);
        return;
    }

    // 通知
    if (id === 'notification') {
        const s = get(KEYS.SETTINGS);
        s.notification.enabled = value;
        set(KEYS.SETTINGS, s);
        if (value) requestNotificationPermission();
        return;
    }
    if (id === 'background-keepalive') {
        const s = get(KEYS.SETTINGS);
        s.notification.backgroundKeepalive = value;
        set(KEYS.SETTINGS, s);
        return;
    }

    // 聊天信息（免打扰 / 置顶）由 chat.js 处理，此处跳过
}

/**
 * 启动时同步所有带 data-switch-id 的开关状态
 */
function syncAllSwitches() {
    const s = get(KEYS.SETTINGS);

    // 回复
    setSwitch(byId('switch-spell-card'),     !!s.reply.spellCard);
    setSwitch(byId('switch-read-no-reply'),  !!s.reply.readNoReply);
    setSwitch(byId('switch-ta-proactive'),   !!s.reply.taProactive);

    // 朋友圈
    setSwitch(byId('switch-moments-all-dream'),     s.moments.allDream !== false);
    setSwitch(byId('switch-moments-cross-comment'), s.moments.crossComment !== false);

    // 通知
    setSwitch(byId('switch-notification'),          !!s.notification.enabled);
    setSwitch(byId('switch-background-keepalive'),  !!s.notification.backgroundKeepalive);
}

/**
 * 打开某个设置弹窗前同步表单值
 */
export function syncReplyModal() {
    const s = get(KEYS.SETTINGS).reply;
    setInputValue('reply-min-speed', s.minSpeed);
    setInputValue('reply-max-speed', s.maxSpeed);
    setInputValue('reply-min-count', s.minCount);
    setInputValue('reply-max-count', s.maxCount);
    setSwitch(byId('switch-spell-card'),    !!s.spellCard);
    setSwitch(byId('switch-read-no-reply'), !!s.readNoReply);
    setSwitch(byId('switch-ta-proactive'),  !!s.taProactive);
}

export function syncLetterModal() {
    const s = get(KEYS.SETTINGS).letter;
    setInputValue('letter-min-time',  s.minTime);
    setInputValue('letter-max-time',  s.maxTime);
    setInputValue('letter-min-cards', s.minCards);
    setInputValue('letter-max-cards', s.maxCards);
}

export function syncMomentsModal() {
    const s = get(KEYS.SETTINGS).moments;
    setInputValue('moments-min-time',  s.minTime);
    setInputValue('moments-max-time',  s.maxTime);
    setInputValue('moments-min-cards', s.minCards);
    setInputValue('moments-max-cards', s.maxCards);
    setSwitch(byId('switch-moments-all-dream'),     s.allDream !== false);
    setSwitch(byId('switch-moments-cross-comment'), s.crossComment !== false);
}

function setInputValue(id, value) {
    const el = byId(id);
    if (el && value !== undefined && value !== null) el.value = value;
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
   09. 后台通知
   ========================================================================== */

function bindNotificationButtons() {
    const testBtn = byId('btn-test-notification');
    if (testBtn) {
        testBtn.addEventListener('click', sendTestNotification);
    }
}

/**
 * 请求通知权限
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        toast('当前浏览器不支持通知');
        return;
    }
    if (Notification.permission === 'granted') return;

    try {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
            toast('已开启通知权限');
        } else if (result === 'denied') {
            toast('通知权限被拒绝');
        }
    } catch (e) {
        toast('通知权限请求失败');
    }
}

/**
 * 发送一条测试通知
 */
function sendTestNotification() {
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
            body: '这是一条测试通知，如果你看到了它，说明通知功能正常 ♥',
            icon: ''
        });
        toast('已发送测试通知');
    } catch (e) {
        toast('测试通知发送失败');
    }
}


/* ==========================================================================
   10. 数据管理（导入 / 导出 / 清除）
   ========================================================================== */

function bindDataButtons() {
    const importBtn = byId('btn-import-data');
    if (importBtn) importBtn.addEventListener('click', importData);

    const exportBtn = byId('btn-export-data');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    const clearBtn = byId('btn-clear-data');
    if (clearBtn) clearBtn.addEventListener('click', clearData);
}

/**
 * 导出数据
 */
function exportData() {
    const json = exportAll();
    const filename = `mengjiao-backup-${formatDate()}.json`;
    downloadFile(json, filename);
    toast('数据已导出');
    closeModal('modal-data-settings');
}

/**
 * 导入数据
 */
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        if (!window.confirm('导入会覆盖当前数据，确定继续吗？')) return;

        try {
            const text = await readFileAsText(file);
            const result = importAll(text, { replace: true });
            if (!result.ok) {
                toast('导入失败：' + (result.error || '未知错误'));
                return;
            }
            toast(`成功导入 ${result.count} 项数据`);
            closeModal('modal-data-settings');

            // 重启页面让所有模块重新加载数据（最稳妥）
            setTimeout(() => window.location.reload(), 800);
        } catch (e) {
            toast('导入失败：文件读取错误');
        }
    };
    input.click();
}

/**
 * 清除数据
 */
function clearData() {
    if (!window.confirm('确定清除全部数据吗？\n此操作不可恢复！')) return;
    if (!window.confirm('再次确认：所有聊天记录、信件、收藏等都会被删除。')) return;

    clearAll();
    toast('数据已清除，正在重启…');
    setTimeout(() => window.location.reload(), 800);
}


/* ==========================================================================
   11. 存储统计
   ========================================================================== */

/**
 * 刷新存储弹窗里的字节数
 */
export function refreshStorageView() {
    renderStorageSizes();
}


/* ==========================================================================
   12. 字卡库
   --------------------------------------------------------------------------
   HTML 里的 id：
     #word-card-tabs   5 个 tab
     #word-card-icons  5 个图标按钮
     #word-card-list   列表
     #word-card-empty  空状态
     #btn-add-word-card / #btn-close-word-card

   数据结构（KEYS.WORD_CARD）：
     {
       main:     [{ id, text, folder }],
       kaomoji:  [{ id, text }],
       emoji:    [{ id, text }],
       sticker:  [{ id, url, name }],
       voice:    [{ id, url, duration }],
       folders:  [{ id, name }],
       activeTab:'main'
     }
   ========================================================================== */

function bindWordCardButtons() {
    // Tab 切换
    const tabsEl = byId('word-card-tabs');
    if (tabsEl) {
        tabsEl.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-word-card-tab]');
            if (!btn) return;
            switchWordCardTab(btn.dataset.wordCardTab);
        });
    }

    // 新增
    const addBtn = byId('btn-add-word-card');
    if (addBtn) addBtn.addEventListener('click', addWordCardItem);

    // 图标按钮（搜索 / 文件夹 / 选择 / 导入 / 导出）
    const iconMap = {
        'btn-word-card-search':  onWordCardSearch,
        'btn-word-card-folder':  onWordCardFolder,
        'btn-word-card-select':  onWordCardSelect,
        'btn-word-card-import':  onWordCardImport,
        'btn-word-card-export':  onWordCardExport
    };
    Object.entries(iconMap).forEach(([id, fn]) => {
        const btn = byId(id);
        if (btn) btn.addEventListener('click', fn);
    });
}

/**
 * 切换字卡 tab
 * @param {'main'|'kaomoji'|'emoji'|'sticker'|'voice'} tab
 */
export function switchWordCardTab(tab) {
    if (!WORD_CARD_TABS[tab]) return;
    _currentWordCardTab = tab;

    // 更新按钮
    const tabsEl = byId('word-card-tabs');
    if (tabsEl) {
        tabsEl.querySelectorAll('[data-word-card-tab]').forEach((btn) => {
            const active = btn.dataset.wordCardTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    // 记录当前 tab
    const data = get(KEYS.WORD_CARD);
    data.activeTab = tab;
    set(KEYS.WORD_CARD, data);

    renderWordCardList();
}

/**
 * 渲染字卡列表
 */
function renderWordCardList() {
    const wrap = byId('word-card-list');
    if (!wrap) return;

    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];

    // 空状态
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
        // 长内容省略
        textEl.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        el.appendChild(textEl);

        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.style.cssText = 'flex:0 0 auto;padding:2px 8px;color:var(--c-text-3);border-radius:999px;font-size:12px;';
        delBtn.addEventListener('click', () => {
            deleteWordCardItem(item.id);
        });
        el.appendChild(delBtn);

        // 点击复制
        el.addEventListener('click', (e) => {
            if (e.target === delBtn) return;
            const content = item.text || item.url || '';
            if (content) copyToClipboard(content);
        });

        wrap.appendChild(el);
    });
}

/**
 * 新增字卡
 */
function addWordCardItem() {
    const tab = _currentWordCardTab;
    let prompt_text = '输入内容：';
    if (tab === 'sticker') prompt_text = '输入图片 URL：';
    else if (tab === 'voice') prompt_text = '输入语音 URL：';

    const input = window.prompt(prompt_text, '');
    if (input === null) return;
    const trimmed = input.trim();
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

/**
 * 删除字卡
 */
function deleteWordCardItem(id) {
    if (!window.confirm('删除这张字卡？')) return;

    const data = get(KEYS.WORD_CARD);
    const list = data[_currentWordCardTab] || [];
    data[_currentWordCardTab] = list.filter((x) => x.id !== id);
    set(KEYS.WORD_CARD, data);

    renderWordCardList();
    toast('已删除');
}

/* ---------- 字卡工具按钮 ---------- */

function onWordCardSearch() {
    const kw = window.prompt('搜索字卡：', '');
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
    toast('文件夹功能开发中');
}

function onWordCardSelect() {
    toast('批量选择功能开发中');
}

function onWordCardImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
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
            // 简单合并
            const data = get(KEYS.WORD_CARD);
            Object.keys(parsed).forEach((k) => {
                if (Array.isArray(parsed[k])) {
                    data[k] = (data[k] || []).concat(parsed[k]);
                }
            });
            set(KEYS.WORD_CARD, data);
            renderWordCardList();
            toast('字卡已导入');
        } catch (e) {
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

/**
 * 复制到剪贴板
 */
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

/**
 * 打开字卡库时同步
 */
export function syncWordCardModal() {
    const data = get(KEYS.WORD_CARD);
    const tab = data.activeTab || 'main';
    switchWordCardTab(tab);
    renderWordCardList();
}


/* ==========================================================================
   13. 供 app.js 注册的 action 集合
   ========================================================================== */

export const settingsActions = {
    /* ---------- 打开各弹窗 ---------- */
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

    /* ---------- 深色模式选项 ---------- */
    'select-dark-mode': (el) => {
        const mode = el.dataset.mode;
        if (mode) applyTheme(mode);
    },

    /* ---------- 后台通知 ---------- */
    'test-notification': () => sendTestNotification(),

    /* ---------- 数据 ---------- */
    'import-data': () => importData(),
    'export-data': () => exportData(),
    'clear-data':  () => clearData(),

    /* ---------- 保存按钮 ---------- */
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

    /* ---------- 字卡库 ---------- */
    'word-card-search':  () => onWordCardSearch(),
    'word-card-folder':  () => onWordCardFolder(),
    'word-card-select':  () => onWordCardSelect(),
    'word-card-import':  () => onWordCardImport(),
    'word-card-export':  () => onWordCardExport(),
    'add-word-card':     () => addWordCardItem(),

    /* ---------- 存储 ---------- */
    'refresh-storage': () => refreshStorageView()
};

/**
 * 同步通知弹窗状态
 */
function syncNotificationModal() {
    const s = get(KEYS.SETTINGS).notification;
    setSwitch(byId('switch-notification'),         !!s.enabled);
    setSwitch(byId('switch-background-keepalive'), !!s.backgroundKeepalive);

    // 显示当前权限
    if ('Notification' in window) {
        const perm = NOTIFICATION_PERMISSION_MAP[Notification.permission] || '未知';
        const testBtn = byId('btn-test-notification');
        if (testBtn) {
            testBtn.textContent = `测试（权限：${perm}）`;
        }
    }
}


/* ==========================================================================
   14. 对外导出
   ========================================================================== */

export default {
    initSettings,
    destroySettings,
    applyTheme,
    syncReplyModal,
    syncLetterModal,
    syncMomentsModal,
    syncWordCardModal,
    refreshStorageView,
    settingsActions
};