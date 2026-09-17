/**
 * state.js
 * 全局状态管理
 * 依赖：config.js / utils.js
 * 被依赖：core.js / data.js / listeners.js / main.js 等
 *
 * 说明：
 * 1. 保存运行时的全局状态（当前页面、当前弹窗、当前聊天对象等）。
 * 2. 提供 get / set / update / reset 方法。
 * 3. 状态变化时触发事件，供其他模块监听。
 * 4. 挂到 window.APP_STATE 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};

    var Store = UTILS.Store;
    var Obj = UTILS.Obj;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    /* ============================================================
     * 1. 默认状态
     * ============================================================ */
    function getDefaultState() {
        return {
            // ---------- 页面 ----------
            currentPage: CONFIG.DEFAULT_PAGE || 'homeFirst',
            pageHistory: [],                 // 页面历史栈，用于返回
            previousPage: null,

            // ---------- 弹窗 ----------
            currentPopup: null,              // 当前打开的弹窗名
            popupStack: [],                  // 弹窗栈（支持弹窗上叠弹窗）

            // ---------- 悬浮窗 ----------
            currentFloat: null,

            // ---------- 当前会话 ----------
            currentChatId: 'ta',             // 当前聊天对象 id
            currentChatType: 'single',       // 'single' | 'group'

            // ---------- 连接状态 ----------
            connectionLevel: (CONFIG.CONNECTION && CONFIG.CONNECTION.default) || 6,

            // ---------- 情绪 ----------
            currentMood: (CONFIG.DEFAULT_MOOD && CONFIG.DEFAULT_MOOD.current) || 'calm',
            moodIntensity: (CONFIG.DEFAULT_MOOD && CONFIG.DEFAULT_MOOD.intensity) || 50,

            // ---------- 主题 ----------
            themeMode: (CONFIG.DEFAULT_THEME && CONFIG.DEFAULT_THEME.mode) || 'system',
            isDark: false,

            // ---------- 通话 ----------
            callStatus: 'idle',              // 'idle' | 'outgoing' | 'incoming' | 'talking'
            callStartTime: 0,
            callTargetId: null,

            // ---------- 音乐 ----------
            musicPlaying: false,
            musicCurrentId: null,

            // ---------- 商城 ----------
            shopTab: 'recommend',
            cartCount: 0,

            // ---------- 新手引导 ----------
            onboardingDone: false,

            // ---------- 初始化标记 ----------
            initialized: false,
            ready: false,

            // ---------- 未读统计 ----------
            unread: {},                      // { chatId: count }

            // ---------- 临时 UI 状态 ----------
            multiSelectMode: false,          // 收藏页多选模式
            currentLetterTab: 'send',        // 信件页当前 tab
            currentMusicTab: 'library',      // 音乐页当前 tab
            currentQuestionTab: 'mine',      // 提问页当前 tab
            currentFavoriteTab: 'mine',      // 收藏页当前 tab
            currentShopTab: 'recommend',     // 商城页当前 tab
            currentOrderTab: 'all'           // 订单页当前 tab
        };
    }

    /* ============================================================
     * 2. 内部状态对象
     * ============================================================ */
    var _state = getDefaultState();

    // 是否已经从 localStorage 加载过
    var _loaded = false;

    // 事件监听器集合：{ eventName: [fn, fn, ...] }
    var _listeners = {};

    /* ============================================================
     * 3. 事件订阅 / 发布（内部轻量实现，不依赖 core.js）
     * ============================================================ */
    function on(event, handler) {
        if (!event || typeof handler !== 'function') return function () {};
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(handler);

        // 返回取消订阅函数
        return function off() {
            var arr = _listeners[event];
            if (!arr) return;
            var idx = arr.indexOf(handler);
            if (idx > -1) arr.splice(idx, 1);
        };
    }

    function emit(event, payload) {
        var arr = _listeners[event];
        if (!arr || arr.length === 0) return;
        // 复制一份，防止回调里修改数组
        arr.slice().forEach(function (fn) {
            try {
                fn(payload);
            } catch (e) {
                Log.error('[state] emit 回调出错:', event, e);
            }
        });
    }

    /* ============================================================
     * 4. 读 / 写 / 更新
     * ============================================================ */

    /**
     * 读取某个字段
     * @param {string} key 不传则返回整个 state 的浅拷贝
     */
    function get(key) {
        if (key === undefined) {
            return Obj.deepClone(_state);
        }
        return _state[key];
    }

    /**
     * 设置某个字段
     * @param {string} key
     * @param {*} value
     * @param {boolean} silent 为 true 时不触发事件
     */
    function set(key, value, silent) {
        if (typeof key !== 'string') return;

        var oldValue = _state[key];
        if (oldValue === value) return;

        _state[key] = value;

        if (!silent) {
            emit(CONFIG.EVENTS && CONFIG.EVENTS.STATE_CHANGE || 'state:change', {
                key: key,
                oldValue: oldValue,
                newValue: value
            });
            // 单独字段事件，方便监听具体字段
            emit('state:' + key, value, oldValue);
        }
    }

    /**
     * 批量更新（浅合并）
     * @param {object} patch
     * @param {boolean} silent
     */
    function update(patch, silent) {
        if (!patch || typeof patch !== 'object') return;

        var changed = {};
        Object.keys(patch).forEach(function (k) {
            var oldValue = _state[k];
            if (oldValue !== patch[k]) {
                _state[k] = patch[k];
                changed[k] = { oldValue: oldValue, newValue: patch[k] };
            }
        });

        if (!silent && Object.keys(changed).length > 0) {
            emit(CONFIG.EVENTS && CONFIG.EVENTS.STATE_CHANGE || 'state:change', changed);
            Object.keys(changed).forEach(function (k) {
                emit('state:' + k, changed[k].newValue, changed[k].oldValue);
            });
        }
    }

    /**
     * 重置某个字段到默认值
     */
    function resetKey(key) {
        var defaults = getDefaultState();
        if (key in defaults) {
            set(key, defaults[key]);
        }
    }

    /**
     * 重置全部
     */
    function resetAll(silent) {
        _state = getDefaultState();
        if (!silent) {
            emit('state:reset', _state);
        }
    }

    /* ============================================================
     * 5. 持久化
     *    只持久化需要跨会话保存的字段
     * ============================================================ */

    // 需要保存到 localStorage 的字段白名单
    var PERSIST_KEYS = [
        'currentPage',
        'currentChatId',
        'currentChatType',
        'connectionLevel',
        'currentMood',
        'moodIntensity',
        'themeMode',
        'isDark',
        'shopTab',
        'onboardingDone',
        'unread',
        'currentLetterTab',
        'currentMusicTab',
        'currentQuestionTab',
        'currentFavoriteTab',
        'currentOrderTab'
    ];

    /**
     * 保存到 localStorage
     */
    function save() {
        if (!Store) return false;
        var data = {};
        PERSIST_KEYS.forEach(function (k) {
            data[k] = _state[k];
        });
        return Store.set(CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.STATE || 'state', data);
    }

    /**
     * 从 localStorage 加载
     */
    function load() {
        if (!Store || _loaded) return;
        _loaded = true;

        var saved = Store.get(CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.STATE || 'state');
        if (saved && typeof saved === 'object') {
            PERSIST_KEYS.forEach(function (k) {
                if (saved[k] !== undefined) {
                    _state[k] = saved[k];
                }
            });
            Log.log('[state] 已从本地恢复状态');
        }
    }

    /**
     * 清空持久化
     */
    function clearStorage() {
        if (!Store) return;
        Store.remove(CONFIG.STORAGE_KEYS && CONFIG.STORAGE_KEYS.STATE || 'state');
    }

    /* ============================================================
     * 6. 页面相关快捷方法
     * ============================================================ */
    var Page = {
        // 获取当前页
        current: function () {
            return _state.currentPage;
        },

        // 设置当前页（会记录历史）
        setCurrent: function (pageName, recordHistory) {
            if (!pageName) return;
            if (_state.currentPage === pageName) return;

            var old = _state.currentPage;
            _state.previousPage = old;

            // 记录历史栈
            if (recordHistory !== false) {
                if (_state.currentPage) {
                    _state.pageHistory.push(_state.currentPage);
                }
                // 防止历史栈无限增长
                if (_state.pageHistory.length > 50) {
                    _state.pageHistory.shift();
                }
            }

            _state.currentPage = pageName;

            emit(CONFIG.EVENTS && CONFIG.EVENTS.PAGE_CHANGE || 'page:change', {
                from: old,
                to: pageName
            });
        },

        // 返回上一页
        back: function () {
            var prev = _state.pageHistory.pop();
            if (prev) {
                _state.previousPage = _state.currentPage;
                var old = _state.currentPage;
                _state.currentPage = prev;
                emit(CONFIG.EVENTS && CONFIG.EVENTS.PAGE_CHANGE || 'page:change', {
                    from: old,
                    to: prev,
                    isBack: true
                });
                return prev;
            }
            return null;
        },

        // 清空历史
        clearHistory: function () {
            _state.pageHistory = [];
        },

        // 是否能返回
        canBack: function () {
            return _state.pageHistory.length > 0;
        }
    };

    /* ============================================================
     * 7. 弹窗相关快捷方法
     * ============================================================ */
    var Popup = {
        // 当前弹窗名
        current: function () {
            return _state.currentPopup;
        },

        // 打开
        open: function (name) {
            if (!name) return;
            if (_state.currentPopup) {
                _state.popupStack.push(_state.currentPopup);
            }
            _state.currentPopup = name;
            emit(CONFIG.EVENTS && CONFIG.EVENTS.POPUP_OPEN || 'popup:open', name);
        },

        // 关闭当前弹窗（会恢复上一个）
        close: function () {
            var closed = _state.currentPopup;
            var prev = _state.popupStack.pop() || null;
            _state.currentPopup = prev;
            emit(CONFIG.EVENTS && CONFIG.EVENTS.POPUP_CLOSE || 'popup:close', {
                closed: closed,
                current: prev
            });
            return closed;
        },

        // 关闭所有
        closeAll: function () {
            _state.currentPopup = null;
            _state.popupStack = [];
            emit(CONFIG.EVENTS && CONFIG.EVENTS.POPUP_CLOSE || 'popup:close', {
                closed: 'all',
                current: null
            });
        },

        // 是否打开着某个
        isOpen: function (name) {
            return _state.currentPopup === name;
        }
    };

    /* ============================================================
     * 8. 连接状态
     * ============================================================ */
    var Connection = {
        get: function () {
            return _state.connectionLevel;
        },

        set: function (level) {
            var n = Number(level) || 0;
            var min = (CONFIG.CONNECTION && CONFIG.CONNECTION.min) || 0;
            var max = (CONFIG.CONNECTION && CONFIG.CONNECTION.max) || 6;
            n = Math.max(min, Math.min(max, n));

            if (_state.connectionLevel === n) return;

            var old = _state.connectionLevel;
            _state.connectionLevel = n;

            emit(CONFIG.EVENTS && CONFIG.EVENTS.CONNECTION_CHANGE || 'connection:change', {
                from: old,
                to: n
            });
        },

        // 满格
        full: function () {
            this.set((CONFIG.CONNECTION && CONFIG.CONNECTION.max) || 6);
        },

        // 清零
        clear: function () {
            this.set(0);
        }
    };

    /* ============================================================
     * 9. 情绪
     * ============================================================ */
    var Mood = {
        get: function () {
            return _state.currentMood;
        },

        set: function (mood, intensity) {
            var old = _state.currentMood;
            _state.currentMood = mood;
            if (intensity !== undefined) {
                _state.moodIntensity = Math.max(0, Math.min(100, Number(intensity) || 0));
            }
            if (old !== mood) {
                emit(CONFIG.EVENTS && CONFIG.EVENTS.MOOD_CHANGE || 'mood:change', {
                    from: old,
                    to: mood,
                    intensity: _state.moodIntensity
                });
            }
        },

        getIntensity: function () {
            return _state.moodIntensity;
        }
    };

    /* ============================================================
     * 10. 主题
     * ============================================================ */
    var Theme = {
        getMode: function () {
            return _state.themeMode;
        },

        setMode: function (mode) {
            if (_state.themeMode === mode) return;
            _state.themeMode = mode;
            emit(CONFIG.EVENTS && CONFIG.EVENTS.THEME_CHANGE || 'theme:change', {
                mode: mode,
                isDark: _state.isDark
            });
        },

        isDark: function () {
            return _state.isDark;
        },

        setDark: function (v) {
            var b = !!v;
            if (_state.isDark === b) return;
            _state.isDark = b;
            emit(CONFIG.EVENTS && CONFIG.EVENTS.THEME_CHANGE || 'theme:change', {
                mode: _state.themeMode,
                isDark: b
            });
        }
    };

    /* ============================================================
     * 11. 通话
     * ============================================================ */
    var Call = {
        getStatus: function () {
            return _state.callStatus;
        },

        setStatus: function (status) {
            if (_state.callStatus === status) return;
            _state.callStatus = status;
            emit('call:status', status);
        },

        startTalking: function (targetId) {
            _state.callStatus = 'talking';
            _state.callStartTime = Date.now();
            _state.callTargetId = targetId || _state.currentChatId;
            emit('call:status', 'talking');
        },

        end: function () {
            var duration = _state.callStartTime
                ? Math.floor((Date.now() - _state.callStartTime) / 1000)
                : 0;
            _state.callStatus = 'idle';
            _state.callStartTime = 0;
            _state.callTargetId = null;
            emit('call:status', 'idle');
            emit('call:end', { duration: duration });
            return duration;
        },

        getDuration: function () {
            if (!_state.callStartTime) return 0;
            return Math.floor((Date.now() - _state.callStartTime) / 1000);
        },

        getTarget: function () {
            return _state.callTargetId;
        }
    };

    /* ============================================================
     * 12. 未读
     * ============================================================ */
    var Unread = {
        get: function (chatId) {
            if (!chatId) return Obj.deepClone(_state.unread);
            return _state.unread[chatId] || 0;
        },

        add: function (chatId, n) {
            if (!chatId) return;
            var cur = _state.unread[chatId] || 0;
            _state.unread[chatId] = cur + (n || 1);
            emit('unread:change', { chatId: chatId, count: _state.unread[chatId] });
        },

        set: function (chatId, n) {
            if (!chatId) return;
            _state.unread[chatId] = Math.max(0, Number(n) || 0);
            emit('unread:change', { chatId: chatId, count: _state.unread[chatId] });
        },

        clear: function (chatId) {
            if (!chatId) return;
            _state.unread[chatId] = 0;
            emit('unread:change', { chatId: chatId, count: 0 });
        },

        clearAll: function () {
            _state.unread = {};
            emit('unread:change', { chatId: null, count: 0 });
        },

        total: function () {
            var sum = 0;
            Object.keys(_state.unread).forEach(function (k) {
                sum += _state.unread[k] || 0;
            });
            return sum;
        }
    };

    /* ============================================================
     * 13. 初始化 & 对外导出
     * ============================================================ */
    function init() {
        if (_state.initialized) return;
        load();
        _state.initialized = true;
        _state.ready = true;
        Log.log('[state] 初始化完成，当前页：', _state.currentPage);
    }

    var APP_STATE = {
        // 基础
        init: init,
        get: get,
        set: set,
        update: update,
        resetKey: resetKey,
        resetAll: resetAll,

        // 持久化
        save: save,
        load: load,
        clearStorage: clearStorage,

        // 事件
        on: on,
        emit: emit,

        // 快捷子模块
        Page: Page,
        Popup: Popup,
        Connection: Connection,
        Mood: Mood,
        Theme: Theme,
        Call: Call,
        Unread: Unread,

        // 调试：查看全部
        dump: function () {
            return Obj.deepClone(_state);
        }
    };

    // 挂到全局
    global.APP_STATE = APP_STATE;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_STATE;

})(typeof window !== 'undefined' ? window : this);