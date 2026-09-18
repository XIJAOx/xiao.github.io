/* ==========================================================================
   梦角 · Dream Corner
   聊天模块  js/modules/chat.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-chat-list    聊天列表
     #screen-chat         聊天页
     #screen-chat-info    聊天信息页
     弹窗：
       #modal-bg         聊天背景
       #modal-bubble     气泡
       #modal-text       文字
       #modal-avatar     头像
       #modal-timestamp  时间戳 / 已读
       #modal-data       聊天数据（导出/导入/删除）
       #modal-group-chat 发起群聊
   --------------------------------------------------------------------------
   依赖：
     utils/dom     DOM 操作与格式化
     utils/storage 持久化
     utils/event   事件总线
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    openModal, closeModal,
    toast,
    setVisible, setText,
    setSwitch, getSwitch, setCheck, getCheck, setActiveInGroup,
    formatChatTime, formatDuration, formatDate,
    scrollToBottom,
    uid, randomInt, randomPick, debounce,
    escapeHtml,
    downloadFile, readFileAsText
} from '../utils/dom.js';

import {
    KEYS, get, set, update, push, removeBy
} from '../utils/storage.js';

import { bus, on, delegate } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 当前聊天对象 id（以后支持多角色再扩展） */
const CHAT_ID = 'ta';

/** 聊天页容器里用来标记"已渲染"的属性 */
const RENDERED_FLAG = 'data-rendered';

/** TA 主动发消息的冷却（毫秒），避免刷屏 */
const PROACTIVE_COOLDOWN = 60 * 1000;

/** 默认气泡色（用于取反色文本） */
const DEFAULT_BUBBLE_COLOR = '#000';


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];
let _replyTimers = [];       // 自动回复的 setTimeout id 集合
let _lastProactiveAt = 0;    // 上次 TA 主动发消息时间
let _inChatScreen = false;   // 是否在聊天页


/* ==========================================================================
   03. 入口：initChat
   ========================================================================== */

export function initChat() {
    if (_initialized) return;
    _initialized = true;

    // 确保聊天数据结构完整
    ensureChatData();

    // 渲染
    applyAppearance();
    renderChatHeader();
    renderChatListPreview();
    renderChatMessages();
    bindInput();
    bindChatListClick();
    bindSettingsModals();

    // 订阅
    _unsubs.push(
        bus.on('profile:update', () => {
            renderChatHeader();
            renderChatListPreview();
        }),
        bus.on('settings:changed', applyAppearance),
        bus.on('screen:change', ({ id }) => {
            _inChatScreen = id === 'screen-chat';
            if (_inChatScreen) {
                // 进入聊天页时把未读清掉
                markAllRead();
                scrollChatToBottom(false);
            }
        })
    );
}

export function destroyChat() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _replyTimers.forEach((t) => clearTimeout(t));
    _replyTimers = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

/**
 * 结构：
 *   {
 *     ta: {
 *       messages: [
 *         { id, role:'me'|'ta', type:'text'|'image'|'voice',
 *           content, ts, read }
 *       ],
 *       lastReadTs: number,
 *       draft: ''
 *     }
 *   }
 */
function ensureChatData() {
    const chat = get(KEYS.CHAT);
    if (!chat[CHAT_ID]) {
        chat[CHAT_ID] = { messages: [], lastReadTs: 0, draft: '' };
        set(KEYS.CHAT, chat);
    }
    return chat[CHAT_ID];
}

function getMessages() {
    return ensureChatData().messages || [];
}

function setMessages(list) {
    const chat = get(KEYS.CHAT);
    chat[CHAT_ID].messages = list;
    set(KEYS.CHAT, chat);
}

function getLastMessage() {
    const list = getMessages();
    return list.length ? list[list.length - 1] : null;
}

function getUnreadCount() {
    const list = getMessages();
    const { lastReadTs } = ensureChatData();
    return list.filter((m) => m.role === 'ta' && m.ts > lastReadTs).length;
}

function markAllRead() {
    const chat = get(KEYS.CHAT);
    chat[CHAT_ID].lastReadTs = Date.now();
    set(KEYS.CHAT, chat);
    renderChatListPreview();
}


/* ==========================================================================
   05. 渲染：聊天列表预览
   --------------------------------------------------------------------------
   HTML：
     #chat-list-last-msg
     #chat-list-time-ta
     #chat-list-unread-ta
   ========================================================================== */

export function renderChatListPreview() {
    const last = getLastMessage();
    const msgEl = byId('chat-list-last-msg');
    const timeEl = byId('chat-list-time-ta');
    const unreadEl = byId('chat-list-unread-ta');

    if (msgEl) {
        if (!last) {
            msgEl.textContent = '还没有对话哦';
        } else if (last.type === 'image') {
            msgEl.textContent = '[图片]';
        } else if (last.type === 'voice') {
            msgEl.textContent = '[语音]';
        } else {
            msgEl.textContent = last.content || '';
        }
    }

    if (timeEl) {
        timeEl.textContent = last ? formatChatTime(last.ts) : '';
    }

    if (unreadEl) {
        const count = getUnreadCount();
        unreadEl.textContent = count > 0 ? String(count) : '';
    }
}


/* ==========================================================================
   06. 渲染：聊天头部
   ========================================================================== */

function renderChatHeader() {
    const profile = get(KEYS.PROFILE);
    const nameEl = byId('chat-header-name');
    if (nameEl) nameEl.textContent = profile.ta.name || 'TA';

    // 头像图片
    const circle = byId('chat-header-avatar');
    if (circle && profile.ta.avatar) {
        let img = circle.querySelector('img.mj-avatar-img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'mj-avatar-img';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            circle.appendChild(img);
        }
        img.src = profile.ta.avatar;
        const svg = circle.querySelector('svg');
        if (svg) svg.style.display = 'none';
    }
}


/* ==========================================================================
   07. 渲染：消息列表
   --------------------------------------------------------------------------
   消息 DOM 结构（对齐 CSS 里的 .chat-row / .chat-bubble）：
     <div class="chat-row ta|me">
       <div class="chat-row-avatar">[svg 或 img]</div>
       <div class="chat-bubble ta|me">
         [文本 / <img> / 语音块]
       </div>
     </div>
   时间戳：
     <div class="chat-timestamp">昨天 20:31</div>
   已读：
     <div class="chat-read">已读</div>
   ========================================================================== */

function renderChatMessages() {
    const container = byId('chat-message-list');
    if (!container) return;

    const list = getMessages();
    const empty = byId('chat-empty-state');

    if (!list.length) {
        // 显示空状态
        if (empty) empty.hidden = false;
        // 移除已渲染的消息节点，但保留空状态节点
        Array.from(container.children).forEach((child) => {
            if (child !== empty) child.remove();
        });
        container.setAttribute(RENDERED_FLAG, '1');
        return;
    }

    // 有消息：隐藏空状态
    if (empty) empty.hidden = true;

    // 清空并重建（简单可靠；消息量不大时性能足够）
    // 保留空状态节点备用
    Array.from(container.children).forEach((child) => {
        if (child !== empty) child.remove();
    });

    const fragment = document.createDocumentFragment();
    list.forEach((msg, idx) => {
        // 时间分隔：首条 or 与上一条间隔 > 5 分钟
        const prev = list[idx - 1];
        if (!prev || msg.ts - prev.ts > 5 * 60 * 1000) {
            fragment.appendChild(createTimestampEl(msg.ts));
        }

        fragment.appendChild(createMessageEl(msg));
    });

    // 已读标记（放在最后一条我方消息之后）
    const appearance = get(KEYS.CHAT_APPEARANCE);
    if (appearance.timestamp?.showRead) {
        const lastMe = [...list].reverse().find((m) => m.role === 'me');
        if (lastMe && lastMe.read) {
            const readEl = document.createElement('div');
            readEl.className = 'chat-read';
            readEl.textContent = '已读';
            fragment.appendChild(readEl);
        }
    }

    container.appendChild(fragment);
    container.setAttribute(RENDERED_FLAG, '1');
}

/**
 * 创建单条消息 DOM
 * @param {Object} msg
 * @returns {HTMLElement}
 */
function createMessageEl(msg) {
    const profile = get(KEYS.PROFILE);
    const row = document.createElement('div');
    row.className = `chat-row ${msg.role === 'me' ? 'me' : 'ta'}`;
    row.dataset.msgId = msg.id;

    // 头像
    const avatar = document.createElement('div');
    avatar.className = 'chat-row-avatar';
    const avatarSrc = msg.role === 'me' ? profile.me.avatar : profile.ta.avatar;
    avatar.appendChild(createAvatarContent(avatarSrc));
    row.appendChild(avatar);

    // 气泡
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.role === 'me' ? 'me' : 'ta'}`;

    if (msg.type === 'image') {
        bubble.classList.add('chat-bubble-image');
        const img = document.createElement('img');
        img.src = msg.content;
        img.alt = '';
        bubble.appendChild(img);
    } else if (msg.type === 'voice') {
        bubble.classList.add('chat-bubble-voice');
        const icon = document.createElement('span');
        icon.className = 'chat-bubble-voice-icon';
        icon.textContent = '🎤';
        const dur = document.createElement('span');
        dur.textContent = `${msg.duration || 0}"`;
        bubble.appendChild(icon);
        bubble.appendChild(dur);
    } else {
        // 纯文本：使用 textContent 保证安全
        bubble.textContent = msg.content || '';
    }

    // 长按 → 上下文菜单
    attachMessageContextMenu(bubble, msg);

    row.appendChild(bubble);
    return row;
}

/**
 * 创建头像内容（有图片用图片，否则回退到 SVG）
 * @param {string} src
 * @returns {HTMLElement}
 */
function createAvatarContent(src) {
    if (src) {
        const img = document.createElement('img');
        img.className = 'mj-avatar-img';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.src = src;
        return img;
    }
    // 默认 svg
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
        'd',
        'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
    );
    svg.appendChild(path);
    return svg;
}

/**
 * 创建时间戳节点
 * @param {number} ts
 * @returns {HTMLElement}
 */
function createTimestampEl(ts) {
    const el = document.createElement('div');
    el.className = 'chat-timestamp';
    el.textContent = formatChatTime(ts);
    return el;
}

/**
 * 滚动到底部
 * @param {boolean} [smooth=false]
 */
function scrollChatToBottom(smooth = false) {
    const container = byId('chat-message-list');
    if (!container) return;
    // 延迟一帧，等 DOM 渲染完成
    requestAnimationFrame(() => scrollToBottom(container, smooth));
}


/* ==========================================================================
   08. 追加消息（供内部和外部调用）
   ========================================================================== */

/**
 * 追加一条消息并渲染
 * @param {Object} msg  { role, type, content, ... }
 * @returns {Object} 完整的消息对象
 */
export function appendMessage(msg) {
    const list = getMessages();
    const full = {
        id: msg.id || uid('msg'),
        role: msg.role || 'me',
        type: msg.type || 'text',
        content: msg.content || '',
        ts: msg.ts || Date.now(),
        read: msg.read || false,
        ...msg
    };
    list.push(full);
    setMessages(list);

    // 如果当前在聊天页，直接把 DOM 追加进去
    const container = byId('chat-message-list');
    if (container && container.getAttribute(RENDERED_FLAG)) {
        const empty = byId('chat-empty-state');
        if (empty) empty.hidden = true;

        // 首条或间隔久，插时间戳
        const prev = list[list.length - 2];
        if (!prev || full.ts - prev.ts > 5 * 60 * 1000) {
            container.appendChild(createTimestampEl(full.ts));
        }
        container.appendChild(createMessageEl(full));
        scrollChatToBottom(true);
    }

    // 更新列表预览
    renderChatListPreview();

    // 广播
    bus.emit('chat:new-message', full);

    return full;
}

/**
 * 由外部（如喝水页）向我方追加一条消息
 * @param {string} text
 */
export function sendSystemMessage(text) {
    appendMessage({ role: 'me', type: 'text', content: text });
}


/* ==========================================================================
   09. 输入区
   --------------------------------------------------------------------------
   HTML：
     #chat-input
     #btn-chat-emoji   data-action="toggle-emoji-picker"
     #btn-chat-plus    data-action="toggle-more-panel"
   ========================================================================== */

function bindInput() {
    const input = byId('chat-input');
    if (!input) return;

    // 恢复草稿
    const chat = ensureChatData();
    if (chat.draft) input.value = chat.draft;

    // 输入时保存草稿（节流）
    const saveDraft = debounce((val) => {
        const c = get(KEYS.CHAT);
        c[CHAT_ID].draft = val;
        set(KEYS.CHAT, c);
    }, 400);

    input.addEventListener('input', () => saveDraft(input.value));

    // 回车发送
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendCurrentInput();
        }
    });

    // 失焦也保存一次
    input.addEventListener('blur', () => {
        const c = get(KEYS.CHAT);
        c[CHAT_ID].draft = input.value;
        set(KEYS.CHAT, c);
    });
}

/**
 * 发送输入框当前内容
 */
export function sendCurrentInput() {
    const input = byId('chat-input');
    if (!input) return;

    const text = (input.value || '').trim();
    if (!text) return;

    appendMessage({ role: 'me', type: 'text', content: text });

    // 清空输入与草稿
    input.value = '';
    const chat = get(KEYS.CHAT);
    chat[CHAT_ID].draft = '';
    set(KEYS.CHAT, chat);

    // 触发自动回复
    scheduleAutoReply();
}


/* ==========================================================================
   10. 自动回复
   --------------------------------------------------------------------------
   从 settings.reply 读取：
     minSpeed / maxSpeed     回复延迟区间（秒）
     minCount / maxCount     每次回复条数区间
     spellCard               是否拼字卡
     readNoReply             已读不回
     taProactive             TA 主动发信息（这个由 scheduleProactive 触发）
   ========================================================================== */

function scheduleAutoReply() {
    const settings = get(KEYS.SETTINGS);
    const replyCfg = settings.reply || {};

    // 已读不回：直接标记为已读，不回复
    if (replyCfg.readNoReply) {
        markAllRead();
        return;
    }

    // 随机延迟
    const minSpeed = Math.max(0, Number(replyCfg.minSpeed) || 1);
    const maxSpeed = Math.max(minSpeed, Number(replyCfg.maxSpeed) || 10);
    const delaySec = randomInt(minSpeed, maxSpeed);

    // 随机条数
    const minCount = Math.max(1, Number(replyCfg.minCount) || 1);
    const maxCount = Math.max(minCount, Number(replyCfg.maxCount) || 3);
    const totalCount = randomInt(minCount, maxCount);

    // 每条消息之间也有小间隔
    for (let i = 0; i < totalCount; i++) {
        const delay = (delaySec * 1000) + i * randomInt(500, 1500);
        const timer = setTimeout(() => {
            const text = generateReplyText();
            appendMessage({ role: 'ta', type: 'text', content: text });
            // 逐条标记已读
            if (i === totalCount - 1) {
                // 最后一条也算已读（用户在看到）
                const chat = get(KEYS.CHAT);
                chat[CHAT_ID].lastReadTs = Date.now();
                set(KEYS.CHAT, chat);
            }
        }, delay);
        _replyTimers.push(timer);
    }
}

/**
 * 生成一条回复文本
 * 优先用字卡库（如果开了拼字卡），否则用内置语料
 * @returns {string}
 */
function generateReplyText() {
    const settings = get(KEYS.SETTINGS);
    const replyCfg = settings.reply || {};

    // 开启拼字卡 → 从字卡库取
    if (replyCfg.spellCard) {
        const wordCards = get(KEYS.WORD_CARD);
        const pool = [
            ...(wordCards.main || []),
            ...(wordCards.kaomoji || []),
            ...(wordCards.emoji || [])
        ];
        if (pool.length) {
            const pick = randomPick(pool);
            return pick.text || pick.value || '';
        }
    }

    // 内置语料
    return randomPick(TA_REPLIES) || '嗯嗯';
}

/** TA 的默认语料池 */
const TA_REPLIES = [
    '嗯嗯，我在呢',
    '今天想我了没？',
    '嘻嘻，刚看到消息',
    '好呀，听你的',
    '那你呢？在干嘛呀',
    '我也想你了~',
    '嘿嘿，抱抱',
    '嗯…让我想想',
    '今天累不累？',
    '记得好好吃饭哦',
    '我一直都在呀',
    '好想快点见到你',
    '你开心我就开心',
    '要好好照顾自己呀',
    '晚点再聊好不好',
    '嗯…你说得对',
    '哇，真的吗？',
    '我也是这么想的',
    '嘿嘿，被你发现了',
    '那必须的呀'
];

/**
 * TA 主动发消息（由定时器或设置开启后触发）
 * 节流：PROACTIVE_COOLDOWN 内只触发一次
 */
export function triggerProactiveMessage() {
    const settings = get(KEYS.SETTINGS);
    if (!settings.reply?.taProactive) return;

    const now = Date.now();
    if (now - _lastProactiveAt < PROACTIVE_COOLDOWN) return;
    _lastProactiveAt = now;

    appendMessage({
        role: 'ta',
        type: 'text',
        content: generateReplyText()
    });

    // 如果不在聊天页，显示未读（由 renderChatListPreview 自动处理）
    if (!_inChatScreen) {
        bus.emit('chat:unread');
    }
}

/**
 * 启动一个定时器，检查是否需要 TA 主动发消息
 * 建议由 app.js 在启动时调用一次
 */
export function startProactiveLoop() {
    setInterval(() => {
        const settings = get(KEYS.SETTINGS);
        if (!settings.reply?.taProactive) return;
        // 随机概率触发（每分钟约 8%）
        if (Math.random() < 0.08) {
            triggerProactiveMessage();
        }
    }, 60 * 1000);
}


/* ==========================================================================
   11. 消息上下文菜单（长按复制 / 收藏 / 删除）
   ========================================================================== */

function attachMessageContextMenu(el, msg) {
    let pressTimer = null;

    const start = () => {
        pressTimer = setTimeout(() => {
            showMessageMenu(msg);
        }, 550);
    };
    const cancel = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('touchcancel', cancel);

    // 桌面端右键
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMessageMenu(msg);
    });
}

/**
 * 弹出消息操作菜单
 * 用 confirm 组合模拟简单菜单，避免新增 HTML
 * @param {Object} msg
 */
function showMessageMenu(msg) {
    if (msg.type !== 'text') {
        if (window.confirm('删除这条消息？')) {
            deleteMessage(msg.id);
        }
        return;
    }

    const text = msg.content || '';
    const choice = window.prompt(
        '输入序号操作：\n1. 复制\n2. 收藏\n3. 删除',
        '1'
    );
    if (choice === null) return;

    const n = parseInt(choice, 10);
    if (n === 1) {
        copyText(text);
    } else if (n === 2) {
        addToFavorites(text);
    } else if (n === 3) {
        deleteMessage(msg.id);
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

function addToFavorites(text) {
    const fav = get(KEYS.FAVORITES);
    fav.my = Array.isArray(fav.my) ? fav.my : [];
    fav.my.push({ id: uid('fav'), text, source: 'chat', ts: Date.now() });
    set(KEYS.FAVORITES, fav);
    toast('已收藏');
    bus.emit('favorites:update');
}

function deleteMessage(id) {
    const list = getMessages().filter((m) => m.id !== id);
    setMessages(list);
    renderChatMessages();
    renderChatListPreview();
    toast('已删除');
}


/* ==========================================================================
   12. 聊天列表点击
   ========================================================================== */

function bindChatListClick() {
    const item = byId('chat-list-item-ta');
    if (!item) return;
    // data-nav="chat" 已由 event.js 处理跳转
    // 这里只需在进入时清未读
    item.addEventListener('click', () => {
        markAllRead();
    });
}


/* ==========================================================================
   13. 外观设置应用（CSS 变量）
   --------------------------------------------------------------------------
   读取 KEYS.CHAT_APPEARANCE 并写入 CSS 变量：
     --bubble-size / --bubble-radius / --bubble-me-bg / --bubble-me-text
     --avatar-size / --avatar-radius
     --chat-bg
   ========================================================================== */

export function applyAppearance() {
    const ap = get(KEYS.CHAT_APPEARANCE) || {};
    const root = document.documentElement;
    const chatScreen = byId('screen-chat');

    // 气泡
    const bubble = ap.bubble || {};
    root.style.setProperty('--bubble-size', `${bubble.size || 14}px`);
    root.style.setProperty('--bubble-radius', `${bubble.radius ?? 15}px`);
    root.style.setProperty('--bubble-me-bg', bubble.colorMe || DEFAULT_BUBBLE_COLOR);
    root.style.setProperty(
        '--bubble-me-text',
        isDarkColor(bubble.colorMe || DEFAULT_BUBBLE_COLOR) ? '#fff' : '#1a1a1a'
    );

    // 文字（作用于聊天正文）
    const textCfg = ap.text || {};
    if (chatScreen) {
        chatScreen.style.fontSize = `${textCfg.size || 14}px`;
    }

    // 头像
    const av = ap.avatar || {};
    root.style.setProperty('--avatar-size', `${av.size || 38}px`);
    root.style.setProperty(
        '--avatar-radius',
        av.shape === 'square' ? '8px' : '999px'
    );

    // 背景
    const bg = ap.background || {};
    if (chatScreen) {
        if (bg.type === 'image' && bg.image) {
            chatScreen.style.setProperty('--chat-bg', `url(${bg.image})`);
            chatScreen.style.backgroundSize = 'cover';
            chatScreen.style.backgroundPosition = 'center';
        } else {
            chatScreen.style.setProperty('--chat-bg', bg.color || '#f7f7fa');
            chatScreen.style.backgroundSize = '';
            chatScreen.style.backgroundPosition = '';
        }
    }

    // 时间戳/已读
    const ts = ap.timestamp || {};
    const container = byId('chat-message-list');
    if (container) {
        container.classList.toggle('hide-timestamp', ts.show === false);
    }

    // 自定义 CSS（直接注入 <style>）
    applyCustomCss(ap);
}

/**
 * 判断颜色是否偏暗
 * @param {string} color
 * @returns {boolean}
 */
function isDarkColor(color) {
    if (!color) return true;
    const hex = color.replace('#', '');
    if (hex.length !== 3 && hex.length !== 6) return true;
    const full = hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // 相对亮度公式
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.6;
}

/** 缓存 <style> 元素 */
let _customStyleEl = null;

/**
 * 注入自定义 CSS
 * @param {Object} ap
 */
function applyCustomCss(ap) {
    if (!_customStyleEl) {
        _customStyleEl = document.createElement('style');
        _customStyleEl.id = 'mj-custom-css';
        document.head.appendChild(_customStyleEl);
    }
    const css = [
        ap.bubble?.customCss || '',
        ap.text?.customCss || ''
    ].join('\n');
    _customStyleEl.textContent = css;
}


/* ==========================================================================
   14. 设置弹窗：绑定
   --------------------------------------------------------------------------
   覆盖 HTML 里的：
     #modal-bg / #modal-bubble / #modal-text / #modal-avatar
     #modal-timestamp / #modal-data / #modal-group-chat
   ========================================================================== */

function bindSettingsModals() {
    bindBgModal();
    bindBubbleModal();
    bindTextModal();
    bindAvatarModal();
    bindTimestampModal();
    bindDataModal();
    bindGroupChatModal();
}


/* ---------- 14.1 聊天背景 ---------- */

function bindBgModal() {
    // 点击色块
    const grid = byId('bg-color-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const item = e.target.closest('.color-item');
            if (!item) return;
            setActiveInGroup(grid.querySelectorAll('.color-item'), item);
            const color = item.dataset.bgColor;
            update(KEYS.CHAT_APPEARANCE, {
                background: { type: 'color', color, image: '' }
            });
            applyAppearance();
        });
    }

    // 上传图片
    const btn = byId('btn-upload-bg-image');
    if (btn) {
        btn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    update(KEYS.CHAT_APPEARANCE, {
                        background: { type: 'image', image: reader.result, color: '' }
                    });
                    applyAppearance();
                    toast('已更换背景');
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
    }
}


/* ---------- 14.2 气泡设置 ---------- */

function bindBubbleModal() {
    const sizeEl = byId('bubble-size');
    if (sizeEl) {
        sizeEl.addEventListener('change', () => {
            const size = clamp(parseInt(sizeEl.value, 10) || 14, 1, 100);
            sizeEl.value = size;
            update(KEYS.CHAT_APPEARANCE, {
                bubble: { ...get(KEYS.CHAT_APPEARANCE).bubble, size }
            });
            syncInfoRowText('info-row-value-bubble', `${size}px`);
            applyAppearance();
        });
    }

    const radiusEl = byId('bubble-radius');
    if (radiusEl) {
        radiusEl.addEventListener('change', () => {
            const radius = clamp(parseInt(radiusEl.value, 10) || 15, 0, 100);
            radiusEl.value = radius;
            update(KEYS.CHAT_APPEARANCE, {
                bubble: { ...get(KEYS.CHAT_APPEARANCE).bubble, radius }
            });
            applyAppearance();
        });
    }

    // 颜色选择
    const grid = byId('bubble-color-grid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const item = e.target.closest('.color-item');
            if (!item) return;
            setActiveInGroup(grid.querySelectorAll('.color-item'), item);
            const color = item.dataset.color;
            update(KEYS.CHAT_APPEARANCE, {
                bubble: { ...get(KEYS.CHAT_APPEARANCE).bubble, colorMe: color }
            });
            applyAppearance();
        });
    }

    // 自定义 CSS
    const cssArea = byId('bubble-custom-css');
    if (cssArea) {
        cssArea.addEventListener('change', () => {
            update(KEYS.CHAT_APPEARANCE, {
                bubble: { ...get(KEYS.CHAT_APPEARANCE).bubble, customCss: cssArea.value }
            });
            applyAppearance();
        });
    }

    // 保存按钮
    const saveBtn = byId('btn-save-bubble');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            toast('气泡设置已保存');
            bus.emit('settings:changed');
        });
    }
}


/* ---------- 14.3 文字设置 ---------- */

function bindTextModal() {
    const sizeEl = byId('text-size');
    if (sizeEl) {
        sizeEl.addEventListener('change', () => {
            const size = clamp(parseInt(sizeEl.value, 10) || 14, 1, 100);
            sizeEl.value = size;
            update(KEYS.CHAT_APPEARANCE, {
                text: { ...get(KEYS.CHAT_APPEARANCE).text, size }
            });
            syncInfoRowText('info-row-value-text', `${size}px`);
            applyAppearance();
        });
    }

    const cssArea = byId('text-custom-css');
    if (cssArea) {
        cssArea.addEventListener('change', () => {
            update(KEYS.CHAT_APPEARANCE, {
                text: { ...get(KEYS.CHAT_APPEARANCE).text, customCss: cssArea.value }
            });
            applyAppearance();
        });
    }

    const saveBtn = byId('btn-save-text');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            toast('文字设置已保存');
            bus.emit('settings:changed');
        });
    }
}


/* ---------- 14.4 头像设置 ---------- */

function bindAvatarModal() {
    const shapeGroup = byId('avatar-shape-options');
    if (shapeGroup) {
        shapeGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.shape-option');
            if (!btn) return;
            setActiveInGroup(shapeGroup.querySelectorAll('.shape-option'), btn);
        });
    }

    const saveBtn = byId('btn-save-avatar');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const activeShape = shapeGroup?.querySelector('.shape-option.active');
            const shape = activeShape?.dataset.shape || 'circle';
            const sizeInput = byId('avatar-size');
            const size = clamp(parseInt(sizeInput?.value, 10) || 38, 1, 200);

            update(KEYS.CHAT_APPEARANCE, {
                avatar: { shape, size }
            });

            syncInfoRowText(
                'info-row-value-avatar',
                `${shape === 'circle' ? '圆形' : '方形'} · ${size}px`
            );
            applyAppearance();
            toast('头像设置已保存');
        });
    }
}


/* ---------- 14.5 时间戳 / 已读 ---------- */

function bindTimestampModal() {
    // HTML 里这两个是 .check-indicator，用 data-action="toggle-check"
    // 会被 event.js 的通用动作处理，这里只订阅变化并持久化
    bus.on('check:change', ({ id, value }) => {
        if (id === 'timestamp') {
            update(KEYS.CHAT_APPEARANCE, {
                timestamp: { ...get(KEYS.CHAT_APPEARANCE).timestamp, show: value }
            });
            applyAppearance();
            updateTimestampInfoRow();
        } else if (id === 'read-receipt') {
            update(KEYS.CHAT_APPEARANCE, {
                timestamp: { ...get(KEYS.CHAT_APPEARANCE).timestamp, showRead: value }
            });
            renderChatMessages();
            updateTimestampInfoRow();
        }
    });

    // 打开时同步界面状态
    const modal = byId('modal-timestamp');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('active')) {
                const ap = get(KEYS.CHAT_APPEARANCE);
                setCheck(byId('check-timestamp'), ap.timestamp?.show !== false);
                setCheck(byId('check-read-receipt'), !!ap.timestamp?.showRead);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
}

function updateTimestampInfoRow() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const text = `${ap.timestamp?.show !== false ? '时间戳' : '无时间戳'} · ${
        ap.timestamp?.showRead ? '已读' : '未读'
    }`;
    syncInfoRowText('info-row-value-timestamp', text);
}


/* ---------- 14.6 聊天数据（导出 / 导入 / 删除） ---------- */

function bindDataModal() {
    // 导出
    const exportBtn = byId('btn-export-chat');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = get(KEYS.CHAT);
            const json = JSON.stringify(data, null, 2);
            downloadFile(json, `mengjiao-chat-${formatDate()}.json`);
            toast('聊天记录已导出');
            closeModal('modal-data');
        });
    }

    // 导入
    const importBtn = byId('btn-import-chat');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                    const text = await readFileAsText(file);
                    const data = JSON.parse(text);
                    if (!data || typeof data !== 'object') throw new Error('格式不正确');
                    set(KEYS.CHAT, data);
                    ensureChatData();
                    renderChatMessages();
                    renderChatListPreview();
                    toast('聊天记录已导入');
                    closeModal('modal-data');
                } catch (err) {
                    toast('导入失败：' + (err.message || '未知错误'));
                }
            };
            input.click();
        });
    }

    // 删除
    const deleteBtn = byId('btn-delete-chat');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!window.confirm('确定要删除所有聊天记录吗？此操作不可恢复。')) return;
            set(KEYS.CHAT, {
                [CHAT_ID]: { messages: [], lastReadTs: 0, draft: '' }
            });
            renderChatMessages();
            renderChatListPreview();
            toast('聊天记录已删除');
            closeModal('modal-data');
        });
    }
}


/* ---------- 14.7 发起群聊 ---------- */

function bindGroupChatModal() {
    const createBtn = byId('btn-create-group-chat');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            const nameInput = byId('group-chat-name');
            const name = (nameInput?.value || '').trim() || '群聊';
            toast(`已创建群聊：${name}`);
            closeModal('modal-group-chat');
            // TODO: 真正创建群聊会话（当前先给提示）
        });
    }

    const addBtn = byId('btn-add-group-member');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            toast('暂无可添加的成员');
        });
    }
}


/* ==========================================================================
   15. 聊天信息页右侧行文本同步
   --------------------------------------------------------------------------
   HTML：
     #info-row-value-bubble     "14px ›"
     #info-row-value-text       "14px ›"
     #info-row-value-avatar     "圆形 · 38px ›"
     #info-row-value-timestamp  "时间戳 · 未读 ›"
   ========================================================================== */

function syncInfoRowText(elId, valueText) {
    const el = byId(elId);
    if (!el) return;
    // 保留末尾的 "›" 箭头
    el.innerHTML = '';
    el.appendChild(document.createTextNode(valueText + ' '));
    const arrow = document.createElement('span');
    arrow.className = 'info-row-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    el.appendChild(arrow);
}

/**
 * 刷新聊天信息页所有展示值
 */
export function refreshChatInfoPage() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const bubble = ap.bubble || {};
    const text = ap.text || {};
    const av = ap.avatar || {};
    const ts = ap.timestamp || {};

    syncInfoRowText('info-row-value-bubble', `${bubble.size || 14}px`);
    syncInfoRowText('info-row-value-text', `${text.size || 14}px`);
    syncInfoRowText(
        'info-row-value-avatar',
        `${av.shape === 'square' ? '方形' : '圆形'} · ${av.size || 38}px`
    );
    updateTimestampInfoRow();

    // 同步开关状态
    const info = get(KEYS.CHAT_INFO);
    const ta = info[CHAT_ID] || {};
    setSwitch(byId('switch-mute'), !!ta.mute);
    setSwitch(byId('switch-top'), !!ta.top);
}

// 监听来自 event.js 的开关变化，持久化
bus.on('switch:change', ({ id, value }) => {
    if (id === 'mute' || id === 'top') {
        const info = get(KEYS.CHAT_INFO);
        info[CHAT_ID] = info[CHAT_ID] || {};
        info[CHAT_ID][id] = value;
        set(KEYS.CHAT_INFO, info);
    }
});


/* ==========================================================================
   16. 打开设置弹窗时同步界面
   ========================================================================== */

/**
 * 打开气泡设置时，用当前值初始化表单
 */
export function syncBubbleModal() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const bubble = ap.bubble || {};
    const sizeEl = byId('bubble-size');
    const radiusEl = byId('bubble-radius');
    if (sizeEl) sizeEl.value = bubble.size || 14;
    if (radiusEl) radiusEl.value = bubble.radius ?? 15;

    // 颜色高亮
    const grid = byId('bubble-color-grid');
    if (grid) {
        grid.querySelectorAll('.color-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.color === bubble.colorMe);
        });
    }

    const cssArea = byId('bubble-custom-css');
    if (cssArea) cssArea.value = bubble.customCss || '';
}

export function syncTextModal() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const text = ap.text || {};
    const sizeEl = byId('text-size');
    if (sizeEl) sizeEl.value = text.size || 14;
    const cssArea = byId('text-custom-css');
    if (cssArea) cssArea.value = text.customCss || '';
}

export function syncAvatarModal() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const av = ap.avatar || {};
    const shapeGroup = byId('avatar-shape-options');
    if (shapeGroup) {
        shapeGroup.querySelectorAll('.shape-option').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.shape === (av.shape || 'circle'));
        });
    }
    const sizeEl = byId('avatar-size');
    if (sizeEl) sizeEl.value = av.size || 38;
}

export function syncBgModal() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const bg = ap.background || {};
    if (bg.type === 'color') {
        const grid = byId('bg-color-grid');
        if (grid) {
            grid.querySelectorAll('.color-item').forEach((item) => {
                item.classList.toggle('active', item.dataset.bgColor === bg.color);
            });
        }
    }
}


/* ==========================================================================
   17. 工具函数
   ========================================================================== */

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}


/* ==========================================================================
   18. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const chatActions = {

    /* ---------- 通用 ---------- */
    'toggle-emoji-picker': () => {
        // 简单实现：弹一个 emoji 输入
        const emoji = window.prompt('输入一个 emoji：', '😊');
        if (!emoji) return;
        const input = byId('chat-input');
        if (input) {
            input.value += emoji;
            input.focus();
        }
    },

    'toggle-more-panel': () => {
        const input = byId('chat-input');
        const choice = window.prompt(
            '输入序号：\n1. 发送图片\n2. 从字卡库选择\n3. 发起群聊',
            '1'
        );
        if (!choice) return;
        const n = parseInt(choice, 10);
        if (n === 1) pickAndSendImage();
        else if (n === 2) pickFromWordCard();
        else if (n === 3) openModal('modal-group-chat');
    },

    /* ---------- 通话 ---------- */
    'start-call': () => {
        bus.emit('call:start', { name: get(KEYS.PROFILE).ta.name || 'TA' });
    },

    /* ---------- 聊天信息页入口 ---------- */
    'open-bg-settings':        () => { syncBgModal(); openModal('modal-bg'); },
    'open-bubble-settings':    () => { syncBubbleModal(); openModal('modal-bubble'); },
    'open-text-settings':      () => { syncTextModal(); openModal('modal-text'); },
    'open-avatar-settings':    () => { syncAvatarModal(); openModal('modal-avatar'); },
    'open-timestamp-settings': () => { openModal('modal-timestamp'); },
    'open-chat-data':          () => openModal('modal-data'),
    'open-group-chat':         () => openModal('modal-group-chat'),
    'close-chat-info':         () => showScreen('screen-chat'),

    /* ---------- 保存 ---------- */
    'save-bubble-settings': () => { toast('已保存'); bus.emit('settings:changed'); },
    'save-text-settings':   () => { toast('已保存'); bus.emit('settings:changed'); },
    'save-avatar-settings': () => { toast('已保存'); bus.emit('settings:changed'); },

    /* ---------- 数据 ---------- */
    'export-chat': () => byId('btn-export-chat')?.click(),
    'import-chat': () => byId('btn-import-chat')?.click(),
    'delete-chat': () => byId('btn-delete-chat')?.click(),
    'create-group-chat': () => byId('btn-create-group-chat')?.click(),

    /* ---------- 搜索（暂用 prompt） ---------- */
    'search-chat': () => {
        const kw = window.prompt('搜索聊天记录：', '');
        if (!kw) return;
        const list = getMessages().filter(
            (m) => m.type === 'text' && (m.content || '').includes(kw)
        );
        toast(`找到 ${list.length} 条包含"${kw}"的消息`);
    },

    /* ---------- 查看 TA 资料 ---------- */
    'view-ta-profile': () => {
        const profile = get(KEYS.PROFILE);
        window.alert(`名字：${profile.ta.name || 'TA'}\n头像：${profile.ta.avatar ? '已设置' : '默认'}`);
    }
};

export const chatNavs = {
    'chat-list': () => showScreen('screen-chat-list'),
    'chat':      () => showScreen('screen-chat'),
    'chat-info': () => {
        refreshChatInfoPage();
        showScreen('screen-chat-info');
    }
};


/* ==========================================================================
   19. 内部辅助：发图片 / 从字卡选
   ========================================================================== */

function pickAndSendImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            appendMessage({ role: 'me', type: 'image', content: reader.result });
            scheduleAutoReply();
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function pickFromWordCard() {
    const wc = get(KEYS.WORD_CARD);
    const pool = [...(wc.main || []), ...(wc.kaomoji || [])];
    if (!pool.length) {
        toast('字卡库还没有内容');
        return;
    }
    const preview = pool.slice(0, 10).map((c, i) => `${i + 1}. ${c.text}`).join('\n');
    const ans = window.prompt(`选择一张字卡（1-${Math.min(10, pool.length)}）：\n${preview}`, '1');
    if (ans === null) return;
    const idx = parseInt(ans, 10) - 1;
    if (idx < 0 || idx >= pool.length) return;
    appendMessage({ role: 'me', type: 'text', content: pool[idx].text });
    scheduleAutoReply();
}


/* ==========================================================================
   20. 对外导出
   ========================================================================== */

export default {
    initChat,
    destroyChat,
    appendMessage,
    sendSystemMessage,
    sendCurrentInput,
    triggerProactiveMessage,
    startProactiveLoop,
    renderChatListPreview,
    refreshChatInfoPage,
    applyAppearance,
    syncBubbleModal,
    syncTextModal,
    syncAvatarModal,
    syncBgModal,
    chatActions,
    chatNavs
};