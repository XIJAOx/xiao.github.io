/* ==========================================================================
   梦角 · Dream Corner
   首页模块  js/modules/home.js
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    openModal, closeModal,
    toast,
    setVisible, setText, setPlaceholder,
    formatDate, formatDuration, formatYearMonth,
    scrollToBottom,
    randomPick, randomInt, uid,
    escapeHtml,
    mjConfirm, mjPrompt
} from '../utils/dom.js';
import {
    KEYS, get, set, update, ensure, has
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';

const LOVE_QUOTES = [
    '你是我藏在心里的欢喜',
    '今天也很想你呀',
    '你是我平淡生活里的星光',
    '想把所有温柔都攒下来给你',
    '喜欢你这件事，从来没有变过',
    '世界一般，但你超值',
    '想和你一起，把日子过成诗',
    '所有心动都指向你',
    '一见到你，心里就开满花',
    '你是我的心头好，也是我的意难平',
    '想牵着你的手，走很远很远的路',
    '认识你之后，每个明天都值得期待'
];

const MOOD_OPTIONS = [
    { value: '😊', label: '开心' },
    { value: '🥰', label: '恋爱了' },
    { value: '😌', label: '平静' },
    { value: '😐', label: '一般' },
    { value: '😔', label: '有点低落' },
    { value: '😭', label: '难过' },
    { value: '😤', label: '生气' },
    { value: '🤔', label: '思考中' },
    { value: '😴', label: '困困的' },
    { value: '🤒', label: '不舒服' },
    { value: '✨', label: '元气满满' },
    { value: '🥳', label: '超开心' }
];

const MEMO_PLACEHOLDER = '点这里记一句话';

let _initialized = false;
let _unsubs = [];
let _currentPage = 1;


export function initHome() {
    if (_initialized) return;
    _initialized = true;

    ensureDailyData();

    renderDailyLove();
    renderDailyMemo();
    renderMood();
    renderCheckin();
    renderProfile();

    bindPager();
    bindCheckin();
    bindMusicPlayer();
    bindAvatarAndName();
    startClock();
    renderConnection();

    _unsubs.push(
        bus.on('music:state', onMusicState),
        bus.on('screen:change', ({ id }) => {
    if (id === 'screen-home') {
        renderConnection();
        updateClock();
    }
}),
        bus.on('period:update', onPeriodUpdate),
        bus.on('profile:update', renderProfile),
        bus.on('chat:new-message', refreshDateBoundData)
    );

    bus.emit('home:request-period-status');
}

export function destroyHome() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ---------- 每日数据 ---------- */

function ensureDailyData() {
    const today = formatDate();

    const love = get(KEYS.DAILY_LOVE);
    if (love.date !== today) {
        const text = randomPick(LOVE_QUOTES) || love.text || LOVE_QUOTES[0];
        set(KEYS.DAILY_LOVE, { text, date: today });
    }

    const memo = get(KEYS.DAILY_MEMO);
    if (memo.date !== today) {
        set(KEYS.DAILY_MEMO, { text: '', date: today });
    }

    const mood = get(KEYS.MOOD);
    if (mood.date !== today) {
        set(KEYS.MOOD, { value: '', label: '', date: today });
    }
}

export function refreshDateBoundData() {
    ensureDailyData();
    renderDailyLove();
    renderDailyMemo();
    renderMood();
    renderCheckin();
}


/* ---------- 渲染 ---------- */

function renderDailyLove() {
    const el = byId('daily-love-text');
    const data = get(KEYS.DAILY_LOVE);
    if (el) el.textContent = data.text || LOVE_QUOTES[0];
}

function renderDailyMemo() {
    // 首页第一页已改成"连接状态"，不再渲染备忘
    // 第二页的备忘仍需渲染
    const data = get(KEYS.DAILY_MEMO);
    const text = (data.text || '').trim();
    const isPlaceholder = !text;

    const el2 = byId('home-memo-text');
    if (el2) {
        el2.textContent = isPlaceholder ? MEMO_PLACEHOLDER : text;
        el2.classList.toggle('two-card-placeholder', isPlaceholder);
    }
}

function renderMood() {
    const el = byId('home-mood-text');
    if (!el) return;
    const data = get(KEYS.MOOD);
    if (data.value) {
        el.textContent = `${data.value} ${data.label || ''}`.trim();
        el.classList.remove('two-card-placeholder');
    } else {
        el.textContent = '点一下选心情';
        el.classList.add('two-card-placeholder');
    }
}

function renderCheckin() {
    const data = get(KEYS.CHECKIN);
    const today = formatDate();
    const btn = byId('btn-checkin');
    const sub = byId('checkin-days');

    if (sub) sub.textContent = `连续打卡 ${data.days || 0} 天`;

    if (btn) {
        const done = data.lastDate === today;
        btn.classList.toggle('done', done);
        btn.disabled = done;
        btn.textContent = done ? '已打卡' : '打卡';
    }
}

function renderProfile() {
    const profile = get(KEYS.PROFILE);

    const taLabel = byId('avatar-label-ta');
    if (taLabel) taLabel.textContent = profile.ta.name || 'TA';

    const meLabel = byId('avatar-label-me');
    if (meLabel) meLabel.textContent = profile.me.name || '我';

    applyAvatarImage('avatar-circle-ta', profile.ta.avatar);
    applyAvatarImage('avatar-circle-me', profile.me.avatar);

    const listName = byId('chat-list-name-ta');
    if (listName) listName.textContent = profile.ta.name || 'TA';

    const chatHeaderName = byId('chat-header-name');
    if (chatHeaderName) chatHeaderName.textContent = profile.ta.name || 'TA';

    const bgName = byId('moments-bg-name');
    if (bgName) bgName.textContent = profile.me.name || '我';
}

function applyAvatarImage(circleId, src) {
    const circle = byId(circleId);
    if (!circle) return;

    let img = circle.querySelector('img.mj-avatar-img');
    if (src) {
        if (!img) {
            img = document.createElement('img');
            img.className = 'mj-avatar-img';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            circle.appendChild(img);
        }
        img.src = src;
        const svg = circle.querySelector('svg');
        if (svg) svg.style.display = 'none';
    } else {
        if (img) img.remove();
        const svg = circle.querySelector('svg');
        if (svg) svg.style.display = '';
    }
}


/* ---------- 打卡 ---------- */

function bindCheckin() {
    const btn = byId('btn-checkin');
    if (!btn) return;
    btn.addEventListener('click', doCheckin);
}

function doCheckin() {
    const data = get(KEYS.CHECKIN);
    const today = formatDate();

    if (data.lastDate === today) {
        toast('今天已经打过卡啦～');
        return;
    }

    let days = 1;
    if (data.lastDate) {
        const last = new Date(data.lastDate);
        const now = new Date(today);
        const diff = Math.round((now - last) / 86400000);
        days = diff === 1 ? (data.days || 0) + 1 : 1;
    }

    const history = Array.isArray(data.history) ? data.history.slice() : [];
    if (!history.includes(today)) history.push(today);

    set(KEYS.CHECKIN, { days, lastDate: today, history });

    renderCheckin();
    toast(`打卡成功，已连续 ${days} 天 ♥`);
    bus.emit('checkin:done', { days, date: today });
}


/* ---------- 备忘（自定义弹窗） ---------- */

export async function openMemoEditor() {
    const data = get(KEYS.DAILY_MEMO);
    const current = data.text || '';

    const next = await mjTextarea('今日备忘', {
        placeholder: '记一句话给今天的自己…',
        defaultValue: current,
        confirmText: '保存'
    });

    if (next === null) return;

    set(KEYS.DAILY_MEMO, { text: String(next).trim(), date: formatDate() });
    renderDailyMemo();
    if (String(next).trim()) toast('已记录');
}


/* ---------- 心情（自定义弹窗） ---------- */

export async function openMoodPicker() {
    const lines = MOOD_OPTIONS.map((m, i) => `${i + 1}. ${m.value}  ${m.label}`).join('\n');

    const input = await mjPrompt('今天的心情', {
        placeholder: '输入序号或直接输入 emoji',
        defaultValue: '',
        confirmText: '确定'
    });

    if (input === null) return;
    const trimmed = String(input).trim();

    if (!trimmed) {
        saveMood('', '');
        return;
    }

    const idx = parseInt(trimmed, 10);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= MOOD_OPTIONS.length) {
        const m = MOOD_OPTIONS[idx - 1];
        saveMood(m.value, m.label);
        return;
    }

    const matched = MOOD_OPTIONS.find((m) => m.value === trimmed);
    if (matched) saveMood(matched.value, matched.label);
    else saveMood(trimmed, '');
}

export function saveMood(value, label) {
    set(KEYS.MOOD, { value: value || '', label: label || '', date: formatDate() });
    renderMood();
    if (value) toast(`今天的心情：${value} ${label}`.trim());
}


/* ---------- 翻页增强 ---------- */

function bindPager() {
    const pages = byId('home-pages');
    if (!pages) return;

    let ticking = false;
    pages.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
            const w = pages.clientWidth || 1;
            const idx = Math.round(pages.scrollLeft / w) + 1;
            if (idx !== _currentPage) {
                _currentPage = idx;
                pages.dataset.currentPage = String(idx);
                bus.emit('home:page-change', { page: idx });
                updatePagerDots(idx);
            }
            ticking = false;
        });
    }, { passive: true });

    enhanceSwipe(pages);
    addPagerDots(pages);
}

function enhanceSwipe(pages) {
    let startX = 0, startY = 0, isSwiping = false, isHorizontal = null;

    pages.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        isSwiping = true;
        isHorizontal = null;
    }, { passive: true });

    pages.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (isHorizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isHorizontal = Math.abs(dx) > Math.abs(dy);
        }

        if (isHorizontal) e.preventDefault();
    }, { passive: false });

    pages.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;

        if (isHorizontal === true) {
            const dx = e.changedTouches[0].clientX - startX;
            const w = pages.clientWidth;
            const currentPage = Math.round(pages.scrollLeft / w);
            let target = currentPage;

            if (dx < -40) target = Math.min(1, currentPage + 1);
            else if (dx > 40) target = Math.max(0, currentPage - 1);

            if (target !== currentPage) {
                pages.scrollTo({ left: target * w, behavior: 'smooth' });
            }
        }
    });
}

function addPagerDots(pages) {
    const screen = pages.closest('.screen-home');
    if (!screen) return;
    if (screen.querySelector('.home-pager-dots')) return;

    const dotsWrap = document.createElement('div');
    dotsWrap.className = 'home-pager-dots';
    dotsWrap.innerHTML = `
        <span class="home-pager-dot active" data-page="1"></span>
        <span class="home-pager-dot" data-page="2"></span>
    `;
    screen.appendChild(dotsWrap);

    dotsWrap.addEventListener('click', (e) => {
        const dot = e.target.closest('.home-pager-dot');
        if (!dot) return;
        const page = parseInt(dot.dataset.page, 10);
        const w = pages.clientWidth;
        pages.scrollTo({ left: (page - 1) * w, behavior: 'smooth' });
    });
}

function updatePagerDots(page) {
    document.querySelectorAll('.home-pager-dot').forEach((d) => {
        d.classList.toggle('active', parseInt(d.dataset.page, 10) === page);
    });
}


/* ---------- 音乐播放器 ---------- */

function bindMusicPlayer() {
    const playBtn = byId('btn-home-music-play');
    if (playBtn) playBtn.addEventListener('click', () => bus.emit('music:toggle'));

    const prevBtn = byId('btn-home-music-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => bus.emit('music:prev'));

    const nextBtn = byId('btn-home-music-next');
    if (nextBtn) nextBtn.addEventListener('click', () => bus.emit('music:next'));

    bus.emit('music:request-state');
}

function onMusicState(state) {
    if (!state) return;

    const titleEl = byId('home-music-title');
    const subEl = byId('home-music-sub');
    const progressEl = byId('home-music-progress');
    const curEl = byId('home-music-current-time');
    const totalEl = byId('home-music-total-time');
    const playBtn = byId('btn-home-music-play');

    if (titleEl) titleEl.textContent = state.title || '未在播放';
    if (subEl) subEl.textContent = state.sub || '选择一首歌开始';

    const cur = Number(state.current) || 0;
    const total = Number(state.total) || 0;
    const pct = total > 0 ? Math.min(100, (cur / total) * 100) : 0;

    if (progressEl) progressEl.style.width = `${pct}%`;
    if (curEl) curEl.textContent = formatDuration(cur);
    if (totalEl) totalEl.textContent = formatDuration(total);
    if (playBtn) playBtn.textContent = state.playing ? '⏸' : '▶';
}

function onPeriodUpdate(payload) {
    const el = byId('home-period-status');
    if (!el) return;
    el.textContent = (payload && payload.text) ? payload.text : '未记录';
}


/* ==========================================================================
   纪念日
   ========================================================================== */

function openAnniversaryModal() {
    renderAnniversaryList();
    openModal('modal-anniversary');
}

function ensureAnniversaryDefaults() {
    const data = get(KEYS.ANNIVERSARY);
    if (!Array.isArray(data.items)) data.items = [];

    if (data.items.length === 0) {
        const meta = get(KEYS.META);
        const firstOpenAt = meta.firstOpenAt || Date.now();
        const d = new Date(firstOpenAt);
        const pad = (n) => String(n).padStart(2, '0');
        const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        data.items.push({
            id: uid('ann'),
            name: '和 TA 在一起',
            date: ymd,
            isDefault: true
        });
        set(KEYS.ANNIVERSARY, data);
    }
    return data;
}

function renderAnniversaryList() {
    const data = ensureAnniversaryDefaults();
    const listEl = byId('anniversary-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    data.items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'anniversary-card';
        card.dataset.annId = item.id;

        const title = document.createElement('div');
        title.className = 'anniversary-card-title';
        title.textContent = item.name || '纪念日';
        card.appendChild(title);

        const daysWrap = document.createElement('div');
        daysWrap.className = 'anniversary-card-days';
        const num = document.createElement('span');
        num.className = 'anniversary-card-num';
        num.textContent = calcAnniversaryDaysNum(item.date);
        daysWrap.appendChild(num);
        const unit = document.createElement('span');
        unit.className = 'anniversary-card-unit';
        unit.textContent = '天';
        daysWrap.appendChild(unit);
        card.appendChild(daysWrap);

        card.addEventListener('click', () => openAnniversaryOptions(item));

        listEl.appendChild(card);
    });
}

function calcAnniversaryDaysNum(dateStr) {
    if (!dateStr) return '0';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '0';
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d) / 86400000);
    return String(Math.abs(diff));
}

async function openAnniversaryOptions(item) {
    const choice = await mjPrompt('输入序号操作：\n1. 修改名称\n2. 修改日期\n3. 删除', {
        title: item.name || '纪念日',
        defaultValue: '1',
        confirmText: '执行'
    });
    if (choice === null) return;

    const n = parseInt(String(choice).trim(), 10);
    if (n === 1) {
        const name = await mjPrompt('新的名称：', { defaultValue: item.name, confirmText: '保存' });
        if (name === null) return;
        const trimmed = name.trim();
        if (!trimmed) return;
        updateAnniversaryItem(item.id, { name: trimmed });
    } else if (n === 2) {
        const date = await mjPrompt('新的日期（2024-05-20）：', { defaultValue: item.date, confirmText: '保存' });
        if (date === null) return;
        const trimmed = date.trim();
        if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
            toast('日期格式不正确');
            return;
        }
        updateAnniversaryItem(item.id, { date: trimmed });
    } else if (n === 3) {
        const ok = await mjConfirm('删除这个纪念日？', { title: '删除' });
        if (!ok) return;
        deleteAnniversary(item.id);
    }
}

function updateAnniversaryItem(id, patch) {
    const data = ensureAnniversaryDefaults();
    const item = data.items.find((x) => x.id === id);
    if (!item) return;
    Object.assign(item, patch);
    set(KEYS.ANNIVERSARY, data);
    renderAnniversaryList();
    toast('已保存');
}

async function addAnniversary() {
    const name = await mjPrompt('纪念日名称（如：在一起、生日）：', {
        title: '添加纪念日',
        confirmText: '下一步'
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const date = await mjPrompt('日期（格式：2024-05-20）：', {
        title: '添加纪念日',
        confirmText: '保存'
    });
    if (date === null) return;
    const dateTrimmed = date.trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateTrimmed)) {
        toast('日期格式不正确');
        return;
    }

    const data = ensureAnniversaryDefaults();
    data.items.push({
        id: uid('ann'),
        name: trimmed,
        date: dateTrimmed,
        isYearly: true
    });
    set(KEYS.ANNIVERSARY, data);
    renderAnniversaryList();
    toast('已添加');
}

function deleteAnniversary(id) {
    const data = ensureAnniversaryDefaults();
    data.items = data.items.filter((x) => x.id !== id);
    set(KEYS.ANNIVERSARY, data);
    renderAnniversaryList();
    toast('已删除');
}

function calcAnniversaryDays(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - d) / 86400000);
    if (diff === 0) return '今天';
    if (diff > 0) return `${diff} 天`;
    return `还有 ${-diff} 天`;
}

function deleteAnniversary(id) {
    const data = get(KEYS.ANNIVERSARY);
    data.items = (data.items || []).filter((x) => x.id !== id);
    set(KEYS.ANNIVERSARY, data);
    renderAnniversaryList();
    toast('已删除');
}


/* ==========================================================================
   供 app.js 注册
   ========================================================================== */

/* ==========================================================================
   实时时间
   ========================================================================== */

let _clockTimer = null;

function startClock() {
    updateClock();
    if (_clockTimer) clearInterval(_clockTimer);
    _clockTimer = setInterval(updateClock, 30 * 1000);
}

function updateClock() {
    const el = byId('avatar-time');
    if (!el) return;
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


/* ==========================================================================
   连接状态（1~6 颗心，每次进入页面随机）
   ========================================================================== */

function renderConnection() {
    const el = byId('connection-hearts');
    if (!el) return;

    const count = randomInt(1, 6);
    el.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const s = document.createElement('span');
        s.className = 'conn-heart' + (i < count ? ' active' : '');
        s.textContent = '♥';
        el.appendChild(s);
    }
}


/* ==========================================================================
   头像 / 昵称点击 → 编辑弹窗
   ========================================================================== */

function bindAvatarAndName() {
    const avatarEl = byId('avatar-me');
    const nameEl = byId('avatar-label-me');
    if (avatarEl) avatarEl.addEventListener('click', openMyProfileEditor);
    if (nameEl) nameEl.addEventListener('click', openMyProfileEditor);
}

function openMyProfileEditor() {
    const profile = get(KEYS.PROFILE);
    let tempAvatar = profile.me.avatar || '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 340px;">
            <div class="modal-header">
                <h2 class="modal-title">我的资料</h2>
                <button class="modal-close" data-role="close" aria-label="关闭">✕</button>
            </div>

            <div class="ta-profile-row">
                <div class="ta-profile-avatar" id="my-editor-avatar"></div>
                <input type="text" class="form-input ta-profile-name"
                    id="my-editor-name"
                    placeholder="输入昵称"
                    value="${escapeHtml(profile.me.name || '我')}"
                    maxlength="20"
                    aria-label="我的昵称">
            </div>

            <button class="upload-btn" id="btn-my-editor-upload" type="button">📁 上传头像</button>

            <div class="modal-actions">
                <button class="modal-btn secondary" data-role="close">取消</button>
                <button class="modal-btn primary" data-role="save">保存</button>
            </div>
        </div>
    `;

    const avatarEl = overlay.querySelector('#my-editor-avatar');
    const renderAvatar = () => {
        if (tempAvatar) {
            avatarEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = tempAvatar;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            avatarEl.appendChild(img);
        } else {
            avatarEl.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            `;
        }
    };
    renderAvatar();

    overlay.querySelector('#btn-my-editor-upload').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                tempAvatar = reader.result;
                renderAvatar();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-role="close"]')) close();
    });

    overlay.querySelector('[data-role="save"]').addEventListener('click', () => {
        const nameInput = overlay.querySelector('#my-editor-name');
        const newName = (nameInput.value || '').trim() || '我';

        const data = get(KEYS.PROFILE);
        data.me.name = newName;
        data.me.avatar = tempAvatar;
        set(KEYS.PROFILE, data);

        bus.emit('profile:update');

        // 立即刷新首页
        renderProfile();

        close();
        toast('资料已更新');
    });

    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.querySelector('#my-editor-name')?.focus();
    }, 120);
}

export const homeActions = {
    'checkin':            () => doCheckin(),
    'edit-daily-memo':    () => openMemoEditor(),
    'edit-mood':          () => openMoodPicker(),
    'simulate-incoming-call': () => bus.emit('call:simulate-incoming'),

    'open-anniversary': () => openAnniversaryModal(),
    'add-anniversary':  () => addAnniversary()
};


/* ==========================================================================
   对外导出
   ========================================================================== */

export default {
    initHome,
    destroyHome,
    refreshDateBoundData,
    renderDailyLove,
    renderDailyMemo,
    renderMood,
    renderCheckin,
    renderProfile,
    openMemoEditor,
    openMoodPicker,
    saveMood
};
