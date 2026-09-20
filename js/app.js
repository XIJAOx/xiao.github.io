/* ==========================================================================
   梦角 · Dream Corner
   应用入口  js/app.js
   --------------------------------------------------------------------------
   职责：
   1. 引入所有工具模块与业务模块
   2. 合并各模块导出的 actions / navs，交给 event.js 统一分发
   3. 包装导航，自动广播 'screen:change' 事件（供各模块感知屏幕切换）
   4. 处理返回键 / Esc / 遮罩点击 等全局交互
   5. 按正确顺序初始化各模块
   6. 全局错误兜底
   ========================================================================== */

/* --------------------------------------------------------------------------
   01. 工具层
   -------------------------------------------------------------------------- */
import {
    $, $$, byId,
    showScreen, getCurrentScreenId,
    openModal, closeModal, closeAllModals,
    toast,
    initModalBaseBehavior,
    resetLoading,
    formatDate
} from './utils/dom.js';

import {
    KEYS, get, set,
    initStorage
} from './utils/storage.js';

import {
    bindEvents,
    registerActions,
    registerNavs,
    bus
} from './utils/event.js';


/* --------------------------------------------------------------------------
   02. 业务模块
   -------------------------------------------------------------------------- */
import homeModule,        { initHome,             homeActions }        from './modules/home.js';
import chatModule,        { initChat,             chatActions,  chatNavs } from './modules/chat.js';
import lettersModule,     { initLetters,          lettersActions, lettersNavs } from './modules/letters.js';
import momentsModule,     { initMoments,          momentsActions, momentsNavs } from './modules/moments.js';
import periodModule,      { initPeriod,           periodActions, periodNavs } from './modules/period.js';
import messageStatsModule,{ initMessageStats,     messageStatsActions, messageStatsNavs } from './modules/message-stats.js';
import divineModule,      { initDivine,           divineActions, divineNavs } from './modules/divine.js';
import favoritesModule,   { initFavorites,        favoritesActions, favoritesNavs } from './modules/favorites.js';
import musicModule,       { initMusic,            musicActions, musicNavs } from './modules/music.js';
import questionsModule,   { initQuestions,        questionsActions, questionsNavs } from './modules/questions.js';
import waterModule,       { initWater,            waterActions, waterNavs } from './modules/water.js';
import shopModule, { initShop, shopActions, shopNavs } from './modules/shop.js';
import settingsModule,    { initSettings,         applyTheme, settingsActions } from './modules/settings.js';
import callModule,        { initCall,             callActions }         from './modules/call.js';


/* ==========================================================================
   03. 合并 actions / navs
   --------------------------------------------------------------------------
   所有模块的 action 集中管理，交给 event.js 一次性注册
   ========================================================================== */

const ALL_ACTIONS = {
    /* ---------- 首页 ---------- */
    ...homeActions,

    /* ---------- 聊天 ---------- */
    ...chatActions,

    /* ---------- 信件 ---------- */
    ...lettersActions,

    /* ---------- 朋友圈 ---------- */
    ...momentsActions,

    /* ---------- 经期 ---------- */
    ...periodActions,

    /* ---------- 消息统计 ---------- */
    ...messageStatsActions,

    /* ---------- 占卜 ---------- */
    ...divineActions,

    /* ---------- 收藏 ---------- */
    ...favoritesActions,

    /* ---------- 音乐 ---------- */
    ...musicActions,

    /* ---------- 提问 ---------- */
    ...questionsActions,

    /* ---------- 喝水 ---------- */
    ...waterActions,

    /* ---------- 设置 ---------- */
    ...settingsActions,

    /* ---------- 通话 ---------- */
    ...callActions
};


/* ==========================================================================
   04. 包装所有 nav
   --------------------------------------------------------------------------
   各模块的 nav 处理器内部会调用 showScreen()。
   这里统一包一层：nav 执行完后，自动广播 'screen:change'
   让关心屏幕切换的模块（chat.js / moments.js / period.js）收到通知。
   ========================================================================== */

/**
 * 给 nav 处理器加一层包装
 * @param {Function} fn
 * @returns {Function}
 */
function wrapNav(fn) {
    return (el, event) => {
        if (typeof fn === 'function') {
            try {
                fn(el, event);
            } catch (err) {
                console.error('[app] nav 处理器出错：', err);
            }
        }
        // 广播屏幕变化
        broadcastScreenChange();
    };
}

/**
 * 广播当前屏幕
 */
function broadcastScreenChange() {
    const active = document.querySelector('.screen.active');
    if (active) {
        bus.emit('screen:change', {
            id: active.id,
            name: active.dataset.screen || ''
        });
    }
}

/**
 * 合并所有 nav
 */
const RAW_NAVS = {
    /* ---------- 通用 ---------- */
    'home': () => showScreen('screen-home'),
    'settings': () => showScreen('screen-settings'),

    /* ---------- 聊天 ---------- */
    ...chatNavs,

    /* ---------- 信件 ---------- */
    ...lettersNavs,

    /* ---------- 朋友圈 ---------- */
    ...momentsNavs,

    /* ---------- 经期 ---------- */
    ...periodNavs,

    /* ---------- 消息统计 ---------- */
    ...messageStatsNavs,

    /* ---------- 占卜 ---------- */
    ...divineNavs,

    /* ---------- 收藏 ---------- */
    ...favoritesNavs,

    /* ---------- 音乐 ---------- */
    ...musicNavs,

    /* ---------- 提问 ---------- */
    ...questionsNavs,

    /* ---------- 喝水 ---------- */
    ...waterNavs
};

const ALL_NAVS = {};
Object.entries(RAW_NAVS).forEach(([key, fn]) => {
    ALL_NAVS[key] = wrapNav(fn);
});


/* ==========================================================================
   05. 全局交互
   ========================================================================== */

/**
 * 拦截浏览器返回键（安卓物理返回 / 浏览器返回）
 * 优先级：弹窗 > 非首页屏幕 > 允许退出
 */
function handlePopState() {
    // 有弹窗 → 先关弹窗
    const openedModal = document.querySelector('.modal-overlay.active');
    if (openedModal) {
        closeModal(openedModal.id);
        pushHistoryGuard();
        return;
    }

    // 有通话/来电 → 挂断
    const callOverlay = byId('call-modal-overlay');
    const incomingOverlay = byId('incoming-overlay');
    if ((callOverlay && !callOverlay.hidden) || (incomingOverlay && !incomingOverlay.hidden)) {
        bus.emit('call:hang-up');
        pushHistoryGuard();
        return;
    }

    // 当前不在首页 → 回到首页
    const currentId = getCurrentScreenId();
    if (currentId !== 'screen-home') {
        showScreen('screen-home');
        broadcastScreenChange();
        pushHistoryGuard();
        return;
    }

    // 已经在首页 → 允许退出
    // 什么都不做，交给浏览器
}

/**
 * 每次处理完 popstate，重新压一条记录，保证能继续拦返回
 */
function pushHistoryGuard() {
    try {
        history.pushState({ mj: true }, '');
    } catch (e) { /* ignore */ }
}

/**
 * 绑定全局键盘快捷键
 */
function bindGlobalKeys() {
    document.addEventListener('keydown', (e) => {
        // Esc：关最上层弹窗 / 退出当前页
        if (e.key === 'Escape') {
            const openedModal = document.querySelector('.modal-overlay.active');
            if (openedModal) {
                closeModal(openedModal.id);
                return;
            }
            // 不在首页 → 回首页
            if (getCurrentScreenId() !== 'screen-home') {
                showScreen('screen-home');
                broadcastScreenChange();
            }
        }
    });
}


/* ==========================================================================
   06. 主题初始化
   --------------------------------------------------------------------------
   在初始化其它模块之前先把主题应用上，避免闪烁
   ========================================================================== */

function initTheme() {
    const saved = get(KEYS.THEME);
    const theme = saved || 'system';
    applyTheme(theme);
}


/* ==========================================================================
   07. 启动顺序
   --------------------------------------------------------------------------
   依赖关系：
     - 主题最先（避免闪烁）
     - settings 需要在其它模块之前（很多模块读它的默认值）
     - period 早于 home（home 会 emit 'home:request-period-status'）
     - chat 早于 water / call（都通过 bus 与 chat 通信）
     - 其余顺序无所谓
   ========================================================================== */

const BOOT_ORDER = [
    { name: 'initSettings',   fn: initSettings },
    { name: 'initPeriod',     fn: initPeriod },
    { name: 'initChat',       fn: initChat },
    { name: 'initHome',       fn: initHome },
    { name: 'initLetters',    fn: initLetters },
    { name: 'initMoments',    fn: initMoments },
    { name: 'initMessageStats', fn: initMessageStats },
    { name: 'initDivine',     fn: initDivine },
    { name: 'initFavorites',  fn: initFavorites },
    { name: 'initMusic',      fn: initMusic },
    { name: 'initQuestions',  fn: initQuestions },
    { name: 'initWater',      fn: initWater },
    { name: 'initCall',       fn: initCall }
];

/**
 * 逐个安全初始化
 */
function bootModules() {
    BOOT_ORDER.forEach(({ name, fn }) => {
        try {
            fn();
        } catch (err) {
            console.error(`[app] ${name} 初始化失败：`, err);
        }
    });
}


/* ==========================================================================
   08. 跨模块 bus 桥接
   --------------------------------------------------------------------------
   把一些 bus 事件转成实际动作
   ========================================================================== */

function bindCrossModuleBridge() {
    /* ---------- 喝水 / 通话 通过 bus 追加聊天消息 ---------- */
    // chat.js 已订阅 'chat:system-message' 和 'chat:ta-message'，
    // 这里只做兜底（如果某天 chat 忘了订阅，至少不会静默失败）

    /* ---------- 导航事件（bus.emit('nav:chat')） ---------- */
    bus.on('nav:chat', () => {
        showScreen('screen-chat');
        broadcastScreenChange();
    });
    bus.on('nav:home', () => {
        showScreen('screen-home');
        broadcastScreenChange();
    });

    /* ---------- 通话挂断 ---------- */
    bus.on('call:hang-up', () => {
        if (typeof callModule.hangUp === 'function') callModule.hangUp();
    });

    /* ---------- 主题变化 → 更新 meta 主题色（可选） ---------- */
    bus.on('theme:change', (mode) => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const color = mode === 'dark' ? '#101014' : '#ff6b8a';
            meta.setAttribute('content', color);
        }
    });
}


/* ==========================================================================
   09. 首次打开初始化
   ========================================================================== */

function initStorageMeta() {
    try {
        initStorage({ fillDefaults: false });
    } catch (e) {
        console.warn('[app] storage 初始化失败：', e);
    }
}


/* ==========================================================================
   10. DOM 就绪后启动
   ========================================================================== */

function bootstrap() {
    // 1. 存储元信息
    initStorageMeta();

    // 2. 主题
    initTheme();

    // 3. 全局弹窗基础行为（点遮罩关闭 / Esc 关闭）
    initModalBaseBehavior();

    // 4. 事件系统：一次性注册所有 action / nav
    bindEvents({
        actions: ALL_ACTIONS,
        navs:    ALL_NAVS
    });

    // 5. 初始化各业务模块
    bootModules();

    // 6. 跨模块桥接
    bindCrossModuleBridge();

    // 7. 全局交互
    bindGlobalKeys();

    // 8. 浏览器返回键拦截
    try {
        history.pushState({ mj: true }, '');
        window.addEventListener('popstate', handlePopState);
    } catch (e) { /* ignore */ }

    // 9. 首次广播 screen:change，让模块知道当前在哪一屏
    setTimeout(broadcastScreenChange, 0);

    // 10. 兜底：隐藏 loading
    resetLoading();

    // 11. 记录首次/最近打开时间
    try {
        const meta = get(KEYS.META);
        meta.lastOpenAt = Date.now();
        if (!meta.firstOpenAt) meta.firstOpenAt = Date.now();
        set(KEYS.META, meta);
    } catch (e) { /* ignore */ }

    // 12. 全局错误兜底
    window.addEventListener('error', (e) => {
        console.error('[app] 未捕获的错误：', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
        console.error('[app] 未处理的 Promise 拒绝：', e.reason);
    });

    // 13. 打招呼（首次打开）
    const meta2 = get(KEYS.META);
    const isFirstOpenToday = meta2.firstOpenAt &&
        formatDate(meta2.firstOpenAt) === formatDate(new Date()) &&
        Date.now() - meta2.firstOpenAt < 5000;
    if (isFirstOpenToday) {
        setTimeout(() => toast('欢迎回来 ♥', 1800), 400);
    }

    // 14. 暴露到 window（便于调试）
    window.__mj = {
        bus,
        showScreen,
        openModal,
        closeModal,
        modules: {
            home: homeModule,
            chat: chatModule,
            letters: lettersModule,
            moments: momentsModule,
            period: periodModule,
            messageStats: messageStatsModule,
            divine: divineModule,
            favorites: favoritesModule,
            music: musicModule,
            questions: questionsModule,
            water: waterModule,
            settings: settingsModule,
            call: callModule
        }
    };
}


/* ==========================================================================
   11. 启动
   ========================================================================== */

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    // DOM 已经就绪（可能是动态注入脚本）
    bootstrap();
}


/* ==========================================================================
   12. 对外导出（可选，供测试或未来模块使用）
   ========================================================================== */

export {
    ALL_ACTIONS,
    ALL_NAVS,
    bus,
    bootstrap
};
