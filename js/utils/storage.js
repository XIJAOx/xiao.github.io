/* ==========================================================================
   梦角 · Dream Corner
   存储模块  js/utils/storage.js
   --------------------------------------------------------------------------
   职责：
   1. 统一命名空间，避免和其他页面冲突
   2. 提供 get / set / remove / has / clearAll
   3. 定义全部业务 KEY（和 HTML「存储」弹窗一一对应）
   4. 提供默认值与"带默认值的读取"
   5. 提供存储体积统计（供「存储」弹窗显示）
   6. 自动兼容 JSON 序列化 / 反序列化
   7. 内存降级（localStorage 不可用时用 Map）
   ========================================================================== */


/* ==========================================================================
   01. 存储引擎（localStorage + 内存降级）
   ========================================================================== */

const PREFIX = 'mengjiao_';

/**
 * 检测 localStorage 是否可用（隐私模式 / 沙箱环境可能不可用）
 */
function isLocalStorageAvailable() {
    try {
        const k = '__mj_test__';
        window.localStorage.setItem(k, '1');
        window.localStorage.removeItem(k);
        return true;
    } catch (e) {
        return false;
    }
}

const _useLS = isLocalStorageAvailable();
const _memory = new Map(); // 降级时使用

/**
 * 底层读字符串
 */
function rawGet(fullKey) {
    if (_useLS) return window.localStorage.getItem(fullKey);
    return _memory.has(fullKey) ? _memory.get(fullKey) : null;
}

/**
 * 底层写字符串
 */
function rawSet(fullKey, value) {
    if (_useLS) {
        window.localStorage.setItem(fullKey, value);
    } else {
        _memory.set(fullKey, value);
    }
}

/**
 * 底层删除
 */
function rawRemove(fullKey) {
    if (_useLS) {
        window.localStorage.removeItem(fullKey);
    } else {
        _memory.delete(fullKey);
    }
}

/**
 * 列出所有属于本应用的 key（不含前缀）
 */
function rawKeys() {
    const prefixLen = PREFIX.length;
    if (_useLS) {
        const out = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(PREFIX)) out.push(k.slice(prefixLen));
        }
        return out;
    }
    return Array.from(_memory.keys()).map((k) =>
        k.startsWith(PREFIX) ? k.slice(prefixLen) : k
    );
}


/* ==========================================================================
   02. 业务 KEY 常量
   --------------------------------------------------------------------------
   严格对应 HTML「存储」弹窗里的列表：
     聊天记录 / 字卡 / 收藏 / 朋友圈 / 表情包 /
     信件 / 纪念日 / 占卜记录 / 音乐 / 提问 / 经期记录
   额外再加上：每日情话、备忘、心情、打卡、通话记录、设置、主题
   ========================================================================== */

export const KEYS = {
    /* ---- 存储弹窗列出的 11 项 ---- */
    CHAT:            'chat',           // 聊天记录（含全部消息）
    WORD_CARD:       'word_card',      // 字卡库（主字卡/颜文字/emoji/表情库/语音）
    FAVORITES:       'favorites',      // 收藏（我的 / TA 的）
    MOMENTS:         'moments',        // 朋友圈动态 + 评论 + 点赞
    STICKERS:        'stickers',       // 表情包（图片资源）
    LETTERS:         'letters',        // 信件（寄出 / 收到 / 时空）
    ANNIVERSARY:     'anniversary',    // 纪念日
    DIVINE:          'divine',         // 占卜记录
    MUSIC:           'music',          // 音乐库 / 歌单 / 当前播放
    QUESTIONS:       'questions',      // 提问（我 / TA）
    PERIOD:          'period',         // 经期记录（含症状、预测）

    /* ---- 首页相关 ---- */
    DAILY_LOVE:      'daily_love',     // 今日情话
    DAILY_MEMO:      'daily_memo',     // 今日备忘
    MOOD:            'mood',           // 今日心情
    CHECKIN:         'checkin',        // 打卡记录

    /* ---- 聊天外观（聊天信息弹窗里的设置） ---- */
    CHAT_APPEARANCE: 'chat_appearance',// 气泡/文字/头像/背景/时间戳已读
    CHAT_INFO:       'chat_info',      // 免打扰 / 置顶 / 群聊等

    /* ---- 设置项 ---- */
    SETTINGS:        'settings',       // 回复/信件/朋友圈/通知等全部设置
    THEME:           'theme',          // 深色模式：system / dark / light

    /* ---- 其他 ---- */
    CALL:            'call',           // 通话记录
    CHARACTERS:      'characters',    // 梦角列表
    PROFILE:         'profile',        // TA 与我的资料（名字/头像等）
    WATER:           'water',          // 喝水记录（留一个别名方便）
    META:            'meta'            // 应用元信息（版本、首次打开时间）
};


/* ==========================================================================
   03. 默认值
   --------------------------------------------------------------------------
   首次读取时若 key 不存在，会返回这里的默认值。
   默认值以「函数」形式给出，避免引用共享对象被意外修改。
   ========================================================================== */

export const DEFAULTS = {
    /* ---- 聊天 ---- */
    [KEYS.CHAT]: () => ({
        ta: {
            messages: [],       // { id, role:'me'|'ta', type:'text'|'image'|'voice', content, ts, read }
            lastReadTs: 0,
            draft: ''
        }
    }),

    /* ---- 字卡库 ---- */
    [KEYS.WORD_CARD]: () => ({
        main: [],       // { id, text, folder }
        kaomoji: [],    // { id, text }
        emoji: [],      // { id, text }
        sticker: [],    // { id, url, name }
        voice: [],      // { id, url, duration }
        folders: [],    // { id, name }
        activeTab: 'main'
    }),

    /* ---- 收藏 ---- */
    [KEYS.FAVORITES]: () => ({
        my: [],     // { id, text, source, ts }
        ta: []      // { id, text, source, ts }
    }),

    /* ---- 朋友圈 ---- */
    [KEYS.MOMENTS]: () => ({
        posts: [],      // { id, authorId, text, images:[], ts, likes:[], comments:[{id, name, text, ts}] }
        bg: '',         // 背景图 url 或 css gradient
        visitors: []    // { id, name, ts }
    }),

    /* ---- 表情包 ---- */
    [KEYS.STICKERS]: () => ({
        items: []       // { id, url, name, group }
    }),

    /* ---- 信件 ---- */
    [KEYS.LETTERS]: () => ({
        sent: [],       // { id, title, body, ts, read }
        received: [],   // { id, title, body, ts, read }
        time: []        // { id, title, body, fromTs, toTs, ts }
    }),

    /* ---- 纪念日 ---- */
    [KEYS.ANNIVERSARY]: () => ({
        items: []       // { id, name, date, isYearly }
    }),

    /* ---- 占卜 ---- */
    [KEYS.DIVINE]: () => ({
        records: []     // { id, type:'tarot'|'lenormand', question, count, cards:[], ts }
    }),

    /* ---- 音乐 ---- */
    [KEYS.MUSIC]: () => ({
        library: [],    // { id, title, artist, url, duration, playlist }
        favorites: [],  // 我的收藏（id 数组）
        taFavorites: [],// TA 的收藏
        playlists: [    // 歌单
            { id: 'default', name: '默认歌单', songIds: [] }
        ],
        current: {      // 当前播放
            songId: null,
            playing: false,
            currentTime: 0
        }
    }),

    /* ---- 提问 ---- */
    [KEYS.QUESTIONS]: () => ({
        my: [],         // { id, items:[{text, type}], answers:[], ts }
        ta: []          // TA 的提问
    }),

    /* ---- 经期记录 ---- */
    [KEYS.PERIOD]: () => ({
        records: [],    // { id, start, end, symptoms:[], note }
        settings: {
            cycleLength: 28,        // 平均周期天数
            periodLength: 5,        // 平均经期天数
            reminder: false
        },
        symptoms: {}    // { 'YYYY-MM-DD': ['头痛', '乏力'] }
    }),

    /* ---- 首页 ---- */
    [KEYS.DAILY_LOVE]: () => ({
        text: '你是我藏在心里的欢喜',
        date: ''        // 'YYYY-MM-DD'，用于判断是否换新
    }),

    [KEYS.DAILY_MEMO]: () => ({
        text: '',
        date: ''
    }),

    [KEYS.MOOD]: () => ({
        value: '',      // 如 '😊'
        label: '',
        date: ''
    }),

    [KEYS.CHECKIN]: () => ({
        days: 0,            // 连续打卡天数
        lastDate: '',       // 'YYYY-MM-DD'
        history: []         // 打卡日期列表
    }),

    /* ---- 聊天外观 ---- */
    [KEYS.CHAT_APPEARANCE]: () => ({
        bubble: {
            size: 14,               // 字号
            radius: 15,             // 圆角
            colorMe: '#000',        // 我发出的气泡背景色
            cssUrl: '',
            customCss: ''
        },
        text: {
            size: 14,
            cssUrl: '',
            customCss: ''
        },
        avatar: {
            shape: 'circle',        // circle / square
            size: 38
        },
        background: {
            type: 'color',          // color / image
            color: '#fff',
            image: ''
        },
        timestamp: {
            show: true,
            showRead: false
        }
    }),

    /* ---- 聊天信息（右侧 ⋯ 弹窗） ---- */
    [KEYS.CHAT_INFO]: () => ({
        ta: {
            mute: false,
            top: false,
            bubbleSize: '14px',
            textSize: '14px',
            avatarShape: 'circle',
            avatarSize: 38
        }
    }),

    /* ---- 设置（回复/信件/朋友圈/通知） ---- */
    [KEYS.SETTINGS]: () => ({
        reply: {
            minSpeed: 1,
            maxSpeed: 10,
            minCount: 1,
            maxCount: 3,
            spellCard: false,
            readNoReply: false,
            taProactive: false
        },
        letter: {
            minTime: 5,
            maxTime: 30,
            minCards: 1,
            maxCards: 5
        },
        moments: {
            minTime: 30,
            maxTime: 120,
            minCards: 1,
            maxCards: 3,
            allDream: true,
            crossComment: true
        },
        notification: {
            enabled: false,
            backgroundKeepalive: false
        }
    }),

    [KEYS.THEME]: () => 'system',   // system / dark / light

    [KEYS.CALL]: () => ({
        records: []     // { id, type:'in'|'out', name, duration, ts }
    }),

    [KEYS.CHARACTERS]: () => ({
        list: [
            { id: 'ta', name: 'TA', avatar: '', createdAt: Date.now(), isDefault: true }
        ],
        currentId: 'ta'
    }),

    [KEYS.PROFILE]: () => ({
        ta: { name: 'TA', avatar: '' },
        me: { name: '我', avatar: '' }
    }),

    /* ---- 喝水 ---- */
    [KEYS.WATER]: () => ({
        goal: 8,                // 目标杯数
        volumePerCup: 250,      // 每杯毫升
        records: {}             // { 'YYYY-MM-DD': { cups, ml } }
    }),

    /* ---- 元信息 ---- */
    [KEYS.META]: () => ({
        version: '1.0.0',
        firstOpenAt: Date.now(),
        lastOpenAt: Date.now()
    })
};


/* ==========================================================================
   04. 核心 API
   ========================================================================== */

/**
 * 取完整 key（带前缀）
 */
function fullKey(key) {
    return PREFIX + key;
}

/**
 * 读取一个值
 * @param {string} key
 * @param {*} [fallback=null]  缺失时的返回值；不传则用 DEFAULTS 里的默认值
 * @returns {*}
 */
export function get(key, fallback = undefined) {
    const raw = rawGet(fullKey(key));

    // 缺失
    if (raw === null || raw === undefined) {
        if (fallback !== undefined) return fallback;
        const factory = DEFAULTS[key];
        return factory ? factory() : null;
    }

    // 解析
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`[storage] JSON 解析失败：${key}`, e);
        // 尝试当成裸字符串返回
        return raw;
    }
}

/**
 * 写入一个值
 * @param {string} key
 * @param {*} value
 * @returns {boolean}
 */
export function set(key, value) {
    try {
        rawSet(fullKey(key), JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn(`[storage] 写入失败：${key}`, e);
        return false;
    }
}

/**
 * 删除一个 key
 * @param {string} key
 */
export function remove(key) {
    rawRemove(fullKey(key));
}

/**
 * 是否已存在（不含默认值）
 * @param {string} key
 * @returns {boolean}
 */
export function has(key) {
    return rawGet(fullKey(key)) !== null;
}

/**
 * 若不存在则用默认值初始化
 * @param {string} key
 * @returns {*}  当前值
 */
export function ensure(key) {
    if (!has(key)) {
        const factory = DEFAULTS[key];
        set(key, factory ? factory() : null);
    }
    return get(key);
}

/**
 * 更新（浅合并对象）
 * 用于只改某几个字段的场景
 * @param {string} key
 * @param {Object} patch
 * @returns {Object}
 */
export function update(key, patch) {
    const current = get(key);
    if (current && typeof current === 'object' && !Array.isArray(current)) {
        const next = { ...current, ...patch };
        set(key, next);
        return next;
    }
    // 非对象则直接覆盖
    set(key, patch);
    return patch;
}

/**
 * 追加到数组（会自动创建空数组）
 * @param {string} key
 * @param {*} item
 * @returns {Array}
 */
export function push(key, item) {
    const arr = get(key);
    const list = Array.isArray(arr) ? arr : [];
    list.push(item);
    set(key, list);
    return list;
}

/**
 * 从数组里按 id 删除
 * @param {string} key
 * @param {string} idField   如 'id'
 * @param {*} value
 * @returns {Array}
 */
export function removeBy(key, idField, value) {
    const arr = get(key);
    if (!Array.isArray(arr)) return [];
    const next = arr.filter((it) => it && it[idField] !== value);
    set(key, next);
    return next;
}


/* ==========================================================================
   05. 批量 / 全局操作
   ========================================================================== */

/**
 * 清除一个业务数据（恢复默认）
 * @param {string} key
 */
export function reset(key) {
    remove(key);
    ensure(key);
}

/**
 * 清除本应用的全部数据
 * @returns {boolean}
 */
export function clearAll() {
    if (_useLS) {
        const toRemove = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(PREFIX)) toRemove.push(k);
        }
        toRemove.forEach((k) => window.localStorage.removeItem(k));
    } else {
        Array.from(_memory.keys())
            .filter((k) => k.startsWith(PREFIX))
            .forEach((k) => _memory.delete(k));
    }
    return true;
}

/**
 * 导出全部数据为 JSON 字符串
 * @returns {string}
 */
export function exportAll() {
    const data = {};
    rawKeys().forEach((k) => {
        data[k] = get(k);
    });
    return JSON.stringify(
        {
            app: 'mengjiao',
            version: '1.0.0',
            exportedAt: Date.now(),
            data
        },
        null,
        2
    );
}

/**
 * 导入数据（会覆盖同名 key，不会清空未包含的 key）
 * @param {string|Object} payload  JSON 字符串或对象
 * @param {Object} [options]
 * @param {boolean} [options.replace=false]  是否先清空
 * @returns {{ok:boolean, count:number, error?:string}}
 */
export function importAll(payload, options = {}) {
    const { replace = false } = options;
    let obj;

    try {
        obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch (e) {
        return { ok: false, count: 0, error: 'JSON 格式错误' };
    }

    // 支持两种结构：{data:{...}} 或 直接 {key:value}
    const data = obj && obj.data && typeof obj.data === 'object' ? obj.data : obj;
    if (!data || typeof data !== 'object') {
        return { ok: false, count: 0, error: '数据结构不正确' };
    }

    if (replace) clearAll();

    let count = 0;
    Object.keys(data).forEach((k) => {
        // 过滤掉明显不属于我们的 key
        if (k === 'app' || k === 'version' || k === 'exportedAt') return;
        set(k, data[k]);
        count++;
    });

    return { ok: true, count };
}


/* ==========================================================================
   06. 存储体积统计（供「存储」弹窗用）
   --------------------------------------------------------------------------
   HTML 里的元素：
     #storage-chat / #storage-word-card / #storage-favorites /
     #storage-moments / #storage-stickers / #storage-letters /
     #storage-anniversary / #storage-divine / #storage-music /
     #storage-questions / #storage-period
   ========================================================================== */

/**
 * 获取每个业务 key 的原始字节数
 * @returns {Object<string, number>}  { [key]: bytes }
 */
export function getSizeMap() {
    const map = {};
    rawKeys().forEach((k) => {
        const raw = rawGet(fullKey(k));
        map[k] = raw ? byteLength(raw) : 0;
    });
    return map;
}

/**
 * 获取总字节数
 * @returns {number}
 */
export function getTotalSize() {
    return Object.values(getSizeMap()).reduce((a, b) => a + b, 0);
}

/**
 * UTF-8 字符串字节长度
 * @param {string} str
 * @returns {number}
 */
function byteLength(str) {
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else bytes += 3;
    }
    return bytes;
}

/**
 * 格式化字节数
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 把某个 key 的体积写到页面元素上
 * 供 settings.js 遍历使用
 * @param {Object} [targetMap]  自定义映射 { key: elementId }
 */
export function renderStorageSizes(targetMap) {
    const DEFAULT_MAP = {
        [KEYS.CHAT]:        'storage-chat',
        [KEYS.WORD_CARD]:   'storage-word-card',
        [KEYS.FAVORITES]:   'storage-favorites',
        [KEYS.MOMENTS]:     'storage-moments',
        [KEYS.STICKERS]:    'storage-stickers',
        [KEYS.LETTERS]:     'storage-letters',
        [KEYS.ANNIVERSARY]: 'storage-anniversary',
        [KEYS.DIVINE]:      'storage-divine',
        [KEYS.MUSIC]:       'storage-music',
        [KEYS.QUESTIONS]:   'storage-questions',
        [KEYS.PERIOD]:      'storage-period'
    };

    const map = targetMap || DEFAULT_MAP;
    const sizes = getSizeMap();

    Object.keys(map).forEach((key) => {
        const el = document.getElementById(map[key]);
        if (!el) return;
        const bytes = sizes[key] || 0;
        el.textContent = formatBytes(bytes);
    });
}


/* ==========================================================================
   07. 初始化（首次打开写入 meta）
   ========================================================================== */

/**
 * 应用启动时调用一次：
 *  1) 记录 lastOpenAt
 *  2) 补齐所有默认 key（可选）
 * @param {Object} [options]
 * @param {boolean} [options.fillDefaults=false]  是否把缺失的 key 全部初始化为默认值
 */
export function initStorage(options = {}) {
    const { fillDefaults = false } = options;

    // 更新 meta
    const meta = get(KEYS.META);
    meta.lastOpenAt = Date.now();
    if (!meta.firstOpenAt) meta.firstOpenAt = Date.now();
    set(KEYS.META, meta);

    // 可选：把每个业务 key 都补齐默认值
    if (fillDefaults) {
        Object.keys(DEFAULTS).forEach((k) => ensure(k));
    }
}


/* ==========================================================================
   08. 统一导出（方便其他模块 import）
   ========================================================================== */

export default {
    KEYS,
    DEFAULTS,
    get,
    set,
    remove,
    has,
    ensure,
    update,
    push,
    removeBy,
    reset,
    clearAll,
    exportAll,
    importAll,
    getSizeMap,
    getTotalSize,
    formatBytes,
    renderStorageSizes,
    initStorage
};
