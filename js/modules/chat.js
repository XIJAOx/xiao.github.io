/* ==========================================================================
   梦角 · Dream Corner
   聊天模块  js/modules/chat.js
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    openModal, closeModal,
    toast,
    setSwitch,
    setCheck, setActiveInGroup,
    formatChatTime, formatDuration, formatDate,
    scrollToBottom,
    uid, randomInt, randomPick, debounce,
    downloadFile, readFileAsText,
    escapeHtml,
    mjConfirm, mjPrompt, mjAlert
} from '../utils/dom.js';

import { KEYS, get, set, update } from '../utils/storage.js';

import { bus } from '../utils/event.js';


const CHAT_ID = 'ta';
const RENDERED_FLAG = 'data-rendered';
const PROACTIVE_COOLDOWN = 60 * 1000;
const DEFAULT_BUBBLE_COLOR = '#000';

let _initialized = false;
let _unsubs = [];
let _replyTimers = [];
let _lastProactiveAt = 0;
let _inChatScreen = false;


/* ==========================================================================
   入口
   ========================================================================== */

export function initChat() {
    if (_initialized) return;
    _initialized = true;

    ensureChatData();
    applyAppearance();
    renderChatHeader();
    renderChatListPreview();
    renderChatMessages();
    bindInput();
    bindSettingsModals();

    _unsubs.push(
        bus.on('profile:update', () => {
            renderChatHeader();
            renderChatListPreview();
        }),
        bus.on('settings:changed', applyAppearance),
        bus.on('screen:change', ({ id }) => {
            _inChatScreen = id === 'screen-chat';
            if (_inChatScreen) {
                markAllRead();
                scrollChatToBottom(false);
            }
        }),
        bus.on('chat:system-message', (text) => {
            if (text) appendMessage({ role: 'me', type: 'text', content: text });
        }),
        bus.on('chat:ta-message', (text) => {
            if (text) appendMessage({ role: 'ta', type: 'text', content: text });
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
   数据
   ========================================================================== */

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
   渲染：列表预览
   ========================================================================== */

export function renderChatListPreview() {
    const last = getLastMessage();
    const msgEl = byId('chat-list-last-msg');
    const timeEl = byId('chat-list-time-ta');
    const unreadEl = byId('chat-list-unread-ta');

    if (msgEl) {
        if (!last) msgEl.textContent = '还没有对话哦';
        else if (last.type === 'image') msgEl.textContent = '[图片]';
        else if (last.type === 'voice') msgEl.textContent = '[语音]';
        else msgEl.textContent = last.content || '';
    }
    if (timeEl) timeEl.textContent = last ? formatChatTime(last.ts) : '';
    if (unreadEl) {
        const c = getUnreadCount();
        unreadEl.textContent = c > 0 ? String(c) : '';
    }
}


/* ==========================================================================
   渲染：聊天头
   ========================================================================== */

function renderChatHeader() {
    const profile = get(KEYS.PROFILE);
    const nameEl = byId('chat-header-name');
    if (nameEl) nameEl.textContent = profile.ta.name || 'TA';

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
   时间格式化（气泡下方）
   ========================================================================== */

function formatTimeInline(ts, format) {
    const d = ts instanceof Date ? ts : new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return format === 'hms' ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}


/* ==========================================================================
   渲染：消息
   ========================================================================== */

function renderChatMessages() {
    const container = byId('chat-message-list');
    if (!container) return;

    const list = getMessages();
    const empty = byId('chat-empty-state');

    if (!list.length) {
        if (empty) empty.hidden = false;
        Array.from(container.children).forEach((child) => {
            if (child !== empty) child.remove();
        });
        container.setAttribute(RENDERED_FLAG, '1');
        return;
    }

    if (empty) empty.hidden = true;

    Array.from(container.children).forEach((child) => {
        if (child !== empty) child.remove();
    });

    const fragment = document.createDocumentFragment();
    list.forEach((msg) => {
        fragment.appendChild(createMessageEl(msg));
    });

    container.appendChild(fragment);
    container.setAttribute(RENDERED_FLAG, '1');
}

function createMessageEl(msg) {
    const profile = get(KEYS.PROFILE);
    const appearance = get(KEYS.CHAT_APPEARANCE);
    const showTime = appearance.timestamp?.show !== false;
    const showRead = !!appearance.timestamp?.showRead && msg.role === 'me';
    const timeFormat = appearance.timestamp?.format || 'hm';

    const row = document.createElement('div');
    row.className = `chat-row ${msg.role === 'me' ? 'me' : 'ta'}`;
    row.dataset.msgId = msg.id;

    const avatar = document.createElement('div');
    avatar.className = 'chat-row-avatar';
    const avatarSrc = msg.role === 'me' ? profile.me.avatar : profile.ta.avatar;
    avatar.appendChild(createAvatarContent(avatarSrc));
    row.appendChild(avatar);

    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrap ${msg.role === 'me' ? 'me' : 'ta'}`;

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
        bubble.textContent = msg.content || '';
    }

    wrap.appendChild(bubble);

    // 气泡下方右侧：时间戳 + 已读/未读
    if (showTime || showRead) {
        const metaRow = document.createElement('div');
        metaRow.className = 'chat-meta-row';

        if (showTime) {
            const timeEl = document.createElement('span');
            timeEl.className = 'chat-time-inline';
            timeEl.textContent = formatTimeInline(msg.ts, timeFormat);
            metaRow.appendChild(timeEl);
        }
        if (showRead) {
            const readEl = document.createElement('span');
            readEl.className = 'chat-read-inline';
            readEl.textContent = msg.read ? '已读' : '未读';
            metaRow.appendChild(readEl);
        }
        wrap.appendChild(metaRow);
    }

    attachMessageContextMenu(bubble, msg);
    row.appendChild(wrap);
    return row;
}

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
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
    svg.appendChild(path);
    return svg;
}

function scrollChatToBottom(smooth = false) {
    const container = byId('chat-message-list');
    if (!container) return;
    requestAnimationFrame(() => scrollToBottom(container, smooth));
}


/* ==========================================================================
   追加消息
   ========================================================================== */

export function appendMessage(msg) {
    const list = getMessages();

    const role = msg.role || 'me';
    const full = {
        id: msg.id || uid('msg'),
        role,
        type: msg.type || 'text',
        content: msg.content || '',
        ts: msg.ts || Date.now(),
        read: msg.read !== undefined ? msg.read : (role === 'ta'),
        ...msg
    };

    list.push(full);
    setMessages(list);

    const container = byId('chat-message-list');
    if (container && container.getAttribute(RENDERED_FLAG)) {
        const empty = byId('chat-empty-state');
        if (empty) empty.hidden = true;
        container.appendChild(createMessageEl(full));
        scrollChatToBottom(true);
    }

    renderChatListPreview();
    bus.emit('chat:new-message', full);
    return full;
}

export function sendSystemMessage(text) {
    appendMessage({ role: 'me', type: 'text', content: text });
}


/* ==========================================================================
   输入区
   ========================================================================== */

function bindInput() {
    const input = byId('chat-input');
    if (!input) return;

    const chat = ensureChatData();
    if (chat.draft) input.value = chat.draft;

    const saveDraft = debounce((val) => {
        const c = get(KEYS.CHAT);
        c[CHAT_ID].draft = val;
        set(KEYS.CHAT, c);
    }, 400);

    input.addEventListener('input', () => saveDraft(input.value));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendCurrentInput();
        }
    });

    input.addEventListener('blur', () => {
        const c = get(KEYS.CHAT);
        c[CHAT_ID].draft = input.value;
        set(KEYS.CHAT, c);
    });
}

export function sendCurrentInput() {
    const input = byId('chat-input');
    if (!input) return;
    const text = (input.value || '').trim();
    if (!text) return;

    appendMessage({ role: 'me', type: 'text', content: text });

    input.value = '';
    const chat = get(KEYS.CHAT);
    chat[CHAT_ID].draft = '';
    set(KEYS.CHAT, chat);

    scheduleAutoReply();
}


/* ==========================================================================
   自动回复
   ========================================================================== */

const TA_REPLIES = [
    '嗯嗯，我在呢', '今天想我了没？', '嘻嘻，刚看到消息', '好呀，听你的',
    '那你呢？在干嘛呀', '我也想你了~', '嘿嘿，抱抱', '嗯…让我想想',
    '今天累不累？', '记得好好吃饭哦', '我一直都在呀', '好想快点见到你',
    '你开心我就开心', '要好好照顾自己呀', '晚点再聊好不好', '嗯…你说得对',
    '哇，真的吗？', '我也是这么想的', '嘿嘿，被你发现了', '那必须的呀'
];

function scheduleAutoReply() {
    const settings = get(KEYS.SETTINGS);
    const replyCfg = settings.reply || {};

    if (replyCfg.readNoReply) {
        markAllRead();
        return;
    }

    const minSpeed = Math.max(0, Number(replyCfg.minSpeed) || 1);
    const maxSpeed = Math.max(minSpeed, Number(replyCfg.maxSpeed) || 10);
    const delaySec = randomInt(minSpeed, maxSpeed);

    const minCount = Math.max(1, Number(replyCfg.minCount) || 1);
    const maxCount = Math.max(minCount, Number(replyCfg.maxCount) || 3);
    const totalCount = randomInt(minCount, maxCount);

    for (let i = 0; i < totalCount; i++) {
        const delay = (delaySec * 1000) + i * randomInt(500, 1500);
        const timer = setTimeout(() => {
            const text = generateReplyText();
            appendMessage({ role: 'ta', type: 'text', content: text });
            if (i === totalCount - 1) {
                const chat = get(KEYS.CHAT);
                chat[CHAT_ID].lastReadTs = Date.now();
                chat[CHAT_ID].messages.forEach((m) => {
                    if (m.role === 'me') m.read = true;
                });
                set(KEYS.CHAT, chat);
                renderChatMessages();
            }
        }, delay);
        _replyTimers.push(timer);
    }
}

function generateReplyText() {
    const settings = get(KEYS.SETTINGS);
    const replyCfg = settings.reply || {};

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

    return randomPick(TA_REPLIES) || '嗯嗯';
}

export function triggerProactiveMessage() {
    const settings = get(KEYS.SETTINGS);
    if (!settings.reply?.taProactive) return;

    const now = Date.now();
    if (now - _lastProactiveAt < PROACTIVE_COOLDOWN) return;
    _lastProactiveAt = now;

    appendMessage({ role: 'ta', type: 'text', content: generateReplyText() });
    if (!_inChatScreen) bus.emit('chat:unread');
}

export function startProactiveLoop() {
    setInterval(() => {
        const settings = get(KEYS.SETTINGS);
        if (!settings.reply?.taProactive) return;
        if (Math.random() < 0.08) triggerProactiveMessage();
    }, 60 * 1000);
}


/* ==========================================================================
   长按消息菜单
   ========================================================================== */

function attachMessageContextMenu(el, msg) {
    let pressTimer = null;
    const start = () => {
        pressTimer = setTimeout(() => showMessageMenu(msg), 550);
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
        showMessageMenu(msg);
    });
}

async function showMessageMenu(msg) {
    if (msg.type !== 'text') {
        const ok = await mjConfirm('删除这条消息？', { title: '删除消息' });
        if (ok) deleteMessage(msg.id);
        return;
    }

    const text = msg.content || '';
    const choice = await mjPrompt('输入序号操作：\n1. 复制\n2. 收藏\n3. 删除', {
        title: '操作消息',
        defaultValue: '1',
        confirmText: '执行'
    });
    if (choice === null) return;

    const n = parseInt(String(choice).trim(), 10);
    if (n === 1) copyText(text);
    else if (n === 2) addToFavorites(text);
    else if (n === 3) {
        const ok = await mjConfirm('删除这条消息？', { title: '删除消息' });
        if (ok) deleteMessage(msg.id);
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
   外观设置
   ========================================================================== */

export function applyAppearance() {
    const ap = get(KEYS.CHAT_APPEARANCE) || {};
    const root = document.documentElement;
    const chatScreen = byId('screen-chat');

    const bubble = ap.bubble || {};
    root.style.setProperty('--bubble-size', `${bubble.size || 14}px`);
    root.style.setProperty('--bubble-radius', `${bubble.radius ?? 15}px`);
    root.style.setProperty('--bubble-me-bg', bubble.colorMe || DEFAULT_BUBBLE_COLOR);
    root.style.setProperty(
        '--bubble-me-text',
        isDarkColor(bubble.colorMe || DEFAULT_BUBBLE_COLOR) ? '#fff' : '#1a1a1a'
    );

    const textCfg = ap.text || {};
    if (chatScreen) chatScreen.style.fontSize = `${textCfg.size || 14}px`;

    const av = ap.avatar || {};
    root.style.setProperty('--avatar-size', `${av.size || 38}px`);
    root.style.setProperty('--avatar-radius', av.shape === 'square' ? '8px' : '999px');

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

    applyCustomCss(ap);
}

function isDarkColor(color) {
    if (!color) return true;
    const hex = color.replace('#', '');
    if (hex.length !== 3 && hex.length !== 6) return true;
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.6;
}

let _customStyleEl = null;

function applyCustomCss(ap) {
    if (!_customStyleEl) {
        _customStyleEl = document.createElement('style');
        _customStyleEl.id = 'mj-custom-css';
        document.head.appendChild(_customStyleEl);
    }
    const css = [ap.bubble?.customCss || '', ap.text?.customCss || ''].join('\n');
    _customStyleEl.textContent = css;
}


/* ==========================================================================
   设置弹窗
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


/* ---------- 背景 ---------- */

function bindBgModal() {
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


/* ---------- 气泡 ---------- */

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

    const cssArea = byId('bubble-custom-css');
    if (cssArea) {
        cssArea.addEventListener('change', () => {
            update(KEYS.CHAT_APPEARANCE, {
                bubble: { ...get(KEYS.CHAT_APPEARANCE).bubble, customCss: cssArea.value }
            });
            applyAppearance();
        });
    }

    const saveBtn = byId('btn-save-bubble');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            toast('气泡设置已保存');
            bus.emit('settings:changed');
        });
    }
}


/* ---------- 文字 ---------- */

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


/* ---------- 头像 ---------- */

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

            update(KEYS.CHAT_APPEARANCE, { avatar: { shape, size } });
            syncInfoRowText(
                'info-row-value-avatar',
                `${shape === 'circle' ? '圆形' : '方形'} · ${size}px`
            );
            applyAppearance();
            toast('头像设置已保存');
        });
    }
}


/* ---------- 时间戳 / 已读 ---------- */

function bindTimestampModal() {
    bus.on('check:change', ({ id, value }) => {
        if (id === 'timestamp') {
            update(KEYS.CHAT_APPEARANCE, {
                timestamp: { ...get(KEYS.CHAT_APPEARANCE).timestamp, show: value }
            });
            renderChatMessages();
            updateTimestampInfoRow();
        } else if (id === 'read-receipt') {
            update(KEYS.CHAT_APPEARANCE, {
                timestamp: { ...get(KEYS.CHAT_APPEARANCE).timestamp, showRead: value }
            });
            renderChatMessages();
            updateTimestampInfoRow();
        }
    });

    const modal = byId('modal-timestamp');
    if (modal) {
        // 时间格式切换
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-time-format]');
            if (!btn) return;
            const format = btn.dataset.timeFormat;
            update(KEYS.CHAT_APPEARANCE, {
                timestamp: { ...get(KEYS.CHAT_APPEARANCE).timestamp, format }
            });
            syncTimeFormatButtons(format);
            renderChatMessages();
        });

        // 打开时同步界面状态
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('active')) {
                const ap = get(KEYS.CHAT_APPEARANCE);
                setCheck(byId('check-timestamp'), ap.timestamp?.show !== false);
                setCheck(byId('check-read-receipt'), !!ap.timestamp?.showRead);
                syncTimeFormatButtons(ap.timestamp?.format || 'hm');
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
}

function syncTimeFormatButtons(format) {
    document.querySelectorAll('[data-time-format]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.timeFormat === format);
    });
}

function updateTimestampInfoRow() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const text = `${ap.timestamp?.show !== false ? '时间戳' : '无时间戳'} · ${
        ap.timestamp?.showRead ? '已读' : '未读'
    }`;
    syncInfoRowText('info-row-value-timestamp', text);
}


/* ---------- 数据 ---------- */

function bindDataModal() {
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

    const deleteBtn = byId('btn-delete-chat');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const ok = await mjConfirm('确定要删除所有聊天记录吗？此操作不可恢复。', {
                title: '删除聊天记录'
            });
            if (!ok) return;
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


/* ---------- 群聊 ---------- */

function bindGroupChatModal() {
    const createBtn = byId('btn-create-group-chat');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            const nameInput = byId('group-chat-name');
            const name = (nameInput?.value || '').trim() || '群聊';
            toast(`已创建群聊：${name}`);
            closeModal('modal-group-chat');
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
   聊天信息页
   ========================================================================== */

function syncInfoRowText(elId, valueText) {
    const el = byId(elId);
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(document.createTextNode(valueText + ' '));
    const arrow = document.createElement('span');
    arrow.className = 'info-row-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '›';
    el.appendChild(arrow);
}

export function refreshChatInfoPage() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const bubble = ap.bubble || {};
    const text = ap.text || {};
    const av = ap.avatar || {};

    syncInfoRowText('info-row-value-bubble', `${bubble.size || 14}px`);
    syncInfoRowText('info-row-value-text', `${text.size || 14}px`);
    syncInfoRowText(
        'info-row-value-avatar',
        `${av.shape === 'square' ? '方形' : '圆形'} · ${av.size || 38}px`
    );
    updateTimestampInfoRow();

    const info = get(KEYS.CHAT_INFO);
    const ta = info[CHAT_ID] || {};
    setSwitch(byId('switch-mute'), !!ta.mute);
    setSwitch(byId('switch-top'), !!ta.top);
}

bus.on('switch:change', ({ id, value }) => {
    if (id === 'mute' || id === 'top') {
        const info = get(KEYS.CHAT_INFO);
        info[CHAT_ID] = info[CHAT_ID] || {};
        info[CHAT_ID][id] = value;
        set(KEYS.CHAT_INFO, info);
    }
});


/* ==========================================================================
   同步弹窗
   ========================================================================== */

export function syncBubbleModal() {
    const ap = get(KEYS.CHAT_APPEARANCE);
    const bubble = ap.bubble || {};
    const sizeEl = byId('bubble-size');
    const radiusEl = byId('bubble-radius');
    if (sizeEl) sizeEl.value = bubble.size || 14;
    if (radiusEl) radiusEl.value = bubble.radius ?? 15;

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
   工具
   ========================================================================== */

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const chatActions = {

    'toggle-emoji-picker': async () => {
        const emoji = await mjPrompt('输入一个 emoji', {
            title: '插入表情',
            placeholder: '例如 😊',
            confirmText: '插入'
        });
        if (!emoji) return;
        const input = byId('chat-input');
        if (input) {
            input.value += emoji;
            input.focus();
        }
    },

    'toggle-more-panel': async () => {
        const choice = await mjPrompt('输入序号：\n1. 发送图片\n2. 从字卡库选择\n3. 发起群聊', {
            title: '更多功能',
            defaultValue: '1',
            confirmText: '执行'
        });
        if (choice === null) return;
        const n = parseInt(String(choice).trim(), 10);
        if (n === 1) pickAndSendImage();
        else if (n === 2) pickFromWordCard();
        else if (n === 3) openModal('modal-group-chat');
    },

    'start-call': () => {
        bus.emit('call:start', { name: get(KEYS.PROFILE).ta.name || 'TA' });
    },

    'open-bg-settings':        () => { syncBgModal(); openModal('modal-bg'); },
    'open-bubble-settings':    () => { syncBubbleModal(); openModal('modal-bubble'); },
    'open-text-settings':      () => { syncTextModal(); openModal('modal-text'); },
    'open-avatar-settings':    () => { syncAvatarModal(); openModal('modal-avatar'); },
    'open-timestamp-settings': () => { openModal('modal-timestamp'); },
    'open-chat-data':          () => openModal('modal-data'),
    'open-group-chat':         () => openModal('modal-group-chat'),
    'close-chat-info':         () => showScreen('screen-chat'),

    'save-bubble-settings': () => { toast('已保存'); bus.emit('settings:changed'); },
    'save-text-settings':   () => { toast('已保存'); bus.emit('settings:changed'); },
    'save-avatar-settings': () => { toast('已保存'); bus.emit('settings:changed'); },

    'export-chat': () => byId('btn-export-chat')?.click(),
    'import-chat': () => byId('btn-import-chat')?.click(),
    'delete-chat': () => byId('btn-delete-chat')?.click(),
    'create-group-chat': () => byId('btn-create-group-chat')?.click(),

    'search-chat': async () => {
        const kw = await mjPrompt('搜索聊天记录', {
            title: '搜索',
            placeholder: '输入关键词',
            confirmText: '搜索'
        });
        if (!kw) return;
        const list = getMessages().filter(
            (m) => m.type === 'text' && (m.content || '').includes(kw)
        );
        toast(`找到 ${list.length} 条包含"${kw}"的消息`);
    },

    'view-ta-profile': () => {
        const profile = get(KEYS.PROFILE);
        mjAlert(
            `名字：${profile.ta.name || 'TA'}\n头像：${profile.ta.avatar ? '已设置' : '默认'}`,
            { title: 'TA 的资料' }
        );
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
   辅助
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

async function pickFromWordCard() {
    const wc = get(KEYS.WORD_CARD);
    const pool = [...(wc.main || []), ...(wc.kaomoji || [])];
    if (!pool.length) {
        toast('字卡库还没有内容');
        return;
    }
    const preview = pool.slice(0, 10).map((c, i) => `${i + 1}. ${c.text}`).join('\n');
    const ans = await mjPrompt(`选择一张字卡（1-${Math.min(10, pool.length)}）\n${preview}`, {
        title: '选择字卡',
        defaultValue: '1',
        confirmText: '发送'
    });
    if (ans === null) return;
    const idx = parseInt(String(ans).trim(), 10) - 1;
    if (idx < 0 || idx >= pool.length) return;
    appendMessage({ role: 'me', type: 'text', content: pool[idx].text });
    scheduleAutoReply();
}


/* ==========================================================================
   对外导出
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
