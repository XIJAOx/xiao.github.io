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
    randomPick, uid
} from '../utils/dom.js';

import {
    KEYS, get, set, update, ensure, has
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';

import {
    mjPrompt, mjConfirm, mjAlert, mjTextarea
} from '../utils/dialogs.js';


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
    const data = get(KEYS.DAILY_MEMO);
    const text = (data.text || '').trim();
    const isPlaceholder = !text;

    const el1 = byId('daily-memo-text');
    if (el1) {
        el1.textContent = isPlaceholder ? MEMO_PLACEHOLDER : text;
        el1.classList.toggle('card-placeholder', isPlaceholder);
    }

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

function renderAnniversaryList() {
    const data = get(KEYS.ANNIVERSARY);
    const items = Array.isArray(data.items) ? data.items : [];
    const listEl = byId('anniversary-list');
    const emptyEl = byId('anniversary-empty');
    if (!listEl) return;

    if (!items.length) {
        listEl.hidden = true;
        listEl.innerHTML = '';
        if (emptyEl) emptyEl.hidden = false;
        return;
    }

    if (emptyEl) emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = '';

    items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'anniversary-item';

        const info = document.createElement('div');

        const name = document.createElement('div');
        name.className = 'anniversary-name';
        name.textContent = item.name || '纪念日';

        const date = document.createElement('div');
        date.className = 'anniversary-date';
        date.textContent = item.date || '';

        info.appendChild(name);
        info.appendChild(date);

        const daysEl = document.createElement('div');
        daysEl.className = 'anniversary-days';
        daysEl.textContent = calcAnniversaryDays(item.date);

        row.appendChild(info);
        row.appendChild(daysEl);

        row.addEventListener('click', async () => {
            const ok = await mjConfirm(`删除「${item.name}」？`, {
                title: '删除纪念日'
            });
            if (ok) deleteAnniversary(item.id);
        });

        listEl.appendChild(row);
    });
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

async function addAnniversary() {
    const name = await mjPrompt('添加纪念日', {
        placeholder: '如：在一起、生日',
        confirmText: '下一步'
    });
    if (name === null) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;

    const date = await mjPrompt('日期', {
        placeholder: '格式：2024-05-20',
        confirmText: '保存'
    });
    if (date === null) return;
    const dateTrimmed = String(date).trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateTrimmed)) {
        toast('日期格式不正确');
        return;
    }

    const data = get(KEYS.ANNIVERSARY);
    if (!Array.isArray(data.items)) data.items = [];
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
    const data = get(KEYS.ANNIVERSARY);
    data.items = (data.items || []).filter((x) => x.id !== id);
    set(KEYS.ANNIVERSARY, data);
    renderAnniversaryList();
    toast('已删除');
}


/* ==========================================================================
   供 app.js 注册
   ========================================================================== */

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
