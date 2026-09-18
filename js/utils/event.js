/* ==========================================================================
   梦角 · Dream Corner
   事件模块  js/utils/event.js
   --------------------------------------------------------------------------
   职责：
   1. 全局事件委托：接管 data-action / data-nav，分发到各模块注册的处理器
   2. 处理一批"通用动作"（close-modal / toggle-switch / toggle-check 等）
   3. 提供发布订阅总线 bus，用于模块间解耦通信
   4. 提供 bindOnce / unbindAll 便于调试和清理
   ========================================================================== */

import {
    closeModalByChild,
    toggleSwitch,
    setCheck,
    getCheck
} from './dom.js';

/* ==========================================================================
   01. 注册表
   ========================================================================== */

/** action 处理器表：{ [actionName]: (el, event) => void } */
const actionHandlers = new Map();

/** nav 处理器表：{ [navName]: (el, event) => void } */
const navHandlers = new Map();

/** 事件总线：{ [eventName]: Set<handler> } */
const busMap = new Map();

/** 是否已绑定（避免重复绑定） */
let _bound = false;


/* ==========================================================================
   02. 通用动作（框架自动处理，不需要各模块写）
   --------------------------------------------------------------------------
   这些 action 在 HTML 里出现频率极高，且逻辑与业务无关：
     - close-modal          : 关闭所在弹窗（也可带 data-modal-target 指定）
     - toggle-switch        : 翻转 .switch
     - toggle-check         : 翻转 .check-indicator
     - toggle-check-on      : 打开 .check-indicator
     - toggle-check-off     : 关闭 .check-indicator
   ========================================================================== */

const COMMON_ACTIONS = {

    /**
     * 关闭弹窗
     * 用法 1：<button data-action="close-modal">           → 关闭所在 .modal-overlay
     * 用法 2：<button data-action="close-modal" data-modal-target="modal-xxx">
     */
    'close-modal'(el) {
        const targetId = el.dataset.modalTarget;
        if (targetId) {
            const overlay = document.getElementById(targetId);
            if (overlay) {
                overlay.classList.remove('active');
                return;
            }
        }
        closeModalByChild(el);
    },

    /**
     * 翻转开关
     * 用法：<button class="switch" data-action="toggle-switch" data-switch-id="mute">
     * 注意：switch 元素在 HTML 里同时带 aria-checked，翻转后由 dom.setSwitch 同步
     */
    'toggle-switch'(el) {
        const next = toggleSwitch(el);
        // 广播给关心的人（比如 settings.js 会持久化）
        bus.emit('switch:change', {
            id: el.dataset.switchId || el.id,
            value: next,
            el
        });
    },

    /**
     * 翻转勾选
     * 用法：<button class="check-indicator" data-action="toggle-check" data-check-id="read-receipt">
     */
    'toggle-check'(el) {
        const next = !getCheck(el);
        setCheck(el, next);
        bus.emit('check:change', {
            id: el.dataset.checkId || el.id,
            value: next,
            el
        });
    },

    'toggle-check-on'(el) {
        setCheck(el, true);
        bus.emit('check:change', { id: el.dataset.checkId || el.id, value: true, el });
    },

    'toggle-check-off'(el) {
        setCheck(el, false);
        bus.emit('check:change', { id: el.dataset.checkId || el.id, value: false, el });
    }
};


/* ==========================================================================
   03. 核心：绑定全局事件委托
   ========================================================================== */

/**
 * 绑定全局事件委托
 * @param {Object} [options]
 * @param {Object} [options.actions]  { [actionName]: fn }  业务动作
 * @param {Object} [options.navs]     { [navName]: fn }      页面跳转
 */
export function bindEvents(options = {}) {
    const { actions = {}, navs = {} } = options;

    // 合并到注册表
    Object.assign(actions, {}); // 占位保持签名清晰
    Object.entries(actions).forEach(([k, fn]) => registerAction(k, fn));
    Object.entries(navs).forEach(([k, fn]) => registerNav(k, fn));

    if (_bound) return;
    _bound = true;

    /* ---------- 点击代理 ---------- */
    document.addEventListener('click', handleClick, false);

    /* ---------- 键盘：Enter 触发按钮（提升可达性） ---------- */
    document.addEventListener('keydown', handleKeydown, false);

    /* ---------- 值变化代理（开关、勾选、选择器） ---------- */
    document.addEventListener('change', handleChange, false);
}

/** 防止 action 处理器内部调用 .click() 导致无限递归 */
let _lastActionEl = null;
let _lastActionTime = 0;
/**
 * 点击事件处理
 */
function handleClick(event) {
    /* ---------- 1) data-action ---------- */
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
        const action = actionEl.dataset.action;

        // 防递归：同一元素 50ms 内只处理一次
        const now = Date.now();
        if (actionEl === _lastActionEl && now - _lastActionTime < 50) {
            return;
        }
        _lastActionEl = actionEl;
        _lastActionTime = now;

        if (!actionEl.disabled) {
            // 优先执行通用动作
            if (COMMON_ACTIONS[action]) {
                COMMON_ACTIONS[action](actionEl, event);
            }
            // 再执行业务动作
            const bizFn = actionHandlers.get(action);
            if (bizFn) bizFn(actionEl, event);
        }
    }

    /* ---------- 2) data-nav ---------- */
    const navEl = event.target.closest('[data-nav]');
    if (navEl) {
        const nav = navEl.dataset.nav;
        const navFn = navHandlers.get(nav);
        if (navFn) navFn(navEl, event);
    }
}
/**
 * 键盘处理（Enter 触发按钮，Space 交给浏览器）
 */
function handleKeydown(event) {
    if (event.key !== 'Enter') return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // 输入框内回车不重复触发（交由各模块自行处理）
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    if (target.hasAttribute('data-action') || target.hasAttribute('data-nav')) {
        event.preventDefault();
        target.click();
    }
}

/**
 * change 事件处理
 *  主要给原生 <select> / <input> 用，直接广播
 */
function handleChange(event) {
    const el = event.target;
    if (!(el instanceof HTMLElement)) return;

    // 带 data-action 的 select
    const action = el.dataset ? el.dataset.action : null;
    if (action && actionHandlers.has(action)) {
        actionHandlers.get(action)(el, event);
    }

    // 广播通用变化
    if (el.id) {
        bus.emit('input:change', { id: el.id, value: el.value, el });
    }
}


/* ==========================================================================
   04. 注册 / 注销
   ========================================================================== */

/**
 * 注册一个 action 处理器
 * @param {string} name
 * @param {Function} fn
 */
export function registerAction(name, fn) {
    if (typeof fn !== 'function') return;
    actionHandlers.set(name, fn);
}

/**
 * 注册一个 nav 处理器
 * @param {string} name
 * @param {Function} fn
 */
export function registerNav(name, fn) {
    if (typeof fn !== 'function') return;
    navHandlers.set(name, fn);
}

/**
 * 批量注册 actions
 * @param {Object<string, Function>} map
 */
export function registerActions(map) {
    Object.entries(map || {}).forEach(([k, fn]) => registerAction(k, fn));
}

/**
 * 批量注册 navs
 * @param {Object<string, Function>} map
 */
export function registerNavs(map) {
    Object.entries(map || {}).forEach(([k, fn]) => registerNav(k, fn));
}

/**
 * 注销一个 action
 * @param {string} name
 */
export function unregisterAction(name) {
    actionHandlers.delete(name);
}

/**
 * 注销一个 nav
 * @param {string} name
 */
export function unregisterNav(name) {
    navHandlers.delete(name);
}

/**
 * 清空全部注册（调试用）
 */
export function unbindAll() {
    actionHandlers.clear();
    navHandlers.clear();
}


/* ==========================================================================
   05. 事件总线（发布订阅）
   --------------------------------------------------------------------------
   用于模块间解耦。命名建议用「模块:事件」的形式，例如：
     'chat:new-message'     新消息
     'chat:cleared'         聊天被清空
     'checkin:done'         打卡完成
     'music:state'          播放器状态变化
     'period:update'        经期数据更新
     'theme:change'         主题切换
     'settings:changed'     某项设置保存
     'storage:changed'      存储数据变化
   ========================================================================== */

export const bus = {

    /**
     * 订阅事件
     * @param {string} event
     * @param {Function} handler
     * @returns {Function} 取消订阅函数
     */
    on(event, handler) {
        if (typeof handler !== 'function') return () => {};
        if (!busMap.has(event)) busMap.set(event, new Set());
        busMap.get(event).add(handler);

        // 返回"退订"函数，便于组件卸载时清理
        return () => bus.off(event, handler);
    },

    /**
     * 订阅一次
     * @param {string} event
     * @param {Function} handler
     */
    once(event, handler) {
        const wrapper = (payload) => {
            bus.off(event, wrapper);
            handler(payload);
        };
        return bus.on(event, wrapper);
    },

    /**
     * 取消订阅
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        const set = busMap.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) busMap.delete(event);
    },

    /**
     * 发布事件
     * @param {string} event
     * @param {*} [payload]
     */
    emit(event, payload) {
        const set = busMap.get(event);
        if (!set) return;

        // 复制一份避免在回调里增删订阅导致遍历异常
        Array.from(set).forEach((fn) => {
            try {
                fn(payload);
            } catch (err) {
                console.error(`[bus] 处理 ${event} 出错：`, err);
            }
        });
    },

    /**
     * 清空所有订阅（测试用）
     */
    clear() {
        busMap.clear();
    },

    /**
     * 当前订阅情况（调试用）
     * @returns {Object<string, number>}
     */
    debug() {
        const out = {};
        busMap.forEach((set, name) => {
            out[name] = set.size;
        });
        return out;
    }
};


/* ==========================================================================
   06. 快捷绑定：给单个元素绑事件（避免模块里到处写 addEventListener）
   ========================================================================== */

/**
 * 给元素绑定事件并返回解绑函数
 * @param {Element|string} target   元素或选择器
 * @param {string} type
 * @param {Function} handler
 * @param {Object} [options]
 * @returns {Function} 解绑
 */
export function on(target, type, handler, options) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return () => {};
    el.addEventListener(type, handler, options);
    return () => el.removeEventListener(type, handler, options);
}

/**
 * 给多个元素批量绑定
 * @param {Element[]|NodeList|string} targets
 * @param {string} type
 * @param {Function} handler
 * @param {Object} [options]
 * @returns {Function} 统一解绑
 */
export function onAll(targets, type, handler, options) {
    const list =
        typeof targets === 'string'
            ? Array.from(document.querySelectorAll(targets))
            : Array.from(targets || []);

    const offs = list.map((el) => {
        el.addEventListener(type, handler, options);
        return () => el.removeEventListener(type, handler, options);
    });

    return () => offs.forEach((off) => off());
}

/**
 * 只在元素上绑定一次
 * @param {Element|string} target
 * @param {string} type
 * @param {Function} handler
 * @param {Object} [options]
 * @returns {Function} 解绑
 */
export function once(target, type, handler, options) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return () => {};
    const wrapped = (e) => {
        el.removeEventListener(type, wrapped, options);
        handler(e);
    };
    el.addEventListener(type, wrapped, options);
    return () => el.removeEventListener(type, wrapped, options);
}

/**
 * 事件委托（局部）
 * 用于列表内动态渲染的元素，比如聊天列表、收藏列表
 * @param {Element|string} root
 * @param {string} delegateSelector
 * @param {string} type
 * @param {Function} handler
 * @returns {Function} 解绑
 */
export function delegate(root, delegateSelector, type, handler) {
    const el = typeof root === 'string' ? document.querySelector(root) : root;
    if (!el) return () => {};

    const wrapped = (event) => {
        const match = event.target.closest(delegateSelector);
        if (match && el.contains(match)) {
            handler(event, match);
        }
    };

    el.addEventListener(type, wrapped);
    return () => el.removeEventListener(type, wrapped);
}


/* ==========================================================================
   07. 默认导出
   ========================================================================== */

export default {
    bindEvents,
    registerAction,
    registerNav,
    registerActions,
    registerNavs,
    unregisterAction,
    unregisterNav,
    unbindAll,
    bus,
    on,
    onAll,
    once,
    delegate
};
