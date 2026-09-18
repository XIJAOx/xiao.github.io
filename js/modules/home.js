/* ==========================================================================
   梦角 · Dream Corner
   首页模块  js/modules/home.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     第一页：#home-page-1
       - .avatar-section（TA / 我 的头像）
       - #card-love（今日情话，只读）
       - #card-memo（今日备忘，可编辑）
       - #checkin-card（打卡）
       - #grid-menu-1（8 个功能入口）
     第二页：#home-page-2
       - #home-music-player（音乐播放器卡片）
       - #grid-menu-2（6 个工具入口）
       - #period-card-home（经期状态）
       - #two-cards（今日备忘 / 今天的心情）
     公共：
       - #home-pages（横向翻页）
       - #btn-simulate-incoming（模拟来电）
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


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 情话池，每天从里面随机一句 */
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

/** 心情 emoji 池，用于点击心情卡时选择 */
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

/** 备忘 placeholder */
const MEMO_PLACEHOLDER = '点这里记一句话';


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];     // bus 退订集合
let _currentPage = 1; // 首页当前页


/* ==========================================================================
   03. 入口：initHome
   ========================================================================== */

/**
 * 初始化首页
 * 由 app.js 在 DOMContentLoaded 后调用一次
 */
export function initHome() {
    if (_initialized) return;
    _initialized = true;

    // 数据：确保首日数据就绪
    ensureDailyData();

    // 渲染
    renderDailyLove();
    renderDailyMemo();
    renderMood();
    renderCheckin();
    renderProfile();

    // 交互
    bindPager();
    bindCheckin();
    bindMemo();
    bindMood();
    bindDevBtn();
    bindMusicPlayer();

    // 订阅跨模块事件
    _unsubs.push(
        bus.on('music:state', onMusicState),
        bus.on('period:update', onPeriodUpdate),
        bus.on('profile:update', renderProfile),
        bus.on('chat:new-message', refreshDateBoundData)
    );

    // 首次拉取经期状态（若 period 模块已初始化，会主动 emit）
    bus.emit('home:request-period-status');
}

/**
 * 销毁（一般用不到，供调试）
 */
export function destroyHome() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据准备：按日期刷新
   --------------------------------------------------------------------------
   今日情话 / 今日备忘 / 今日心情：以「YYYY-MM-DD」为界，跨天自动重置
   ========================================================================== */

/**
 * 检查并刷新跟"今天"绑定的数据
 */
function ensureDailyData() {
    const today = formatDate();

    // 情话
    const love = get(KEYS.DAILY_LOVE);
    if (love.date !== today) {
        const text = randomPick(LOVE_QUOTES) || love.text || LOVE_QUOTES[0];
        set(KEYS.DAILY_LOVE, { text, date: today });
    }

    // 备忘
    const memo = get(KEYS.DAILY_MEMO);
    if (memo.date !== today) {
        // 保留昨天的文本到历史里？这里简单做：直接清空
        set(KEYS.DAILY_MEMO, { text: '', date: today });
    }

    // 心情
    const mood = get(KEYS.MOOD);
    if (mood.date !== today) {
        set(KEYS.MOOD, { value: '', label: '', date: today });
    }
}

/**
 * 供外部调用：跨天时刷新首页跟日期相关的部分
 * （由 bus 'chat:new-message' 等低频场景触发）
 */
export function refreshDateBoundData() {
    ensureDailyData();
    renderDailyLove();
    renderDailyMemo();
    renderMood();
    renderCheckin();
}


/* ==========================================================================
   05. 渲染：今日情话
   ========================================================================== */

function renderDailyLove() {
    const el = byId('daily-love-text');
    const data = get(KEYS.DAILY_LOVE);
    if (el) el.textContent = data.text || LOVE_QUOTES[0];
}


/* ==========================================================================
   06. 渲染：今日备忘（首页两处同步）
   ========================================================================== */

function renderDailyMemo() {
    const data = get(KEYS.DAILY_MEMO);
    const text = (data.text || '').trim();
    const isPlaceholder = !text;

    // 第一页的卡片
    const el1 = byId('daily-memo-text');
    if (el1) {
        el1.textContent = isPlaceholder ? MEMO_PLACEHOLDER : text;
        el1.classList.toggle('card-placeholder', isPlaceholder);
    }

    // 第二页的双卡片
    const el2 = byId('home-memo-text');
    if (el2) {
        el2.textContent = isPlaceholder ? MEMO_PLACEHOLDER : text;
        el2.classList.toggle('two-card-placeholder', isPlaceholder);
    }
}


/* ==========================================================================
   07. 渲染：今天的心情
   ========================================================================== */

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


/* ==========================================================================
   08. 渲染：打卡
   --------------------------------------------------------------------------
   规则：
     - 从未打卡     → 打卡后 days = 1
     - 昨天打过卡   → 打卡后 days + 1
     - 今天已打卡   → 按钮变灰
     - 断签超过一天 → 重置为 1
   ========================================================================== */

function renderCheckin() {
    const data = get(KEYS.CHECKIN);
    const today = formatDate();
    const btn = byId('btn-checkin');
    const sub = byId('checkin-days');

    if (sub) {
        sub.textContent = `连续打卡 ${data.days || 0} 天`;
    }

    if (btn) {
        const done = data.lastDate === today;
        btn.classList.toggle('done', done);
        btn.disabled = done;
        btn.textContent = done ? '已打卡' : '打卡';
    }
}

/**
 * 执行打卡
 */
function doCheckin() {
    const data = get(KEYS.CHECKIN);
    const today = formatDate();

    if (data.lastDate === today) {
        toast('今天已经打过卡啦～');
        return;
    }

    // 计算与上次打卡的天数差
    let days = 1;
    if (data.lastDate) {
        const last = new Date(data.lastDate);
        const now = new Date(today);
        const diff = Math.round((now - last) / 86400000);
        days = diff === 1 ? (data.days || 0) + 1 : 1;
    }

    const history = Array.isArray(data.history) ? data.history.slice() : [];
    if (!history.includes(today)) history.push(today);

    set(KEYS.CHECKIN, {
        days,
        lastDate: today,
        history
    });

    renderCheckin();
    toast(`打卡成功，已连续 ${days} 天 ♥`);
    bus.emit('checkin:done', { days, date: today });
}


/* ==========================================================================
   09. 渲染：头像与名字（TA / 我）
   ========================================================================== */

function renderProfile() {
    const profile = get(KEYS.PROFILE);

    // TA
    const taLabel = byId('avatar-label-ta');
    if (taLabel) taLabel.textContent = profile.ta.name || 'TA';

    // 我
    const meLabel = byId('avatar-label-me');
    if (meLabel) meLabel.textContent = profile.me.name || '我';

    // 头像图（若 storage 里存了 URL / dataURL）
    applyAvatarImage('avatar-circle-ta', profile.ta.avatar);
    applyAvatarImage('avatar-circle-me', profile.me.avatar);

    // 同步聊天列表里的名字
    const listName = byId('chat-list-name-ta');
    if (listName) listName.textContent = profile.ta.name || 'TA';

    // 同步聊天页头部
    const chatHeaderName = byId('chat-header-name');
    if (chatHeaderName) chatHeaderName.textContent = profile.ta.name || 'TA';

    // 同步朋友圈底部署名
    const bgName = byId('moments-bg-name');
    if (bgName) bgName.textContent = profile.me.name || '我';
}

/**
 * 若 avatar 数据是图片，替换头像圆内的 svg
 * @param {string} circleId
 * @param {string} src
 */
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


/* ==========================================================================
   10. 交互：翻页
   --------------------------------------------------------------------------
   HTML：.home-pages 是水平滚动容器，宽度 = 100% * 页数
   CSS：  scroll-snap-type: x mandatory
   JS：   监听 scroll 同步 data-current-page（可选，用于未来加指示点）
   ========================================================================== */

function bindPager() {
    const pages = byId('home-pages');
    if (!pages) return;

    // 1. 滚动同步页码
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

    // 2. 增强触摸滑动
    enhanceSwipe(pages);

    // 3. 添加翻页指示点
    addPagerDots(pages);
}

/**
 * 增强触摸滑动：解决 scroll-snap 在移动端不灵敏的问题
 */
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

        // 判断方向（一但确定是横向滑动，就拦截默认行为，避免被内部纵向滚动抢走）
        if (isHorizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            isHorizontal = Math.abs(dx) > Math.abs(dy);
        }

        if (isHorizontal) {
            e.preventDefault();
        }
    }, { passive: false });

    pages.addEventListener('touchend', (e) => {
        if (!isSwiping) return;
        isSwiping = false;

        if (isHorizontal === true) {
            const dx = e.changedTouches[0].clientX - startX;
            const w = pages.clientWidth;
            const currentPage = Math.round(pages.scrollLeft / w);
            let target = currentPage;

            // 横向位移超过 40px 才翻页，避免误触
            if (dx < -40) target = Math.min(1, currentPage + 1);
            else if (dx > 40) target = Math.max(0, currentPage - 1);

            if (target !== currentPage) {
                pages.scrollTo({ left: target * w, behavior: 'smooth' });
            }
        }
    });
}

/**
 * 在底部加两个小圆点（指示 + 可点击翻页）
 */
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
/* ==========================================================================
   11. 交互：打卡
   ========================================================================== */

function bindCheckin() {
    const btn = byId('btn-checkin');
    if (!btn) return;
    btn.addEventListener('click', doCheckin);
}


/* ==========================================================================
   12. 交互：备忘（首页两处）
   --------------------------------------------------------------------------
   HTML 里两个备忘都带 data-action="edit-daily-memo"
     #daily-memo-text   （第一页）
     #two-card-memo     （第二页）
   所以在 app.js 里注册 edit-daily-memo → openMemoEditor() 即可。
   这里只实现方法。
   ========================================================================== */

/**
 * 打开备忘编辑弹窗
 * 用系统 prompt 保持轻量；若后续想改造成自定义弹窗，只需替换本函数
 */
export function openMemoEditor() {
    const data = get(KEYS.DAILY_MEMO);
    const current = data.text || '';
    const next = window.prompt('记一句话给今天的自己：', current);

    if (next === null) return; // 用户取消
    saveMemo(next.trim());
}

/**
 * 保存备忘
 * @param {string} text
 */
export function saveMemo(text) {
    const today = formatDate();
    set(KEYS.DAILY_MEMO, { text: text || '', date: today });
    renderDailyMemo();
    if (text) toast('已记录');
}


/* ==========================================================================
   13. 交互：心情
   ========================================================================== */

function bindMood() {
    // 点第二页的心情卡 → 弹出选择面板
    // HTML 里 data-action="edit-mood"，由 app.js 调 openMoodPicker()
    // 这里实现选择面板（用原生 dialog 风格，简单可用）
}

/**
 * 打开心情选择
 */
export function openMoodPicker() {
    // 简单实现：用 prompt 展示列表
    // 更优雅的做法是弹一个 .modal-overlay，但为了不新增 HTML，
    // 这里用轻量方式：循环提示选择，用户也可以直接输入
    const lines = MOOD_OPTIONS.map((m, i) => `${i + 1}. ${m.value} ${m.label}`).join('\n');
    const input = window.prompt(`今天心情怎么样？\n\n${lines}\n\n输入序号或直接输入 emoji：`, '');

    if (input === null) return;

    const trimmed = String(input).trim();
    if (!trimmed) {
        saveMood('', '');
        return;
    }

    // 尝试匹配序号
    const idx = parseInt(trimmed, 10);
    if (!Number.isNaN(idx) && idx >= 1 && idx <= MOOD_OPTIONS.length) {
        const m = MOOD_OPTIONS[idx - 1];
        saveMood(m.value, m.label);
        return;
    }

    // 尝试匹配 emoji
    const matched = MOOD_OPTIONS.find((m) => m.value === trimmed);
    if (matched) {
        saveMood(matched.value, matched.label);
    } else {
        saveMood(trimmed, ''); // 用户自定义
    }
}

/**
 * 保存心情
 * @param {string} value  emoji
 * @param {string} label
 */
export function saveMood(value, label) {
    set(KEYS.MOOD, { value: value || '', label: label || '', date: formatDate() });
    renderMood();
    if (value) toast(`今天的心情：${value} ${label}`.trim());
}


/* ==========================================================================
   14. 交互：模拟来电（dev 按钮）
   ========================================================================== */

function bindDevBtn() {
    const btn = byId('btn-simulate-incoming');
    if (!btn) return;
    btn.addEventListener('click', () => {
        bus.emit('call:simulate-incoming');
    });
}


/* ==========================================================================
   15. 首页音乐播放器
   --------------------------------------------------------------------------
   订阅 bus 'music:state'：
     { title, sub, current, total, playing, progress }
   由 music.js 广播
   ========================================================================== */

function bindMusicPlayer() {
    const playBtn = byId('btn-home-music-play');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            bus.emit('music:toggle');
        });
    }

    const prevBtn = byId('btn-home-music-prev');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => bus.emit('music:prev'));
    }

    const nextBtn = byId('btn-home-music-next');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => bus.emit('music:next'));
    }

    // 首次同步
    bus.emit('music:request-state');
}

/**
 * 收到播放器状态，更新首页卡片
 * @param {Object} state
 */
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


/* ==========================================================================
   16. 经期状态（首页卡片）
   --------------------------------------------------------------------------
   订阅 bus 'period:update'：
     { text, sub }
   由 period.js 广播
   ========================================================================== */

function onPeriodUpdate(payload) {
    const el = byId('home-period-status');
    if (!el) return;

    if (payload && payload.text) {
        el.textContent = payload.text;
    } else {
        el.textContent = '未记录';
    }
}


/* ==========================================================================
   17. 供 app.js 注册的 action / nav 集合
   --------------------------------------------------------------------------
   在 app.js 里这样用：
     import { homeActions } from './modules/home.js';
     bindEvents({ actions: { ...homeActions, ...otherActions }, navs: { ... } });
   ========================================================================== */

export const homeActions = {
    'checkin':            () => doCheckin(),
    'edit-daily-memo':    () => openMemoEditor(),
    'edit-mood':          () => openMoodPicker(),
    'simulate-incoming-call': () => bus.emit('call:simulate-incoming')
};


/* ==========================================================================
   18. 对外导出
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
    saveMemo,
    openMoodPicker,
    saveMood
};
