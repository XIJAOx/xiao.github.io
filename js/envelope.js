/**
 * envelope.js
 * 消息信封 / 通知系统
 * 依赖：config.js / utils.js / state.js / core.js / data.js / reply-library.js
 * 被依赖：features.js / call.js / listeners.js / main.js
 *
 * 说明：
 * 1. "信封" = 一条通知的封装对象（标题、正文、图标、类型、点击行为）。
 * 2. 支持三种通知：
 *    - 应用内 toast（页面顶部小横幅）
 *    - 应用内 banner（居中弹层，可选按钮）
 *    - 系统通知（Web Notification API）
 * 3. 支持"后台通知"（页面不可见时才发）。
 * 4. 支持通知历史、未读数、去重。
 * 5. 挂到 window.APP_ENVELOPE 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};
    var REPLY = global.APP_REPLY || {};

    var Dom = UTILS.Dom;
    var Str = UTILS.Str;
    var Time = UTILS.Time;
    var Obj = UTILS.Obj;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */

    // 通知历史（内存，用于去重和展示）
    var _history = [];

    // 应用内 toast 容器
    var _toastContainer = null;

    // 应用内 banner 当前实例
    var _bannerEl = null;

    // 系统通知权限状态
    var _permission = 'default';  // 'default' | 'granted' | 'denied' | 'unsupported'

    // 后台通知是否已请求过权限
    var _permissionRequested = false;

    // 去重表：{ key: timestamp }
    var _dedupMap = {};

    /* ============================================================
     * 2. 信封结构
     * ============================================================ */

    /**
     * 创建一条信封
     * @param {object} options
     *   - title: 标题
     *   - body: 正文
     *   - icon: 图标（emoji 或 url）
     *   - type: 'system' | 'message' | 'call' | 'letter' | 'moments' | 'shop'
     *   - source: 来源（chatId 等）
     *   - data: 附加数据
     *   - onClick: 点击回调
     *   - timeout: 自动关闭毫秒数
     *   - dedupKey: 去重键
     *   - silent: 是否静默（不显示 UI，只记录）
     */
    function createEnvelope(options) {
        var opt = options || {};
        return {
            id: Str.uid('env'),
            title: opt.title || '梦角',
            body: opt.body || '',
            icon: opt.icon || '💌',
            type: opt.type || 'system',
            source: opt.source || null,
            data: opt.data || null,
            onClick: opt.onClick || null,
            timeout: opt.timeout !== undefined ? opt.timeout : 3000,
            dedupKey: opt.dedupKey || null,
            silent: !!opt.silent,
            createdAt: Date.now(),
            read: false
        };
    }

    /* ============================================================
     * 3. 去重 & 历史
     * ============================================================ */
    function _isDuplicate(key, windowMs) {
        if (!key) return false;
        var w = windowMs || 5000;
        var last = _dedupMap[key];
        if (last && (Date.now() - last) < w) return true;
        _dedupMap[key] = Date.now();
        return false;
    }

    function _pushHistory(env) {
        _history.unshift(env);
        if (_history.length > 100) _history.pop();

        // 持久化最近 50 条
        if (DATA.Settings && DATA.Settings.setOne) {
            // 不写太多，避免 localStorage 膨胀
            try {
                var brief = _history.slice(0, 20).map(function (e) {
                    return {
                        id: e.id,
                        title: e.title,
                        body: e.body,
                        type: e.type,
                        time: e.createdAt,
                        read: e.read
                    };
                });
                UTILS.Store.set('notify_history', brief);
            } catch (err) {}
        }

        if (CORE.emit) {
            CORE.emit('envelope:created', env);
        }
    }

    /* ============================================================
     * 4. 应用内 toast
     * ============================================================ */

    function _ensureToastContainer() {
        if (_toastContainer) return _toastContainer;

        var el = document.createElement('div');
        el.id = 'app-toast-container';
        el.style.cssText = [
            'position:fixed',
            'top:60px',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:99999',
            'display:flex',
            'flex-direction:column',
            'gap:8px',
            'pointer-events:none',
            'max-width:80vw'
        ].join(';');

        document.body.appendChild(el);
        _toastContainer = el;
        return el;
    }

    /**
     * 显示应用内 toast
     */
    function showToast(env) {
        if (env.silent) return;

        var container = _ensureToastContainer();

        var toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.style.cssText = [
            'background:rgba(0,0,0,0.85)',
            'color:#fff',
            'padding:10px 16px',
            'border-radius:14px',
            'font-size:14px',
            'display:flex',
            'align-items:center',
            'gap:8px',
            'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
            'pointer-events:auto',
            'opacity:0',
            'transform:translateY(-10px)',
            'transition:all 0.25s ease',
            'max-width:320px'
        ].join(';');

        var icon = document.createElement('span');
        icon.textContent = env.icon;
        icon.style.cssText = 'font-size:18px;flex-shrink:0';

        var textWrap = document.createElement('div');
        textWrap.style.cssText = 'flex:1;min-width:0';

        if (env.title) {
            var title = document.createElement('div');
            title.textContent = env.title;
            title.style.cssText = 'font-weight:600;font-size:13px;margin-bottom:2px;opacity:0.9';
            textWrap.appendChild(title);
        }
        if (env.body) {
            var body = document.createElement('div');
            body.textContent = env.body;
            body.style.cssText = 'font-size:14px;line-height:1.35;word-break:break-word';
            textWrap.appendChild(body);
        }

        toast.appendChild(icon);
        toast.appendChild(textWrap);

        // 点击行为
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', function () {
            if (env.onClick) env.onClick(env);
            _removeToast(toast);
        });

        container.appendChild(toast);

        // 入场
        requestAnimationFrame(function () {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // 自动关闭
        var timeout = env.timeout !== undefined ? env.timeout : 3000;
        if (timeout > 0) {
            setTimeout(function () {
                _removeToast(toast);
            }, timeout);
        }

        return toast;
    }

    function _removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(function () {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    /* ============================================================
     * 5. 应用内 banner（居中弹层，带按钮）
     * ============================================================ */

    /**
     * 显示一个带按钮的 banner
     * @param {object} env
     * @param {object} actions { primary: {text, onClick}, secondary: {text, onClick} }
     */
    function showBanner(env, actions) {
        if (env.silent) return;

        closeBanner();

        var mask = document.createElement('div');
        mask.className = 'app-banner-mask';
        mask.style.cssText = [
            'position:fixed',
            'top:0','left:0',
            'width:100%','height:100%',
            'background:rgba(0,0,0,0.4)',
            'z-index:99998',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:20px',
            'opacity:0',
            'transition:opacity 0.2s ease'
        ].join(';');

        var box = document.createElement('div');
        box.className = 'app-banner-box';
        box.style.cssText = [
            'background:#fff',
            'border-radius:18px',
            'padding:24px 20px',
            'width:100%',
            'max-width:340px',
            'text-align:center',
            'box-shadow:0 8px 32px rgba(0,0,0,0.18)'
        ].join(';');

        if (env.icon) {
            var iconEl = document.createElement('div');
            iconEl.textContent = env.icon;
            iconEl.style.cssText = 'font-size:42px;margin-bottom:10px';
            box.appendChild(iconEl);
        }
        if (env.title) {
            var title = document.createElement('h3');
            title.textContent = env.title;
            title.style.cssText = 'font-size:17px;font-weight:600;margin:0 0 10px';
            box.appendChild(title);
        }
        if (env.body) {
            var body = document.createElement('p');
            body.textContent = env.body;
            body.style.cssText = 'font-size:14px;color:#555;line-height:1.5;margin:0 0 20px';
            box.appendChild(body);
        }

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px';

        var btnSecondary = document.createElement('button');
        btnSecondary.textContent = (actions && actions.secondary && actions.secondary.text) || '关闭';
        btnSecondary.style.cssText = [
            'padding:12px',
            'border:none',
            'border-radius:14px',
            'background:#f4f4f4',
            'font-size:15px',
            'cursor:pointer'
        ].join(';');
        btnSecondary.addEventListener('click', function () {
            if (actions && actions.secondary && actions.secondary.onClick) {
                actions.secondary.onClick(env);
            }
            closeBanner();
        });

        var btnPrimary = document.createElement('button');
        btnPrimary.textContent = (actions && actions.primary && actions.primary.text) || '确定';
        btnPrimary.style.cssText = [
            'padding:12px',
            'border:none',
            'border-radius:14px',
            'background:#000',
            'color:#fff',
            'font-size:15px',
            'cursor:pointer'
        ].join(';');
        btnPrimary.addEventListener('click', function () {
            if (actions && actions.primary && actions.primary.onClick) {
                actions.primary.onClick(env);
            }
            closeBanner();
        });

        btnRow.appendChild(btnSecondary);
        btnRow.appendChild(btnPrimary);
        box.appendChild(btnRow);

        mask.appendChild(box);
        document.body.appendChild(mask);

        _bannerEl = mask;

        requestAnimationFrame(function () {
            mask.style.opacity = '1';
        });

        // 点击遮罩关闭
        mask.addEventListener('click', function (e) {
            if (e.target === mask) closeBanner();
        });

        return mask;
    }

    function closeBanner() {
        if (!_bannerEl) return;
        var el = _bannerEl;
        el.style.opacity = '0';
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 220);
        _bannerEl = null;
    }

    /* ============================================================
     * 6. 系统通知
     * ============================================================ */

    function _checkPermission() {
        if (!('Notification' in window)) {
            _permission = 'unsupported';
            return _permission;
        }
        _permission = Notification.permission;
        return _permission;
    }

    /**
     * 请求系统通知权限
     * @returns {Promise<string>} 'granted' | 'denied' | 'unsupported'
     */
    function requestPermission() {
        _permissionRequested = true;

        if (!('Notification' in window)) {
            _permission = 'unsupported';
            Log.warn('[envelope] 当前浏览器不支持系统通知');
            return Promise.resolve('unsupported');
        }

        if (Notification.permission === 'granted') {
            _permission = 'granted';
            return Promise.resolve('granted');
        }

        if (Notification.permission === 'denied') {
            _permission = 'denied';
            return Promise.resolve('denied');
        }

        return Notification.requestPermission()
            .then(function (p) {
                _permission = p;
                Log.log('[envelope] 系统通知权限:', p);
                return p;
            })
            .catch(function () {
                _permission = 'denied';
                return 'denied';
            });
    }

    function getPermission() {
        return _checkPermission();
    }

    /**
     * 显示系统通知
     */
    function showSystem(env) {
        if (!('Notification' in window)) return false;
        if (Notification.permission !== 'granted') return false;

        try {
            var n = new Notification(env.title, {
                body: env.body,
                icon: env.icon && env.icon.indexOf('http') === 0 ? env.icon : undefined,
                tag: env.dedupKey || env.id,
                silent: false
            });

            n.onclick = function () {
                window.focus();
                if (env.onClick) env.onClick(env);
                n.close();
            };

            if (env.timeout > 0) {
                setTimeout(function () { n.close(); }, env.timeout);
            }

            return true;
        } catch (e) {
            Log.error('[envelope] 系统通知失败:', e);
            return false;
        }
    }

    /* ============================================================
     * 7. 后台通知开关
     * ============================================================ */

    function _isBackgroundNotifyEnabled() {
        var s = DATA.Settings ? DATA.Settings.get() : {};
        return !!(s.notify && s.notify.enabled);
    }

    function isDocumentHidden() {
        return document.hidden || document.visibilityState === 'hidden';
    }

    /* ============================================================
     * 8. 主入口：发送通知
     * ============================================================ */

    /**
     * 发送一条通知
     * @param {object} options 见 createEnvelope
     * @param {object} opts { mode: 'auto' | 'toast' | 'banner' | 'system', actions }
     * @returns {object} envelope
     */
    function notify(options, opts) {
        opts = opts || {};

        var env = createEnvelope(options);

        // 去重
        if (env.dedupKey && _isDuplicate(env.dedupKey)) {
            Log.log('[envelope] 去重跳过:', env.dedupKey);
            return env;
        }

        // 记录历史
        _pushHistory(env);

        // 静默
        if (env.silent) return env;

        var mode = opts.mode || 'auto';

        // auto 模式：页面隐藏 + 开了后台通知 → 系统通知；否则 toast
        if (mode === 'auto') {
            if (isDocumentHidden() && _isBackgroundNotifyEnabled() && _permission === 'granted') {
                mode = 'system';
            } else {
                mode = 'toast';
            }
        }

        if (mode === 'toast') {
            showToast(env);
        } else if (mode === 'banner') {
            showBanner(env, opts.actions);
        } else if (mode === 'system') {
            var ok = showSystem(env);
            if (!ok) showToast(env);  // 系统通知失败回退到 toast
        }

        return env;
    }

    /* ============================================================
     * 9. 业务快捷方法
     * ============================================================ */

    /**
     * 新消息通知
     */
    function notifyMessage(chat, msg) {
        if (!msg) return;
        var name = (chat && chat.name) || 'TA';
        var preview = msg.text || msg.content || '[新消息]';

        return notify({
            title: name,
            body: Str.truncate(preview, 30),
            icon: '💬',
            type: 'message',
            source: (chat && chat.id) || null,
            data: msg,
            dedupKey: 'msg_' + ((chat && chat.id) || '') + '_' + (msg.id || ''),
            onClick: function () {
                if (CORE.showPage) CORE.showPage('chatRoom');
            }
        });
    }

    /**
     * 来电通知
     */
    function notifyCallIn(character) {
        var name = (character && character.name) || 'TA';
        return notify({
            title: '语音通话',
            body: name + ' 来电',
            icon: '📞',
            type: 'call',
            source: (character && character.id) || null,
            timeout: 8000,
            dedupKey: 'callin_' + ((character && character.id) || 'ta'),
            onClick: function () {
                if (CORE.openPopup) CORE.openPopup('callIn');
            }
        });
    }

    /**
     * 收到信通知
     */
    function notifyLetter(letter) {
        return notify({
            title: '收到一封信',
            body: (letter && letter.title) || 'TA 给你写了一封信',
            icon: '💌',
            type: 'letter',
            data: letter,
            dedupKey: 'letter_' + ((letter && letter.id) || ''),
            onClick: function () {
                if (CORE.showPage) CORE.showPage('letterPage');
            }
        });
    }

    /**
     * 朋友圈通知
     */
    function notifyMoments(post) {
        return notify({
            title: '朋友圈',
            body: (post && post.text) ? Str.truncate(post.text, 30) : '有新动态',
            icon: '🌤',
            type: 'moments',
            data: post,
            dedupKey: 'moment_' + ((post && post.id) || ''),
            onClick: function () {
                if (CORE.showPage) CORE.showPage('momentsPage');
            }
        });
    }

    /**
     * 商城订单通知
     */
    function notifyOrder(order, text) {
        return notify({
            title: '商城',
            body: text || '订单状态有更新',
            icon: '📦',
            type: 'shop',
            data: order,
            onClick: function () {
                if (CORE.showPage) CORE.showPage('orderPage');
            }
        });
    }

    /**
     * 通用系统提示
     */
    function tip(text, icon) {
        return notify({
            title: '',
            body: text,
            icon: icon || '💡',
            type: 'system',
            timeout: 2000
        });
    }

    /* ============================================================
     * 10. 通知历史
     * ============================================================ */

    function getHistory(n) {
        if (n) return _history.slice(0, n);
        return _history.slice();
    }

    function getUnreadCount() {
        return _history.filter(function (e) { return !e.read; }).length;
    }

    function markAllRead() {
        _history.forEach(function (e) { e.read = true; });
        if (CORE.emit) CORE.emit('envelope:readAll', {});
    }

    function markRead(id) {
        var env = Obj.findById(_history, id);
        if (env) {
            env.read = true;
            if (CORE.emit) CORE.emit('envelope:read', env);
        }
    }

    function clearHistory() {
        _history = [];
        UTILS.Store.remove('notify_history');
        if (CORE.emit) CORE.emit('envelope:cleared', {});
    }

    /* ============================================================
     * 11. 测试
     * ============================================================ */

    /**
     * 测试通知（对应设置页「后台通知」弹窗里的"测试"按钮）
     */
    function testNotify() {
        return notify({
            title: '测试通知',
            body: '这是一条测试消息，收到就说明通知正常',
            icon: '🔔',
            type: 'system',
            timeout: 4000
        });
    }

    /* ============================================================
     * 12. 初始化
     * ============================================================ */

    function init() {
        // 读权限状态
        _checkPermission();

        // 恢复历史
        var saved = UTILS.Store.get('notify_history');
        if (Array.isArray(saved)) {
            _history = saved.map(function (e) {
                e.createdAt = e.time || e.createdAt || Date.now();
                e.icon = e.icon || '💌';
                return e;
            });
        }

        // 页面可见性变化
        document.addEventListener('visibilitychange', function () {
            if (!isDocumentHidden()) {
                // 回到前台：关掉 banner
                closeBanner();
                if (CORE.emit) CORE.emit('app:visible', {});
            } else {
                if (CORE.emit) CORE.emit('app:hidden', {});
            }
        });

        // 如果用户开了后台通知，自动请求一次权限
        if (_isBackgroundNotifyEnabled() && _permission === 'default' && !_permissionRequested) {
            // 延迟请求，避免刚打开就弹权限框
            setTimeout(function () {
                requestPermission();
            }, 3000);
        }

        Log.log('[envelope] 初始化完成，权限:', _permission);
    }

    /* ============================================================
     * 13. 对外导出
     * ============================================================ */
    var APP_ENVELOPE = {
        init: init,

        // 底层
        create: createEnvelope,
        notify: notify,
        tip: tip,

        // 展示方式
        showToast: showToast,
        showBanner: showBanner,
        closeBanner: closeBanner,
        showSystem: showSystem,

        // 权限
        requestPermission: requestPermission,
        getPermission: getPermission,

        // 业务快捷
        notifyMessage: notifyMessage,
        notifyCallIn: notifyCallIn,
        notifyLetter: notifyLetter,
        notifyMoments: notifyMoments,
        notifyOrder: notifyOrder,

        // 历史
        getHistory: getHistory,
        getUnreadCount: getUnreadCount,
        markRead: markRead,
        markAllRead: markAllRead,
        clearHistory: clearHistory,

        // 测试
        testNotify: testNotify
    };

    // 挂到全局
    global.APP_ENVELOPE = APP_ENVELOPE;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_ENVELOPE;

})(typeof window !== 'undefined' ? window : this);