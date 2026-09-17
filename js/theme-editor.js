/**
 * theme-editor.js
 * 主题编辑器：深色模式 / 气泡 / 文字 / 头像 / 聊天背景 / 已读时间戳
 * 依赖：config / utils / state / core / data
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 所有视觉设置都从这里读写。
 * 2. 用 CSS 变量 + 动态 <style> 注入实现。
 * 3. 深色模式会挂 data-theme 属性到 <html>。
 * 4. 挂到 window.APP_THEME_EDITOR 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};

    var Dom = UTILS.Dom;
    var Str = UTILS.Str;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};
    var DEFAULT_THEME = CONFIG.DEFAULT_THEME || {};

    // 动态样式表 id
    var STYLE_ID = 'app-theme-dynamic';
    // CSS 变量挂载的根元素
    var ROOT = document.documentElement;

    // 媒体查询监听
    var _mediaDark = null;

    /* ============================================================
     * 1. 工具
     * ============================================================ */
    function _emit(event, payload) {
        if (CORE.emit) CORE.emit(event, payload);
    }

    // 确保动态 style 标签存在
    function _ensureStyleTag() {
        var el = document.getElementById(STYLE_ID);
        if (el) return el;
        el = document.createElement('style');
        el.id = STYLE_ID;
        document.head.appendChild(el);
        return el;
    }

    // 设置/更新 CSS 变量
    function _setVar(name, value) {
        if (value === undefined || value === null) {
            ROOT.style.removeProperty(name);
        } else {
            ROOT.style.setProperty(name, value);
        }
    }

    // 读取当前主题
    function _getTheme() {
        return DATA.Theme.get();
    }

    /* ============================================================
     * 2. 应用全部主题
     * ============================================================ */
    function apply() {
        var t = _getTheme();

        applyDarkMode(t.mode);
        applyChatBubble(t);
        applyChatText(t);
        applyAvatar(t);
        applyChatBg(t);

        Log.log('[theme-editor] 已应用主题:', t.mode);
    }

    /* ============================================================
     * 3. 深色模式
     * ============================================================ */

    /**
     * 判断当前是否应该是深色
     */
    function _shouldBeDark(mode) {
        if (mode === 'dark') return true;
        if (mode === 'light') return false;
        // system
        if (UTILS.System && UTILS.System.prefersDark) {
            return UTILS.System.prefersDark();
        }
        return false;
    }

    /**
     * 应用深色模式
     * @param {string} mode 'system' | 'dark' | 'light'
     */
    function applyDarkMode(mode) {
        var isDark = _shouldBeDark(mode);
        ROOT.setAttribute('data-theme', isDark ? 'dark' : 'light');
        ROOT.classList.toggle('dark', isDark);

        // 同步 state
        if (STATE.Theme) STATE.Theme.setDark(isDark);

        // 让 body 也能用
        document.body.classList.toggle('dark', isDark);

        _emit('theme:applyDark', { mode: mode, isDark: isDark });
        _emit(EVENTS.THEME_CHANGE || 'theme:change', { mode: mode, isDark: isDark });

        // 注入深色基础样式
        _injectDarkBase(isDark);
    }

    /**
     * 注入深色基础样式（用 CSS 变量方式）
     */
    function _injectDarkBase(isDark) {
        if (!isDark) {
            _setVar('--bg-app', '#ffffff');
            _setVar('--bg-card', '#f8f8f8');
            _setVar('--text-main', '#000000');
            _setVar('--text-sub', '#666666');
            _setVar('--text-light', '#999999');
            _setVar('--border-color', '#f1f1f1');
            return;
        }

        _setVar('--bg-app', '#0f0f10');
        _setVar('--bg-card', '#1c1c1e');
        _setVar('--text-main', '#f2f2f2');
        _setVar('--text-sub', '#a8a8a8');
        _setVar('--text-light', '#6e6e70');
        _setVar('--border-color', '#2a2a2c');
    }

    /**
     * 监听系统深色变化（只有当 mode === 'system' 时才响应）
     */
    function startWatchSystemDark() {
        if (_mediaDark) return;
        if (!window.matchMedia) return;

        _mediaDark = window.matchMedia('(prefers-color-scheme: dark)');
        var handler = function () {
            var t = _getTheme();
            if (t.mode === 'system') {
                applyDarkMode('system');
            }
        };

        if (_mediaDark.addEventListener) {
            _mediaDark.addEventListener('change', handler);
        } else if (_mediaDark.addListener) {
            _mediaDark.addListener(handler);
        }
    }

    function stopWatchSystemDark() {
        if (!_mediaDark) return;
        _mediaDark = null;
    }

    /**
     * 设置深色模式
     */
    function setDarkMode(mode) {
        if (['system', 'dark', 'light'].indexOf(mode) === -1) {
            mode = 'system';
        }
        DATA.Theme.patch({ mode: mode });
        DATA.Settings.setOne('darkMode', mode);
        applyDarkMode(mode);
        return mode;
    }

    function getDarkMode() {
        return _getTheme().mode || 'system';
    }

    /* ============================================================
     * 4. 气泡设置
     * ============================================================ */

    /**
     * @param {object} t 主题对象
     */
    function applyChatBubble(t) {
        var bubbleSize = t.bubbleSize || 14;
        var bubbleRadius = t.bubbleRadius || 15;
        var colorSelf = t.bubbleColorSelf || '#000000';
        var colorOther = t.bubbleColorOther || '#ffffff';

        _setVar('--bubble-size', bubbleSize + 'px');
        _setVar('--bubble-radius', bubbleRadius + 'px');
        _setVar('--bubble-self-bg', colorSelf);
        _setVar('--bubble-other-bg', colorOther);

        // 自动对比文字颜色
        var textSelf = UTILS.Color ? UTILS.Color.contrastText(colorSelf) : '#ffffff';
        var textOther = UTILS.Color ? UTILS.Color.contrastText(colorOther) : '#000000';
        _setVar('--bubble-self-color', textSelf);
        _setVar('--bubble-other-color', textOther);

        // 直接改写样式
        var style = _ensureStyleTag();
        var css = '';

        css += '.bubble-self{background:' + colorSelf + '!important;color:' + textSelf + '!important;'
             + 'border-radius:' + bubbleRadius + 'px!important;padding:10px ' + Math.max(10, bubbleRadius - 2) + 'px!important;}\n';
        css += '.bubble-other{background:' + colorOther + '!important;color:' + textOther + '!important;'
             + 'border-radius:' + bubbleRadius + 'px!important;padding:10px ' + Math.max(10, bubbleRadius - 2) + 'px!important;}\n';
        css += '.msg-bubble .bubble-text{font-size:' + bubbleSize + 'px!important;line-height:1.4;}\n';

        // 保留已有的自定义 CSS（用标记分隔）
        var custom = style.getAttribute('data-custom') || '';
        style.textContent = css + '\n/* custom */\n' + custom;
    }

    /**
     * 保存气泡设置
     * @param {object} patch
     */
    function setBubble(patch) {
        DATA.Theme.patch(patch);
        apply();
        _emit('theme:applyBubble', patch);
    }

    /* ============================================================
     * 5. 文字设置
     * ============================================================ */
    function applyChatText(t) {
        var textSize = t.textSize || 14;

        _setVar('--chat-text-size', textSize + 'px');

        var style = _ensureStyleTag();
        var css = '.msg-bubble .bubble-text{font-size:' + textSize + 'px!important;}\n';

        // 追加，不覆盖气泡的样式
        style.textContent += '\n' + css;
    }

    /**
     * 保存文字设置
     */
    function setText(patch) {
        DATA.Theme.patch(patch);
        apply();
    }

    /* ============================================================
     * 6. 头像设置
     * ============================================================ */
    function applyAvatar(t) {
        var shape = t.avatarShape || 'circle';
        var size = t.avatarSize || 38;

        var radius = shape === 'square' ? '20%' : '50%';

        var style = _ensureStyleTag();
        var css = '';
        css += '.avatar{border-radius:' + radius + '!important;}\n';
        css += '.avatar-ta-small,.avatar-me-small{width:' + size + 'px!important;height:' + size + 'px!important;}\n';

        style.textContent += '\n' + css;
    }

    function setAvatar(patch) {
        DATA.Theme.patch(patch);
        apply();
    }

    /* ============================================================
     * 7. 聊天背景
     * ============================================================ */
    function applyChatBg(t) {
        var bg = t.chatBg || '#ffffff';
        var bgImage = t.chatBgImage || '';

        _setVar('--chat-bg', bg);

        var style = _ensureStyleTag();
        var css = '.chat-message-container{background:' + bg + '!important;';

        if (bgImage) {
            if (bgImage.indexOf('http') === 0 || bgImage.indexOf('data:') === 0) {
                css += 'background-image:url(' + bgImage + ')!important;'
                    + 'background-size:cover!important;'
                    + 'background-position:center!important;';
            }
        }
        css += '}\n';

        style.textContent += '\n' + css;
    }

    function setChatBg(patch) {
        DATA.Theme.patch(patch);
        apply();
    }

    /* ============================================================
     * 8. 时间戳 / 已读
     * ============================================================ */
    function applyReadTime() {
        var s = DATA.Settings.getOne('chat') || {};
        var showTime = s.showTimestamp !== false;
        var showRead = !!s.showReadStatus;

        var style = _ensureStyleTag();
        var css = '';
        css += '.msg-time{display:' + (showTime ? 'inline' : 'none') + '!important;}\n';
        css += '.read-status{display:' + (showRead ? 'inline' : 'none') + '!important;}\n';

        style.textContent += '\n' + css;
    }

    function setReadTime(patch) {
        var s = DATA.Settings.getOne('chat') || {};
        if (patch.showTimestamp !== undefined) s.showTimestamp = patch.showTimestamp;
        if (patch.showReadStatus !== undefined) s.showReadStatus = patch.showReadStatus;
        DATA.Settings.setOne('chat', s);
        applyReadTime();
    }

    /* ============================================================
     * 9. 自定义 CSS（用户上传或粘贴）
     * ============================================================ */

    /**
     * 设置自定义 CSS（覆盖式）
     * @param {string} css
     */
    function setCustomCSS(css) {
        var style = _ensureStyleTag();
        style.setAttribute('data-custom', css || '');
        // 重新应用，把自定义 CSS 放到末尾
        apply();
        Log.log('[theme-editor] 自定义 CSS 已更新，长度：', (css || '').length);
    }

    /**
     * 从链接加载 CSS
     */
    function loadCSSFromUrl(url) {
        return new Promise(function (resolve, reject) {
            if (!url) return reject(new Error('URL 为空'));
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = function () { resolve(true); };
            link.onerror = function () { reject(new Error('加载失败')); };
            document.head.appendChild(link);
        });
    }

    /**
     * 从文件读取 CSS
     */
    function loadCSSFromFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error('没有文件'));
            var reader = new FileReader();
            reader.onload = function (e) {
                var css = e.target.result || '';
                setCustomCSS(css);
                resolve(css);
            };
            reader.onerror = function () { reject(new Error('读取失败')); };
            reader.readAsText(file, 'utf-8');
        });
    }

    /* ============================================================
     * 10. 从弹窗读取
     * ============================================================ */

    /**
     * 从气泡设置弹窗保存
     */
    function saveFromBubblePopup() {
        var box = document.querySelector('.popup-bubble-setting');
        if (!box) return;

        var inputs = box.querySelectorAll('input[type="number"]');
        var urlInput = box.querySelector('input[type="text"]');
        var textarea = box.querySelector('textarea');
        var colorBlocks = box.querySelectorAll('.color-block');

        var patch = {};
        if (inputs[0]) patch.bubbleSize = Number(inputs[0].value) || 14;
        if (inputs[1]) patch.bubbleRadius = Number(inputs[1].value) || 15;

        // 选中的颜色（如果有 active 样式）
        var selected = box.querySelector('.color-block.active');
        if (selected) {
            var bg = getComputedStyle(selected).backgroundColor;
            patch.bubbleColorSelf = rgbToHex(bg);
        }

        if (urlInput && urlInput.value) {
            loadCSSFromUrl(urlInput.value.trim()).catch(function () {});
        }
        if (textarea && textarea.value) {
            setCustomCSS(textarea.value);
        }

        setBubble(patch);
    }

    /**
     * 从文字设置弹窗保存
     */
    function saveFromTextPopup() {
        var box = document.querySelector('.popup-text-setting');
        if (!box) return;

        var input = box.querySelector('input[type="number"]');
        var urlInput = box.querySelector('input[type="text"]');
        var textarea = box.querySelector('textarea');

        var patch = {};
        if (input) patch.textSize = Number(input.value) || 14;

        if (urlInput && urlInput.value) {
            loadCSSFromUrl(urlInput.value.trim()).catch(function () {});
        }
        if (textarea && textarea.value) {
            setCustomCSS(textarea.value);
        }

        setText(patch);
    }

    /**
     * 从头像设置弹窗保存
     */
    function saveFromAvatarPopup() {
        var box = document.querySelector('.popup-avatar-setting');
        if (!box) return;

        var shapeBtn = box.querySelector('.shape-btn.active');
        var input = box.querySelector('input[type="number"]');

        var patch = {};
        if (shapeBtn) {
            patch.avatarShape = shapeBtn.textContent.indexOf('方') > -1 ? 'square' : 'circle';
        }
        if (input) patch.avatarSize = Number(input.value) || 38;

        setAvatar(patch);
    }

    /**
     * 从背景设置弹窗保存
     */
    function saveFromBgPopup() {
        var box = document.querySelector('.popup-bg-setting');
        if (!box) return;

        var selected = box.querySelector('.color-block.active');
        var patch = {};
        if (selected) {
            var bg = getComputedStyle(selected).backgroundColor;
            patch.chatBg = rgbToHex(bg);
        }
        setChatBg(patch);
    }

    /**
     * 从深色模式弹窗保存
     */
    function saveFromDarkPopup() {
        var box = document.querySelector('.popup-dark-mode');
        if (!box) return;
        var checked = box.querySelector('input[type="radio"]:checked');
        if (!checked) return;

        // radio 的顺序：跟随系统 / 黑色 / 白色
        var radios = box.querySelectorAll('input[type="radio"]');
        var idx = Array.prototype.indexOf.call(radios, checked);
        var mode = ['system', 'dark', 'light'][idx] || 'system';
        setDarkMode(mode);
    }

    /* ============================================================
     * 11. 工具：rgb → hex
     * ============================================================ */
    function rgbToHex(rgb) {
        if (!rgb) return '#000000';
        if (rgb.indexOf('#') === 0) return rgb;

        var m = rgb.match(/\d+/g);
        if (!m || m.length < 3) return '#000000';

        var r = parseInt(m[0], 10);
        var g = parseInt(m[1], 10);
        var b = parseInt(m[2], 10);

        if (UTILS.Color && UTILS.Color.rgbToHex) {
            return UTILS.Color.rgbToHex(r, g, b);
        }
        return '#' + [r, g, b].map(function (v) {
            var s = v.toString(16);
            return s.length === 1 ? '0' + s : s;
        }).join('');
    }

    /* ============================================================
     * 12. 重置
     * ============================================================ */
    function reset() {
        DATA.Theme.save(DEFAULT_THEME);
        apply();
        _emit('theme:reset', {});
        Log.log('[theme-editor] 已重置主题');
    }

    /* ============================================================
     * 13. 初始化
     * ============================================================ */
    function init() {
        // 立刻应用一次
        apply();
        applyReadTime();
        startWatchSystemDark();

        Log.log('[theme-editor] 初始化完成');
    }

    /* ============================================================
     * 14. 对外导出
     * ============================================================ */
    var APP_THEME_EDITOR = {
        init: init,
        apply: apply,
        reset: reset,

        // 深色
        applyDarkMode: applyDarkMode,
        setDarkMode: setDarkMode,
        getDarkMode: getDarkMode,
        startWatchSystemDark: startWatchSystemDark,
        stopWatchSystemDark: stopWatchSystemDark,

        // 气泡
        applyChatBubble: applyChatBubble,
        setBubble: setBubble,

        // 文字
        applyChatText: applyChatText,
        setText: setText,

        // 头像
        applyAvatar: applyAvatar,
        setAvatar: setAvatar,

        // 背景
        applyChatBg: applyChatBg,
        setChatBg: setChatBg,

        // 时间戳 / 已读
        applyReadTime: applyReadTime,
        setReadTime: setReadTime,

        // 自定义 CSS
        setCustomCSS: setCustomCSS,
        loadCSSFromUrl: loadCSSFromUrl,
        loadCSSFromFile: loadCSSFromFile,

        // 从弹窗读取
        saveFromBubblePopup: saveFromBubblePopup,
        saveFromTextPopup: saveFromTextPopup,
        saveFromAvatarPopup: saveFromAvatarPopup,
        saveFromBgPopup: saveFromBgPopup,
        saveFromDarkPopup: saveFromDarkPopup,

        // 工具
        rgbToHex: rgbToHex
    };

    global.APP_THEME_EDITOR = APP_THEME_EDITOR;

})(typeof window !== 'undefined' ? window : this);