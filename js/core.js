/**
 * core.js
 * 核心底层：事件总线 / 页面切换 / 弹窗开关 / 返回栈 / 全局绑定
 * 依赖：config.js / utils.js / state.js
 * 被依赖：几乎全部业务模块
 *
 * 说明：
 * 1. 全局只此一份，对外提供 APP_CORE。
 * 2. 页面切换统一走 showPage()，弹窗统一走 openPopup() / closePopup()。
 * 3. 自动委托 [data-target-page] / [data-target-popup] / .btn-back 的点击。
 * 4. 挂到 window.APP_CORE 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};

    var Dom = UTILS.Dom || {};
    var Log = UTILS.Log || { log: function () {}, warn: function () {}, error: function () {} };

    var EVENTS = CONFIG.EVENTS || {};
    var SEL = CONFIG.SELECTORS || {};
    var POPUP_CLASS = CONFIG.POPUP_CLASS || {};
    var PAGES = CONFIG.PAGES || {};
    var DEFAULT_PAGE = CONFIG.DEFAULT_PAGE || 'homeFirst';

    // 点击遮罩不关闭的弹窗（如通话界面）
    var NO_MASK_CLOSE = ['callOut', 'callIn'];

    // 是否已初始化
    var _inited = false;

    /* ============================================================
     * 1. 事件总线
     * ============================================================ */
    var _listeners = {};

    /**
     * 订阅事件
     * @returns {Function} 取消订阅函数
     */
    function on(event, handler) {
        if (!event || typeof handler !== 'function') return function () {};
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(handler);
        return function off() {
            var arr = _listeners[event];
            if (!arr) return;
            var i = arr.indexOf(handler);
            if (i > -1) arr.splice(i, 1);
        };
    }

    /**
     * 订阅一次
     */
    function once(event, handler) {
        var off = on(event, function (payload) {
            off();
            handler(payload);
        });
        return off;
    }

    /**
     * 取消订阅
     */
    function off(event, handler) {
        if (!event) {
            _listeners = {};
            return;
        }
        var arr = _listeners[event];
        if (!arr) return;
        if (!handler) {
            delete _listeners[event];
            return;
        }
        var i = arr.indexOf(handler);
        if (i > -1) arr.splice(i, 1);
    }

    /**
     * 触发事件
     */
    function emit(event, payload) {
        var arr = _listeners[event];
        if (!arr || arr.length === 0) return;
        arr.slice().forEach(function (fn) {
            try {
                fn(payload);
            } catch (e) {
                Log.error('[core] 事件回调出错:', event, e);
            }
        });
    }

    /* ============================================================
     * 2. DOM 快捷方法
     * ============================================================ */
    function $(selector, parent) {
        return Dom.qs ? Dom.qs(selector, parent) : (parent || document).querySelector(selector);
    }

    function $$(selector, parent) {
        return Dom.qsa ? Dom.qsa(selector, parent) : Array.prototype.slice.call((parent || document).querySelectorAll(selector));
    }

    /* ============================================================
     * 3. 页面切换
     * ============================================================ */

    /**
     * 找页面元素
     * @param {string} name data-page 的值
     */
    function getPageEl(name) {
        if (!name) return null;
        return document.querySelector('.page[data-page="' + name + '"]');
    }

    /**
     * 获取当前页
     */
    function getCurrentPage() {
        return STATE.Page ? STATE.Page.current() : null;
    }

    /**
     * 切换到某个页面
     * @param {string} name
     * @param {object} options { recordHistory: 是否记录历史, silent: 是否触发事件 }
     */
    function showPage(name, options) {
        options = options || {};

        if (!name || name === getCurrentPage()) {
            return false;
        }

        var targetEl = getPageEl(name);
        if (!targetEl) {
            Log.warn('[core] 找不到页面:', name);
            return false;
        }

        var fromPage = getCurrentPage();

        // 触发切换前事件（可取消）
        var beforePayload = { from: fromPage, to: name, cancel: false };
        emit(EVENTS.PAGE_BEFORE_CHANGE || 'page:beforeChange', beforePayload);
        if (beforePayload.cancel) {
            return false;
        }

        // 隐藏所有页面
        $$('.page').forEach(function (el) {
            el.classList.remove('active');
        });
        // 显示目标页
        targetEl.classList.add('active');

        // 页面切换时自动关闭所有弹窗（可配置）
        if (options.keepPopups !== true) {
            closeAllPopups();
        }

        // 记录到 state
        if (STATE.Page) {
            STATE.Page.setCurrent(name, options.recordHistory !== false);
        }

        // 触发切换后事件
        emit(EVENTS.PAGE_CHANGE || 'page:change', { from: fromPage, to: name });
        emit(EVENTS.PAGE_AFTER_CHANGE || 'page:afterChange', { from: fromPage, to: name });

        // 滚动到顶部
        var wrap = targetEl.querySelector('.chat-message-container');
        if (wrap) {
            // 聊天页不滚顶
        } else {
            targetEl.scrollTop = 0;
        }

        return true;
    }

    /**
     * 返回上一页
     */
    function backPage() {
        if (!STATE.Page) return false;
        var prev = STATE.Page.back();
        if (!prev) return false;

        var targetEl = getPageEl(prev);
        if (!targetEl) return false;

        $$('.page').forEach(function (el) {
            el.classList.remove('active');
        });
        targetEl.classList.add('active');
        targetEl.scrollTop = 0;

        closeAllPopups();

        emit(EVENTS.PAGE_CHANGE || 'page:change', { to: prev, isBack: true });
        return true;
    }

    /* ============================================================
     * 4. 弹窗
     * ============================================================ */

    /**
     * 找弹窗元素
     * 支持三种定位方式：
     *   1. [data-popup="name"]
     *   2. config.POPUP_CLASS 里以 name 为 key 的 class
     *   3. .popup-name 约定（name 去掉 Popup 后缀后按驼峰/短横找）
     */
    function getPopupEl(name) {
        if (!name) return null;

        // 1. data-popup 匹配
        var el = document.querySelector('.popup[data-popup="' + name + '"]');
        if (el) return el;

        // 2. 去掉 "Popup" 后缀再试
        var shortName = name.replace(/Popup$/i, '');
        if (shortName !== name) {
            el = document.querySelector('.popup[data-popup="' + shortName + '"]');
            if (el) return el;
        }

        // 3. config.POPUP_CLASS 匹配（key 是短名或全名）
        var cls = POPUP_CLASS[name] || POPUP_CLASS[shortName];
        if (cls) {
            el = document.querySelector(cls);
            if (el) return el;
        }

        // 4. 约定 .popup-xxx（驼峰转短横）
        var kebab = shortName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
        el = document.querySelector('.popup-' + kebab);
        if (el) return el;

        return null;
    }

    /**
     * 打开弹窗
     * @param {string} name
     * @param {object} options { closeOthers: 是否关闭其它弹窗, silent: 不触发事件 }
     */
    function openPopup(name, options) {
        options = options || {};
        var el = getPopupEl(name);
        if (!el) {
            Log.warn('[core] 找不到弹窗:', name);
            return false;
        }

        // 弹窗在某个非 active 的 page 里 → 先切到那个 page
        var parentPage = el.closest ? el.closest('.page') : null;
        if (parentPage && !parentPage.classList.contains('active')) {
            var pageName = parentPage.dataset.page;
            if (pageName) {
                showPage(pageName, { recordHistory: false, keepPopups: true });
            }
        }

        // 关闭其它弹窗
        if (options.closeOthers !== false) {
            $$('.popup.active').forEach(function (p) {
                if (p !== el) p.classList.remove('active');
            });
        }

        el.classList.add('active');

        if (STATE.Popup) {
            STATE.Popup.open(name);
        }

        if (!options.silent) {
            emit(EVENTS.POPUP_OPEN || 'popup:open', { name: name, el: el });
        }

        return true;
    }

    /**
     * 关闭弹窗
     * @param {string} name 不传则关闭当前
     */
    function closePopup(name) {
        var el = name ? getPopupEl(name) : document.querySelector('.popup.active');
        if (!el) return false;

        el.classList.remove('active');

        if (STATE.Popup) {
            if (name) {
                STATE.Popup.close();
            } else {
                STATE.Popup.close();
            }
        }

        emit(EVENTS.POPUP_CLOSE || 'popup:close', { name: name || null, el: el });
        return true;
    }

    /**
     * 关闭所有弹窗
     */
    function closeAllPopups() {
        var list = $$('.popup.active');
        if (list.length === 0) return false;

        list.forEach(function (el) {
            el.classList.remove('active');
        });

        if (STATE.Popup) {
            STATE.Popup.closeAll();
        }

        emit(EVENTS.POPUP_CLOSE || 'popup:close', { name: 'all' });
        return true;
    }

    /**
     * 弹窗开关切换
     */
    function togglePopup(name) {
        var el = getPopupEl(name);
        if (!el) return false;
        if (el.classList.contains('active')) {
            return closePopup(name);
        }
        return openPopup(name);
    }

    /* ============================================================
     * 5. 悬浮窗
     * ============================================================ */
    function getFloatEl(name) {
        if (!name) return null;
        return document.querySelector('.float-window[data-float="' + name + '"]');
    }

    function showFloat(name) {
        var el = getFloatEl(name);
        if (!el) {
            Log.warn('[core] 找不到悬浮窗:', name);
            return false;
        }
        el.classList.add('active');
        emit('float:show', { name: name, el: el });
        return true;
    }

    function hideFloat(name) {
        var el = name ? getFloatEl(name) : document.querySelector('.float-window.active');
        if (!el) return false;
        el.classList.remove('active');
        emit('float:hide', { name: name, el: el });
        return true;
    }

    /* ============================================================
     * 6. 全局绑定
     * ============================================================ */
    var _bound = false;

    // 全局 click 委托
    function _onDocumentClick(e) {
        var target = e.target;
        if (!target) return;

        // 1. 点击弹窗遮罩 → 关闭
        if (target.classList && target.classList.contains('popup')) {
            var popupName = target.dataset.popup
                || (target.className.match(/popup-[\w-]+/) || [''])[0];

            // 黑名单不关
            var isBlack = NO_MASK_CLOSE.some(function (n) {
                return popupName && popupName.indexOf(n) > -1;
            });
            if (!isBlack) {
                target.classList.remove('active');
                if (STATE.Popup) STATE.Popup.close();
                emit(EVENTS.POPUP_CLOSE || 'popup:close', { name: popupName, el: target });
            }
            return;
        }

        // 2. [data-target-page]
        var pageTrigger = target.closest ? target.closest('[data-target-page]') : null;
        if (pageTrigger) {
            var pageName = pageTrigger.dataset.targetPage;
            if (pageName) {
                // 如果点击在弹窗内，先关闭弹窗
                var inPopup = pageTrigger.closest('.popup');
                if (inPopup) closeAllPopups();
                showPage(pageName);
            }
            return;
        }

        // 3. [data-target-popup]
        var popupTrigger = target.closest ? target.closest('[data-target-popup]') : null;
        if (popupTrigger) {
            var popupName = popupTrigger.dataset.targetPopup;
            if (popupName) {
                openPopup(popupName);
            }
            return;
        }

        // 4. .btn-back
        var backBtn = target.closest ? target.closest('.btn-back') : null;
        if (backBtn) {
            // 如果弹窗还开着，先关弹窗
            if (document.querySelector('.popup.active')) {
                closeAllPopups();
            } else {
                backPage();
            }
            return;
        }

        // 5. .btn-popup-close / .btn-popup-cancel（通用关闭）
        var closeBtn = target.closest ? target.closest('.btn-popup-close, .btn-popup-cancel') : null;
        if (closeBtn) {
            var popupRoot = closeBtn.closest('.popup');
            if (popupRoot) {
                popupRoot.classList.remove('active');
                if (STATE.Popup) STATE.Popup.close();
                emit(EVENTS.POPUP_CLOSE || 'popup:close', { el: popupRoot });
            }
            return;
        }
    }

    // ESC 关闭弹窗
    function _onKeyDown(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            if (document.querySelector('.popup.active')) {
                closeAllPopups();
            } else if (STATE.Page && STATE.Page.canBack()) {
                backPage();
            }
        }
    }

    function bindGlobal() {
        if (_bound) return;
        document.addEventListener('click', _onDocumentClick, false);
        document.addEventListener('keydown', _onKeyDown, false);
        _bound = true;
        Log.log('[core] 全局事件已绑定');
    }

    function unbindGlobal() {
        if (!_bound) return;
        document.removeEventListener('click', _onDocumentClick, false);
        document.removeEventListener('keydown', _onKeyDown, false);
        _bound = false;
    }

    /* ============================================================
     * 7. 初始化
     * ============================================================ */
    function init(options) {
        options = options || {};
        if (_inited) return;

        // 初始化 state
        if (STATE.init) STATE.init();

        // 绑定全局事件
        if (options.bindGlobal !== false) {
            bindGlobal();
        }

        // 打开默认页面（HTML 里没有 active，所以需要主动激活）
        var startPage = options.startPage || (STATE.Page && STATE.Page.current()) || DEFAULT_PAGE;
        // 直接操作 DOM，避免触发历史记录
        var el = getPageEl(startPage);
        if (el) {
            $$('.page').forEach(function (p) { p.classList.remove('active'); });
            el.classList.add('active');
            if (STATE.Page) STATE.Page.setCurrent(startPage, false);
        } else {
            // 兜底：如果找不到，就激活 DOM 里第一个 page
            var first = document.querySelector('.page');
            if (first) first.classList.add('active');
        }

        _inited = true;
        emit('core:ready', { startPage: startPage });
        Log.log('[core] 初始化完成，起始页：', startPage);
    }

    function destroy() {
        unbindGlobal();
        off();
        _inited = false;
    }

    /* ============================================================
     * 8. 对外导出
     * ============================================================ */
    var APP_CORE = {
        // 事件
        on: on,
        once: once,
        off: off,
        emit: emit,

        // DOM
        $: $,
        $$: $$,

        // 页面
        showPage: showPage,
        backPage: backPage,
        getCurrentPage: getCurrentPage,
        getPageEl: getPageEl,

        // 弹窗
        openPopup: openPopup,
        closePopup: closePopup,
        closeAllPopups: closeAllPopups,
        togglePopup: togglePopup,
        getPopupEl: getPopupEl,

        // 悬浮窗
        showFloat: showFloat,
        hideFloat: hideFloat,

        // 生命周期
        init: init,
        destroy: destroy,

        // 引用
        state: STATE
    };

    // 挂到全局
    global.APP_CORE = APP_CORE;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_CORE;

})(typeof window !== 'undefined' ? window : this);