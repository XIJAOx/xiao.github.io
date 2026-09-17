/**
 * utils.js
 * 通用工具库
 * 依赖：config.js（可选，用 window.APP_CONFIG）
 * 被依赖：几乎所有模块
 *
 * 说明：
 * 1. 只放纯函数和无状态工具，不碰业务逻辑。
 * 2. 挂到 window.APP_UTILS 上，供普通 script 引用。
 * 3. 后续如果改用 ES Module，取消文件末尾的 export。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};

    /* ============================================================
     * 1. 类型判断
     * ============================================================ */
    var Type = {
        isString: function (v) {
            return typeof v === 'string';
        },
        isNumber: function (v) {
            return typeof v === 'number' && !isNaN(v);
        },
        isBoolean: function (v) {
            return typeof v === 'boolean';
        },
        isFunction: function (v) {
            return typeof v === 'function';
        },
        isArray: function (v) {
            return Array.isArray(v);
        },
        isObject: function (v) {
            return v !== null && typeof v === 'object' && !Array.isArray(v);
        },
        isNull: function (v) {
            return v === null;
        },
        isUndefined: function (v) {
            return v === undefined;
        },
        isEmpty: function (v) {
            if (v === null || v === undefined) return true;
            if (typeof v === 'string') return v.trim() === '';
            if (Array.isArray(v)) return v.length === 0;
            if (typeof v === 'object') return Object.keys(v).length === 0;
            return false;
        },
        // 是否是有效的 DOM 元素
        isElement: function (v) {
            return v instanceof HTMLElement;
        },
        // 是否是类数组 / NodeList
        isNodeList: function (v) {
            return v instanceof NodeList || v instanceof HTMLCollection;
        }
    };

    /* ============================================================
     * 2. DOM 操作
     * ============================================================ */
    var Dom = {
        // 查询单个
        qs: function (selector, parent) {
            return (parent || document).querySelector(selector);
        },
        // 查询多个，返回真数组
        qsa: function (selector, parent) {
            return Array.prototype.slice.call(
                (parent || document).querySelectorAll(selector)
            );
        },
        // 按 id 查询
        id: function (id) {
            return document.getElementById(id);
        },
        // 创建元素
        create: function (tag, className, innerHTML) {
            var el = document.createElement(tag);
            if (className) el.className = className;
            if (innerHTML !== undefined) el.innerHTML = innerHTML;
            return el;
        },
        // 添加类
        addClass: function (el, className) {
            if (!el) return;
            var names = className.split(/\s+/);
            names.forEach(function (n) {
                if (n) el.classList.add(n);
            });
        },
        // 移除类
        removeClass: function (el, className) {
            if (!el) return;
            var names = className.split(/\s+/);
            names.forEach(function (n) {
                if (n) el.classList.remove(n);
            });
        },
        // 切换类
        toggleClass: function (el, className, force) {
            if (!el) return;
            if (force === undefined) {
                el.classList.toggle(className);
            } else {
                el.classList.toggle(className, force);
            }
        },
        // 是否包含类
        hasClass: function (el, className) {
            return el ? el.classList.contains(className) : false;
        },
        // 设置/获取属性
        attr: function (el, name, value) {
            if (!el) return;
            if (value === undefined) {
                return el.getAttribute(name);
            }
            el.setAttribute(name, value);
        },
        // 设置/获取 data-*
        data: function (el, name, value) {
            if (!el) return;
            if (value === undefined) {
                return el.dataset[name];
            }
            el.dataset[name] = value;
        },
        // 设置样式
        css: function (el, prop, value) {
            if (!el) return;
            if (Type.isObject(prop)) {
                Object.keys(prop).forEach(function (k) {
                    el.style[k] = prop[k];
                });
            } else {
                el.style[prop] = value;
            }
        },
        // 设置文本
        text: function (el, value) {
            if (!el) return;
            if (value === undefined) return el.textContent;
            el.textContent = value;
        },
        // 设置 HTML
        html: function (el, value) {
            if (!el) return;
            if (value === undefined) return el.innerHTML;
            el.innerHTML = value;
        },
        // 显示
        show: function (el) {
            if (!el) return;
            el.style.display = '';
        },
        // 隐藏
        hide: function (el) {
            if (!el) return;
            el.style.display = 'none';
        },
        // 清空子元素
        empty: function (el) {
            if (!el) return;
            el.innerHTML = '';
        },
        // 移除自身
        remove: function (el) {
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
            }
        },
        // 追加子元素
        append: function (parent, child) {
            if (!parent || !child) return;
            parent.appendChild(child);
        },
        // 事件绑定
        on: function (el, event, handler, options) {
            if (!el || !event || !handler) return;
            el.addEventListener(event, handler, options || false);
        },
        // 事件解绑
        off: function (el, event, handler, options) {
            if (!el || !event || !handler) return;
            el.removeEventListener(event, handler, options || false);
        },
        // 事件委托
        delegate: function (parent, selector, event, handler) {
            if (!parent) return;
            parent.addEventListener(event, function (e) {
                var target = e.target;
                while (target && target !== parent) {
                    if (target.matches && target.matches(selector)) {
                        handler.call(target, e, target);
                        return;
                    }
                    target = target.parentNode;
                }
            });
        },
        // 触发自定义事件
        trigger: function (el, eventName, detail) {
            if (!el) return;
            var evt;
            try {
                evt = new CustomEvent(eventName, { detail: detail });
            } catch (err) {
                evt = document.createEvent('CustomEvent');
                evt.initCustomEvent(eventName, true, true, detail);
            }
            el.dispatchEvent(evt);
        },
        // 滚动到底部
        scrollToBottom: function (el) {
            if (!el) return;
            el.scrollTop = el.scrollHeight;
        },
        // 滚动到顶部
        scrollToTop: function (el) {
            if (!el) return;
            el.scrollTop = 0;
        }
    };

    /* ============================================================
     * 3. 存储（localStorage 封装）
     * ============================================================ */
    var Store = {
        // 前缀
        prefix: CONFIG.STORAGE_PREFIX || 'app_',

        // 生成带前缀的 key
        key: function (k) {
            if (k.indexOf(this.prefix) === 0) return k;
            return this.prefix + k;
        },

        // 存
        set: function (k, value) {
            try {
                var v = JSON.stringify(value);
                localStorage.setItem(this.key(k), v);
                return true;
            } catch (e) {
                console.warn('[Store] set 失败:', k, e);
                return false;
            }
        },

        // 取
        get: function (k, defaultValue) {
            try {
                var v = localStorage.getItem(this.key(k));
                if (v === null) return defaultValue !== undefined ? defaultValue : null;
                return JSON.parse(v);
            } catch (e) {
                console.warn('[Store] get 失败:', k, e);
                return defaultValue !== undefined ? defaultValue : null;
            }
        },

        // 删
        remove: function (k) {
            try {
                localStorage.removeItem(this.key(k));
                return true;
            } catch (e) {
                return false;
            }
        },

        // 清空所有本应用的前缀 key
        clearAll: function () {
            try {
                var keys = [];
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(this.prefix) === 0) {
                        keys.push(k);
                    }
                }
                keys.forEach(function (k) {
                    localStorage.removeItem(k);
                });
                return true;
            } catch (e) {
                return false;
            }
        },

        // 是否支持 localStorage
        isSupported: function () {
            try {
                var t = '__test__';
                localStorage.setItem(t, t);
                localStorage.removeItem(t);
                return true;
            } catch (e) {
                return false;
            }
        },

        // 计算某个 key 的字节数（粗略估算）
        sizeOf: function (k) {
            try {
                var v = localStorage.getItem(this.key(k));
                if (!v) return 0;
                return new Blob([v]).size;
            } catch (e) {
                return 0;
            }
        },

        // 计算全部本应用 key 的总字节数
        sizeAll: function () {
            var total = 0;
            var self = this;
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (k && k.indexOf(this.prefix) === 0) {
                        total += self.sizeOf(k);
                    }
                }
            } catch (e) {}
            return total;
        }
    };

    /* ============================================================
     * 4. 时间工具
     * ============================================================ */
    var Time = {
        // 补零
        pad: function (n) {
            return n < 10 ? '0' + n : '' + n;
        },

        // 当前时间戳
        now: function () {
            return Date.now();
        },

        // 格式化日期 YYYY-MM-DD
        formatDate: function (date) {
            var d = date ? new Date(date) : new Date();
            return d.getFullYear() + '-' + this.pad(d.getMonth() + 1) + '-' + this.pad(d.getDate());
        },

        // 格式化时间 HH:mm
        formatTime: function (date) {
            var d = date ? new Date(date) : new Date();
            return this.pad(d.getHours()) + ':' + this.pad(d.getMinutes());
        },

        // 格式化完整时间 YYYY-MM-DD HH:mm:ss
        formatFull: function (date) {
            var d = date ? new Date(date) : new Date();
            return this.formatDate(d) + ' ' + this.formatTime(d) + ':' + this.pad(d.getSeconds());
        },

        // 格式化 HH:mm:ss
        formatHMS: function (seconds) {
            var s = Math.max(0, Math.floor(seconds));
            var h = Math.floor(s / 3600);
            var m = Math.floor((s % 3600) / 60);
            var sec = s % 60;
            if (h > 0) {
                return this.pad(h) + ':' + this.pad(m) + ':' + this.pad(sec);
            }
            return this.pad(m) + ':' + this.pad(sec);
        },

        // 相对时间（刚刚 / x分钟前 / x小时前 / x天前 / 日期）
        fromNow: function (ts) {
            var diff = Date.now() - Number(ts);
            if (diff < 0) diff = 0;
            var sec = Math.floor(diff / 1000);
            var min = Math.floor(sec / 60);
            var hour = Math.floor(min / 60);
            var day = Math.floor(hour / 24);

            if (sec < 30) return '刚刚';
            if (sec < 60) return sec + '秒前';
            if (min < 60) return min + '分钟前';
            if (hour < 24) return hour + '小时前';
            if (day < 7) return day + '天前';
            return this.formatDate(ts);
        },

        // 聊天时间显示：今天显示 HH:mm，昨天显示 昨天 HH:mm，更早显示 MM-DD HH:mm
        chatTime: function (ts) {
            var d = new Date(ts);
            var now = new Date();
            var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            var yesterdayStart = todayStart - 86400000;

            if (ts >= todayStart) {
                return this.formatTime(d);
            }
            if (ts >= yesterdayStart) {
                return '昨天 ' + this.formatTime(d);
            }
            return this.pad(d.getMonth() + 1) + '-' + this.pad(d.getDate()) + ' ' + this.formatTime(d);
        },

        // 是否同一天
        isSameDay: function (t1, t2) {
            return this.formatDate(t1) === this.formatDate(t2);
        },

        // 是否今天
        isToday: function (ts) {
            return this.formatDate(ts) === this.formatDate();
        },

        // 获取某月天数
        daysInMonth: function (year, month) {
            return new Date(year, month, 0).getDate();
        },

        // 获取某月第一天是星期几（0=周日）
        firstDayOfMonth: function (year, month) {
            return new Date(year, month - 1, 1).getDay();
        },

        // 睡眠
        sleep: function (ms) {
            return new Promise(function (resolve) {
                setTimeout(resolve, ms);
            });
        }
    };

    /* ============================================================
     * 5. 字符串工具
     * ============================================================ */
    var Str = {
        // 生成随机 ID
        uid: function (prefix) {
            var p = prefix || 'id';
            return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        },

        // 生成 UUID（简易版）
        uuid: function () {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (Math.random() * 16) | 0;
                var v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
        },

        // 截断
        truncate: function (str, len, suffix) {
            if (!str) return '';
            var s = String(str);
            if (s.length <= len) return s;
            return s.slice(0, len) + (suffix !== undefined ? suffix : '...');
        },

        // 转义 HTML
        escapeHtml: function (str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        // 去掉首尾空格
        trim: function (str) {
            return str == null ? '' : String(str).trim();
        },

        // 是否包含子串（不区分大小写）
        contains: function (str, sub) {
            if (!str || !sub) return false;
            return String(str).toLowerCase().indexOf(String(sub).toLowerCase()) !== -1;
        },

        // 首字母大写
        capitalize: function (str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },

        // 反序列化安全 JSON
        safeJson: function (str, defaultValue) {
            try {
                return JSON.parse(str);
            } catch (e) {
                return defaultValue !== undefined ? defaultValue : null;
            }
        },

        // 模板字符串替换 {name}
        template: function (tpl, data) {
            if (!tpl) return '';
            return tpl.replace(/\{(\w+)\}/g, function (m, key) {
                return data && data[key] !== undefined ? data[key] : '';
            });
        }
    };

    /* ============================================================
     * 6. 数组 / 对象工具
     * ============================================================ */
    var Obj = {
        // 深拷贝
        deepClone: function (obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (Array.isArray(obj)) {
                return obj.map(function (item) {
                    return Obj.deepClone(item);
                });
            }
            var cloned = {};
            Object.keys(obj).forEach(function (k) {
                cloned[k] = Obj.deepClone(obj[k]);
            });
            return cloned;
        },

        // 合并对象（浅合并，后面覆盖前面）
        assign: function (target) {
            var sources = Array.prototype.slice.call(arguments, 1);
            sources.forEach(function (src) {
                if (!src) return;
                Object.keys(src).forEach(function (k) {
                    target[k] = src[k];
                });
            });
            return target;
        },

        // 深合并
        deepMerge: function (target, source) {
            if (!Type.isObject(target)) target = {};
            if (!Type.isObject(source)) return target;

            Object.keys(source).forEach(function (k) {
                var sv = source[k];
                if (Type.isObject(sv) && Type.isObject(target[k])) {
                    Obj.deepMerge(target[k], sv);
                } else {
                    target[k] = Obj.deepClone(sv);
                }
            });
            return target;
        },

        // 从数组中查找
        find: function (arr, fn) {
            if (!Array.isArray(arr)) return null;
            for (var i = 0; i < arr.length; i++) {
                if (fn(arr[i], i)) return arr[i];
            }
            return null;
        },

        // 按 id 查找
        findById: function (arr, id, idKey) {
            var key = idKey || 'id';
            return Obj.find(arr, function (item) {
                return item && item[key] === id;
            });
        },

        // 按 id 删除
        removeById: function (arr, id, idKey) {
            var key = idKey || 'id';
            var idx = -1;
            if (!Array.isArray(arr)) return arr;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i][key] === id) {
                    idx = i;
                    break;
                }
            }
            if (idx > -1) arr.splice(idx, 1);
            return arr;
        },

        // 按 id 更新
        updateById: function (arr, id, patch, idKey) {
            var key = idKey || 'id';
            var item = Obj.findById(arr, id, key);
            if (item && Type.isObject(patch)) {
                Object.keys(patch).forEach(function (k) {
                    item[k] = patch[k];
                });
            }
            return item;
        },

        // 数组去重（按某个 key 或整个值）
        unique: function (arr, keyFn) {
            if (!Array.isArray(arr)) return [];
            var seen = {};
            return arr.filter(function (item) {
                var k = keyFn ? keyFn(item) : JSON.stringify(item);
                if (seen[k]) return false;
                seen[k] = true;
                return true;
            });
        },

        // 数组排序（稳定，按 key）
        sortBy: function (arr, keyFn, desc) {
            if (!Array.isArray(arr)) return [];
            var sorted = arr.slice();
            sorted.sort(function (a, b) {
                var ka = keyFn(a);
                var kb = keyFn(b);
                if (ka < kb) return desc ? 1 : -1;
                if (ka > kb) return desc ? -1 : 1;
                return 0;
            });
            return sorted;
        }
    };

    /* ============================================================
     * 7. 数字 / 随机
     * ============================================================ */
    var Num = {
        // 随机整数 [min, max]
        randInt: function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },

        // 随机浮点 [min, max)
        randFloat: function (min, max) {
            return Math.random() * (max - min) + min;
        },

        // 从数组随机取一个
        randPick: function (arr) {
            if (!Array.isArray(arr) || arr.length === 0) return null;
            return arr[Math.floor(Math.random() * arr.length)];
        },

        // 从数组随机取 n 个不重复
        randPickMany: function (arr, n) {
            if (!Array.isArray(arr) || arr.length === 0) return [];
            var copy = arr.slice();
            var result = [];
            n = Math.min(n, copy.length);
            for (var i = 0; i < n; i++) {
                var idx = Math.floor(Math.random() * copy.length);
                result.push(copy.splice(idx, 1)[0]);
            }
            return result;
        },

        // 概率判定：prob = 0~1
        chance: function (prob) {
            return Math.random() < prob;
        },

        // 限制范围
        clamp: function (v, min, max) {
            return Math.min(Math.max(v, min), max);
        },

        // 保留 n 位小数
        toFixed: function (v, n) {
            var num = Number(v);
            if (isNaN(num)) return 0;
            return Number(num.toFixed(n === undefined ? 2 : n));
        },

        // 百分比
        percent: function (cur, total) {
            if (!total) return 0;
            return Num.clamp((cur / total) * 100, 0, 100);
        }
    };

    /* ============================================================
     * 8. 函数工具
     * ============================================================ */
    var Fn = {
        // 防抖
        debounce: function (fn, wait, immediate) {
            var timer = null;
            return function () {
                var ctx = this;
                var args = arguments;
                var callNow = immediate && !timer;
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    timer = null;
                    if (!immediate) fn.apply(ctx, args);
                }, wait);
                if (callNow) fn.apply(ctx, args);
            };
        },

        // 节流
        throttle: function (fn, wait) {
            var last = 0;
            var timer = null;
            return function () {
                var ctx = this;
                var args = arguments;
                var now = Date.now();
                var remaining = wait - (now - last);

                if (remaining <= 0) {
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    last = now;
                    fn.apply(ctx, args);
                } else if (!timer) {
                    timer = setTimeout(function () {
                        last = Date.now();
                        timer = null;
                        fn.apply(ctx, args);
                    }, remaining);
                }
            };
        },

        // 只执行一次
        once: function (fn) {
            var called = false;
            var result;
            return function () {
                if (!called) {
                    called = true;
                    result = fn.apply(this, arguments);
                }
                return result;
            };
        },

        // 延迟执行
        delay: function (fn, ms) {
            return setTimeout(fn, ms);
        }
    };

    /* ============================================================
     * 9. 颜色工具
     * ============================================================ */
    var Color = {
        // hex 转 rgb 对象
        hexToRgb: function (hex) {
            if (!hex) return null;
            var h = hex.replace('#', '');
            if (h.length === 3) {
                h = h.split('').map(function (c) { return c + c; }).join('');
            }
            if (h.length !== 6) return null;
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16)
            };
        },

        // rgb 转 hex
        rgbToHex: function (r, g, b) {
            return '#' + [r, g, b].map(function (v) {
                var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
                return s.length === 1 ? '0' + s : s;
            }).join('');
        },

        // 是否深色
        isDark: function (hex) {
            var rgb = this.hexToRgb(hex);
            if (!rgb) return false;
            // YIQ 亮度公式
            var yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            return yiq < 128;
        },

        // 根据背景色返回对比文字色
        contrastText: function (hex) {
            return this.isDark(hex) ? '#ffffff' : '#000000';
        }
    };

    /* ============================================================
     * 10. 系统判断
     * ============================================================ */
    var System = {
        // 是否移动端
        isMobile: function () {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        },

        // 是否 iOS
        isIOS: function () {
            return /iPhone|iPad|iPod/i.test(navigator.userAgent);
        },

        // 是否 Android
        isAndroid: function () {
            return /Android/i.test(navigator.userAgent);
        },

        // 系统是否深色
        prefersDark: function () {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        },

        // 监听系统深色变化
        onPrefersDarkChange: function (handler) {
            if (!window.matchMedia) return;
            var mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq.addEventListener) {
                mq.addEventListener('change', handler);
            } else if (mq.addListener) {
                mq.addListener(handler);
            }
        }
    };

    /* ============================================================
     * 11. 日志
     * ============================================================ */
    var Log = {
        enabled: true,
        prefix: '[梦角]',

        log: function () {
            if (!this.enabled) return;
            var args = Array.prototype.slice.call(arguments);
            args.unshift(this.prefix);
            console.log.apply(console, args);
        },
        warn: function () {
            if (!this.enabled) return;
            var args = Array.prototype.slice.call(arguments);
            args.unshift(this.prefix);
            console.warn.apply(console, args);
        },
        error: function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(this.prefix);
            console.error.apply(console, args);
        }
    };

    /* ============================================================
     * 12. 汇总导出
     * ============================================================ */
    var APP_UTILS = {
        Type: Type,
        Dom: Dom,
        Store: Store,
        Time: Time,
        Str: Str,
        Obj: Obj,
        Num: Num,
        Fn: Fn,
        Color: Color,
        System: System,
        Log: Log
    };

    // 挂到全局
    global.APP_UTILS = APP_UTILS;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_UTILS;

})(typeof window !== 'undefined' ? window : this);