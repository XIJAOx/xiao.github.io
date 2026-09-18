/* ==========================================================================
   梦角 · Dream Corner
   信件模块  js/modules/letters.js
   ========================================================================== */

import {
    $, $$, byId,
    showScreen, openModal, closeModal,
    toast,
    setVisible, setText,
    formatDate, formatChatTime,
    uid, randomInt, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set, update
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';

import { mjPrompt, mjConfirm, mjAlert } from '../utils/dialogs.js';


const TABS = {
    SENT: 'sent',
    RECEIVED: 'received',
    TIME: 'time'
};

const EMPTY_STATE = {
    [TABS.SENT]: {
        icon: '✉',
        hint: '还没有寄出任何信件',
        sub: '提笔写下心意，寄送给Ta吧~'
    },
    [TABS.RECEIVED]: {
        icon: '📥',
        hint: '还没有收到来信',
        sub: '耐心等待，TA 的心意正在路上'
    },
    [TABS.TIME]: {
        icon: '🌐',
        hint: '还没有时空来信',
        sub: '写一封给未来，或邀请 TA 给你写一封'
    }
};

const REPLY_LETTERS = [
    '见字如面。今天路过那家奶茶店，忽然想起你说过的芋泥波波，就顺手买了一杯。味道和你形容的一样，甜得让人眯起眼睛。',
    '昨晚梦到你笑着跑向我，醒来发现枕头湿了一片。原来想念也会有重量。',
    '这两天降温了，记得多穿一件。你总是不肯好好照顾自己，让我很操心。',
    '读到你的信，我的心跳漏了一拍。原来被记挂着的滋味，是这样的。',
    '今天阳光很好，透过窗帘落在地板上，像极了你笑起来的模样。',
    '有些话当面说不出口，只好写下来：遇见你，是我做过最幸运的事。',
    '最近在学做菜，第一道就想让你尝尝。不知道什么时候才能见到你。',
    '刚刚下了一场雨，我撑着伞慢慢走回家，忽然很想有人在伞下和我说话。'
];

const TIME_LETTERS = [
    '写给一年后的你：那时候的我们，应该会牵着彼此的手看日落吧。',
    '给三年后的自己：希望你还记得今天写下这封信时的心跳。',
    '给十年后的你：如果还记得这个梦，请替我说一声谢谢。',
    '给未来的我们：愿你我都还保留着现在这份笨拙又真诚的喜欢。',
    '写给我未来的女儿：妈妈在年轻的时候，真的很认真喜欢过一个人。'
];

let _initialized = false;
let _unsubs = [];
let _currentTab = TABS.SENT;
let _writePanelEl = null;


/* ==========================================================================
   入口
   ========================================================================== */

export function initLetters() {
    if (_initialized) return;
    _initialized = true;

    bindTabs();
    bindWriteButton();
    ensureLettersData();
    renderCurrentTab();

    _unsubs.push(
        bus.on('letter:new', () => renderCurrentTab())
    );
}

export function destroyLetters() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   数据
   ========================================================================== */

function ensureLettersData() {
    const data = get(KEYS.LETTERS);
    if (!Array.isArray(data.sent))     data.sent = [];
    if (!Array.isArray(data.received)) data.received = [];
    if (!Array.isArray(data.time))     data.time = [];
    set(KEYS.LETTERS, data);
    return data;
}


/* ==========================================================================
   Tab 切换
   ========================================================================== */

function bindTabs() {
    const tabsEl = byId('letter-tabs');
    if (!tabsEl) return;

    tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-letter-tab]');
        if (!btn) return;
        switchTab(btn.dataset.letterTab);
    });
}

export function switchTab(tab) {
    if (!Object.values(TABS).includes(tab)) return;
    _currentTab = tab;

    const tabsEl = byId('letter-tabs');
    if (tabsEl) {
        tabsEl.querySelectorAll('.letter-tab').forEach((btn) => {
            const active = btn.dataset.letterTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    renderCurrentTab();
}


/* ==========================================================================
   渲染
   ========================================================================== */

function renderCurrentTab() {
    const body = byId('letter-content');
    if (!body) return;

    const data = get(KEYS.LETTERS);
    const list = data[_currentTab] || [];

    if (!list.length) {
        renderEmptyState(body, _currentTab);
        return;
    }

    renderList(body, _currentTab, list);
}

function renderEmptyState(body, tab) {
    const cfg = EMPTY_STATE[tab];
    body.innerHTML = `
        <div class="letter-icon" id="letter-icon" aria-hidden="true">${cfg.icon}</div>
        <div class="letter-hint" id="letter-hint">${cfg.hint}</div>
        <div class="letter-sub" id="letter-sub">${cfg.sub}</div>
    `;
}

function renderList(body, tab, list) {
    body.innerHTML = '<div class="mj-letter-list"></div>';
    const wrap = body.querySelector('.mj-letter-list');
    if (!wrap) return;

    const sorted = list.slice().sort((a, b) => b.ts - a.ts);

    sorted.forEach((letter) => {
        wrap.appendChild(createLetterCard(letter, tab));
    });
}

function createLetterCard(letter, tab) {
    const card = document.createElement('article');
    card.className = 'mj-letter-card';
    card.dataset.letterId = letter.id;

    const title = document.createElement('h3');
    title.className = 'mj-letter-card-title';
    title.textContent = letter.title || '无题';
    card.appendChild(title);

    const excerpt = document.createElement('p');
    excerpt.className = 'mj-letter-card-excerpt';
    const raw = (letter.body || '').replace(/\s+/g, ' ');
    excerpt.textContent = raw.slice(0, 60) + (raw.length > 60 ? '…' : '');
    card.appendChild(excerpt);

    const meta = document.createElement('div');
    meta.className = 'mj-letter-card-meta';
    const fromTo = tab === TABS.SENT ? `致 ${letter.to || 'TA'}`
                : tab === TABS.RECEIVED ? `来自 ${letter.from || 'TA'}`
                : `寄往未来`;
    meta.innerHTML = `
        <span class="mj-letter-card-fromto">${escapeHtml(fromTo)}</span>
        <span class="mj-letter-card-time">${escapeHtml(formatChatTime(letter.ts))}</span>
    `;
    card.appendChild(meta);

    if (tab === TABS.RECEIVED && !letter.read) {
        const dot = document.createElement('span');
        dot.className = 'mj-letter-card-unread';
        card.appendChild(dot);
    }

    card.addEventListener('click', () => openLetterDetail(letter, tab));

    return card;
}


/* ==========================================================================
   信件详情
   ========================================================================== */

function openLetterDetail(letter, tab) {
    if (tab === TABS.RECEIVED && !letter.read) {
        markLetterRead(letter.id);
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'modal-letter-detail';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="modal modal-letter-detail">
            <div class="modal-header">
                <h2 class="modal-title"></h2>
                <button class="modal-close" data-letter-detail-close aria-label="关闭">✕</button>
            </div>
            <div class="mj-letter-detail-body"></div>
            <div class="mj-letter-detail-meta"></div>
            <button class="modal-btn primary" data-letter-detail-close style="width:100%;margin-top:16px;">关闭</button>
        </div>
    `;

    overlay.querySelector('.modal-title').textContent = letter.title || '无题';

    const bodyEl = overlay.querySelector('.mj-letter-detail-body');
    bodyEl.textContent = letter.body || '';

    const metaEl = overlay.querySelector('.mj-letter-detail-meta');
    const fromTo = tab === TABS.SENT ? `致 ${letter.to || 'TA'}`
                : tab === TABS.RECEIVED ? `来自 ${letter.from || 'TA'}`
                : `寄往未来`;
    metaEl.textContent = `${fromTo} · ${formatChatTime(letter.ts)}`;

    overlay.addEventListener('click', (e) => {
        if (e.target.closest('[data-letter-detail-close]') || e.target === overlay) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
}

function markLetterRead(id) {
    const data = get(KEYS.LETTERS);
    const letter = data.received.find((l) => l.id === id);
    if (letter && !letter.read) {
        letter.read = true;
        set(KEYS.LETTERS, data);
    }
}


/* ==========================================================================
   写信
   ========================================================================== */

function bindWriteButton() {
    const btn = byId('btn-write-letter');
    if (!btn) return;
    btn.addEventListener('click', openWritePanel);
}

export function openWritePanel() {
    if (!_writePanelEl) {
        _writePanelEl = createWritePanel();
        const screen = byId('screen-letters');
        if (screen) screen.appendChild(_writePanelEl);
    }
    _writePanelEl.hidden = false;

    const titleEl = _writePanelEl.querySelector('#letter-write-title');
    const bodyEl = _writePanelEl.querySelector('#letter-write-body');
    const cardCountEl = _writePanelEl.querySelector('#letter-write-cardcount');
    if (titleEl) titleEl.value = '';
    if (bodyEl) bodyEl.value = '';
    if (cardCountEl) cardCountEl.textContent = '0';

    setTimeout(() => titleEl?.focus(), 200);
}

function createWritePanel() {
    const panel = document.createElement('div');
    panel.className = 'question-create-panel';
    panel.id = 'letter-write-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <div class="question-create-header">
            <h3>提笔写信</h3>
            <button data-letter-write-close aria-label="关闭">✕</button>
        </div>
        <div class="question-create-body">
            <div class="question-create-item">
                <label for="letter-write-title">标题</label>
                <input type="text" id="letter-write-title" placeholder="给这封信起个名字..." maxlength="40">
            </div>
            <div class="question-create-item">
                <label for="letter-write-body">正文</label>
                <textarea id="letter-write-body" rows="8"
                    style="width:100%;padding:12px 16px;border:1px solid var(--c-line-2);border-radius:12px;font-size:14px;line-height:1.65;background:var(--c-surface-2);resize:none;"
                    placeholder="提笔写下心意，寄送给Ta吧~"></textarea>
            </div>
            <div class="question-create-item">
                <label>使用字卡</label>
                <div style="font-size:12px;color:var(--c-text-3);">
                    已使用 <span id="letter-write-cardcount">0</span> 张字卡
                    <button type="button" data-letter-pick-card
                        style="margin-left:8px;padding:4px 10px;border-radius:999px;font-size:12px;color:var(--c-primary);background:var(--c-primary-soft);">
                        + 挑选字卡
                    </button>
                </div>
            </div>
        </div>
        <div class="question-create-actions">
            <button data-letter-write-close>取消</button>
            <button data-letter-write-save>寄出</button>
        </div>
    `;

    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-letter-write-close]')) {
            panel.hidden = true;
            return;
        }
        if (e.target.closest('[data-letter-pick-card]')) {
            insertWordCard(panel);
            return;
        }
        if (e.target.closest('[data-letter-write-save]')) {
            submitLetter(panel);
        }
    });

    return panel;
}

async function insertWordCard(panel) {
    const wc = get(KEYS.WORD_CARD);
    const pool = [...(wc.main || []), ...(wc.kaomoji || []), ...(wc.emoji || [])];
    if (!pool.length) {
        toast('字卡库还没有内容，去设置里添加吧');
        return;
    }

    const preview = pool.slice(0, 10)
        .map((c, i) => `${i + 1}. ${c.text}`)
        .join('\n');

    const ans = await mjPrompt('挑选字卡', {
        placeholder: preview,
        defaultValue: '1',
        confirmText: '插入'
    });
    if (ans === null) return;

    const idx = parseInt(String(ans).trim(), 10) - 1;
    if (idx < 0 || idx >= pool.length) return;

    const card = pool[idx];
    const bodyEl = panel.querySelector('#letter-write-body');
    if (bodyEl) {
        bodyEl.value += (bodyEl.value ? '\n' : '') + card.text;
    }

    const countEl = panel.querySelector('#letter-write-cardcount');
    if (countEl) {
        const n = parseInt(countEl.textContent, 10) + 1;
        countEl.textContent = String(n);
    }
}

function submitLetter(panel) {
    const titleEl = panel.querySelector('#letter-write-title');
    const bodyEl = panel.querySelector('#letter-write-body');
    const countEl = panel.querySelector('#letter-write-cardcount');

    const title = (titleEl?.value || '').trim() || '无题';
    const body = (bodyEl?.value || '').trim();
    const cardCount = parseInt(countEl?.textContent, 10) || 0;

    if (!body) {
        toast('信正文不能为空哦');
        return;
    }

    const settings = get(KEYS.SETTINGS);
    const letterCfg = settings.letter || {};
    const minCards = Number(letterCfg.minCards) || 0;
    const maxCards = Number(letterCfg.maxCards) || 99;

    if (cardCount < minCards) {
        toast(`至少使用 ${minCards} 张字卡`);
        return;
    }
    if (cardCount > maxCards) {
        toast(`最多使用 ${maxCards} 张字卡`);
        return;
    }

    const data = get(KEYS.LETTERS);
    const letter = {
        id: uid('letter'),
        title,
        body,
        to: get(KEYS.PROFILE).ta.name || 'TA',
        ts: Date.now(),
        read: true
    };
    data.sent.push(letter);
    set(KEYS.LETTERS, data);

    panel.hidden = true;

    switchTab(TABS.SENT);

    toast('信件已寄出 ✈');

    scheduleReply(letter);

    bus.emit('letter:sent', letter);
}


/* ==========================================================================
   TA 回信
   ========================================================================== */

function scheduleReply(myLetter) {
    const settings = get(KEYS.SETTINGS);
    const cfg = settings.letter || {};
    const minSec = Math.max(1, Number(cfg.minTime) || 5);
    const maxSec = Math.max(minSec, Number(cfg.maxTime) || 30);

    const delayMs = randomInt(minSec * 200, maxSec * 200);

    setTimeout(() => {
        const data = get(KEYS.LETTERS);
        const reply = {
            id: uid('letter'),
            title: `回复：${myLetter.title || '无题'}`,
            body: randomPick(REPLY_LETTERS),
            from: get(KEYS.PROFILE).ta.name || 'TA',
            ts: Date.now(),
            read: false
        };
        data.received.push(reply);
        set(KEYS.LETTERS, data);

        if (_currentTab === TABS.RECEIVED) {
            renderCurrentTab();
        }
        toast('收到一封新的来信 📩');
        bus.emit('letter:new', reply);
    }, delayMs);
}


/* ==========================================================================
   时空来信
   ========================================================================== */

export function createTimeLetter() {
    const data = get(KEYS.LETTERS);
    const letter = {
        id: uid('letter'),
        title: '写给未来的信',
        body: randomPick(TIME_LETTERS),
        from: '未来的你',
        to: get(KEYS.PROFILE).me.name || '我',
        ts: Date.now()
    };
    data.time.push(letter);
    set(KEYS.LETTERS, data);

    switchTab(TABS.TIME);
    toast('已生成一封时空来信 🌐');
    bus.emit('letter:new', letter);
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const lettersActions = {
    'write-letter':       () => openWritePanel(),
    'create-time-letter': () => createTimeLetter()
};

export const lettersNavs = {
    'letters': () => {
        ensureLettersData();
        renderCurrentTab();
        showScreen('screen-letters');
    }
};

export default {
    initLetters,
    destroyLetters,
    switchTab,
    openWritePanel,
    createTimeLetter,
    lettersActions,
    lettersNavs
};
