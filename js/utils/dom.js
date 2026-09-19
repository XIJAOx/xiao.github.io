/* ==========================================================================
   梦角 · Dream Corner
   DOM 工具模块  js/utils/dom.js
   --------------------------------------------------------------------------
   职责：
   1. 选择器快捷方法（$ / $$）
   2. 元素创建 / 文本安全处理
   3. 屏幕（.screen）切换
   4. 弹窗（.modal-overlay）开关
   5. Toast 提示（.toast）
   6. Loading 遮罩（.loading-overlay）
   7. 开关 / 勾选控件（.switch / .check-indicator）
   8. 时间 / 日期格式化
   9. 滚动、防抖、节流等杂项工具
   ========================================================================== */


/* ==========================================================================
   01. 选择器
   ========================================================================== */

/**
 * 查询单个元素
 * @param {string} selector
 * @param {Element|Document} root
 * @returns {Element|null}
 */
export function $(selector, root = document) {
    return root.querySelector(selector);
}

/**
 * 查询多个元素（返回真数组）
 * @param {string} selector
 * @param {Element|Document} root
 * @returns {Element[]}
 */
export function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

/**
 * 按 id 查询（去掉 # 前缀的写法）
 * @param {string} id
 * @returns {Element|null}
 */
export function byId(id) {
    return document.getElementById(id);
}


/* ==========================================================================
   02. 元素创建 / 内容安全
   ========================================================================== */

/**
 * 创建元素
 * @param {string} tag            标签名
 * @param {string} [className]    类名（可空格分隔多个）
 * @param {string} [html]         初始 HTML
 * @returns {HTMLElement}
 */
export function createEl(tag, className = '', html = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (html) el.innerHTML = html;
    return el;
}

/**
 * HTML 转义，防止用户输入被当作标签渲染（XSS 防护）
 * 所有把用户输入插入 innerHTML 的地方都必须先用它
 * @param {*} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 设置元素文本（安全）
 * @param {Element} el
 * @param {*} text
 */
export function setText(el, text) {
    if (!el) return;
    el.textContent = text === null || text === undefined ? '' : String(text);
}

/**
 * 显示 / 隐藏元素（配合 HTML 里的 hidden 属性）
 * @param {Element} el
 * @param {boolean} visible
 */
export function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
}

/**
 * 切换元素的"占位"状态
 * 用于 .card-placeholder / .two-card-placeholder 这类样式
 * @param {Element} el
 * @param {boolean} isPlaceholder
 */
export function setPlaceholder(el, isPlaceholder) {
    if (!el) return;
    el.classList.toggle('card-placeholder', isPlaceholder);
    el.classList.toggle('two-card-placeholder', isPlaceholder);
}


/* ==========================================================================
   03. 屏幕切换（.screen）
   --------------------------------------------------------------------------
   HTML 结构：
     <div class="screen screen-home active" id="screen-home" data-screen="home">
   规则：同一时间只有一个 .screen 拥有 .active
   ========================================================================== */

/** 当前屏幕 id 缓存，便于"返回上一页" */
let _currentScreenId = 'screen-home';

/**
 * 切换到指定屏幕
 * @param {string} screenId   屏幕元素 id，如 'screen-home'
 * @param {Object} [options]
 * @param {boolean} [options.remember=true]  是否记录为"当前屏幕"
 * @returns {Element|null}
 */
export function showScreen(screenId, options = {}) {
    const { remember = true } = options;

    const target = byId(screenId);
    if (!target) {
        console.warn(`[dom] 未找到屏幕：${screenId}`);
        return null;
    }

    // 移除所有 .screen 的 active
    $$('.screen').forEach((s) => s.classList.remove('active'));

    // 激活目标
    target.classList.add('active');

    // 记录
    if (remember) _currentScreenId = screenId;

    // 可选：回到顶部（很多页面切换后需要重置滚动）
    const scrollable = target.querySelector(
        '.info-body, .letter-body, .moments-feed, .period-body,' +
        '.message-stats-body, .divine-body, .fav-list, .music-library,' +
        '.question-list, .water-body, .settings-body, .chat-body, .chat-list'
    );
    if (scrollable) scrollable.scrollTop = 0;

    return target;
}

/**
 * 获取当前屏幕 id
 * @returns {string}
 */
export function getCurrentScreenId() {
    return _currentScreenId;
}

/**
 * 获取当前屏幕元素
 * @returns {Element|null}
 */
export function getCurrentScreen() {
    return byId(_currentScreenId);
}


/* ==========================================================================
   04. 弹窗（.modal-overlay）
   --------------------------------------------------------------------------
   HTML 结构：
     <div class="modal-overlay" id="modal-anniversary" data-modal-id="anniversary">
         <div class="modal">...</div>
     </div>
   CSS：.modal-overlay.active { display: flex; } 并带淡入动画
   ========================================================================== */

/** 记录打开过的弹窗 id，按打开顺序排列（用于 closeTopModal） */
const _modalStack = [];

/**
 * 打开弹窗
 * @param {string} modalId   弹窗元素 id，如 'modal-anniversary'
 * @param {Object} [options]
 * @param {boolean} [options.stack=true]  是否入栈
 * @returns {Element|null}
 */
export function openModal(modalId, options = {}) {
    const { stack = true } = options;

    const overlay = byId(modalId);
    if (!overlay) {
        console.warn(`[dom] 未找到弹窗：${modalId}`);
        return null;
    }

    overlay.classList.add('active');

    // 记录到栈中，防止重复
    if (stack && !_modalStack.includes(modalId)) {
        _modalStack.push(modalId);
    }

    return overlay;
}

/**
 * 关闭弹窗
 * @param {string} modalId
 * @returns {boolean}  是否成功关闭
 */
export function closeModal(modalId) {
    const overlay = byId(modalId);
    if (!overlay) return false;

    overlay.classList.remove('active');

    const idx = _modalStack.indexOf(modalId);
    if (idx !== -1) _modalStack.splice(idx, 1);

    return true;
}

/**
 * 关闭所有已打开的弹窗
 */
export function closeAllModals() {
    _modalStack.forEach((id) => {
        const overlay = byId(id);
        if (overlay) overlay.classList.remove('active');
    });
    _modalStack.length = 0;
}

/**
 * 关闭最上层弹窗（点击遮罩时用）
 * @returns {string|null}  被关闭的弹窗 id
 */
export function closeTopModal() {
    const id = _modalStack[_modalStack.length - 1];
    if (!id) return null;
    closeModal(id);
    return id;
}

/**
 * 从子元素找到所属弹窗并关闭
 * 常用：closeModalByChild(event.target)
 * @param {Element} child
 * @returns {boolean}
 */
export function closeModalByChild(child) {
    if (!child) return false;
    const overlay = child.closest('.modal-overlay');
    if (!overlay) return false;
    return closeModal(overlay.id);
}

/**
 * 初始化弹窗通用交互
 *  1) 点击遮罩空白处关闭
 *  2) 按 Esc 关闭最上层
 *  3) 点击 [data-action="close-modal"] 关闭其所在弹窗
 * 只需调用一次。
 */
export function initModalBaseBehavior() {
    // 点击遮罩空白关闭
    document.addEventListener('click', (e) => {
        const overlay = e.target.classList && e.target.classList.contains('modal-overlay')
            ? e.target
            : null;
        if (overlay) closeModal(overlay.id);
    });

    // Esc 关闭最上层
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _modalStack.length) {
            closeTopModal();
        }
    });
}


/* ==========================================================================
   05. Toast 提示（#toast-container / .toast）
   --------------------------------------------------------------------------
   CSS：.toast 自动有入场动画；加 .hide 会走退场动画
   ========================================================================== */

/**
 * 显示一条 Toast
 * @param {string} message
 * @param {number} [duration=2000]  毫秒
 * @returns {Element|null}  toast 元素
 */
export function toast(message, duration = 2000) {
    const container = byId('toast-container');
    if (!container) {
        console.log('[toast]', message);
        return null;
    }

    const el = createEl('div', 'toast', escapeHtml(message));
    container.appendChild(el);

    // 到时间后播放退场动画，动画结束再移除
    window.setTimeout(() => {
        el.classList.add('hide');
        window.setTimeout(() => el.remove(), 260);
    }, duration);

    return el;
}

/**
 * 清空所有 Toast
 */
export function clearToast() {
    const container = byId('toast-container');
    if (container) container.innerHTML = '';
}


/* ==========================================================================
   06. Loading（#loading-overlay）
   ========================================================================== */

/** 当前打开中的 loading 计数，用于嵌套调用不误关 */
let _loadingCount = 0;

export function showLoading() {
    _loadingCount++;
    const el = byId('loading-overlay');
    if (el) el.hidden = false;
}

export function hideLoading() {
    _loadingCount = Math.max(0, _loadingCount - 1);
    if (_loadingCount === 0) {
        const el = byId('loading-overlay');
        if (el) el.hidden = true;
    }
}

/**
 * 强制关闭 loading（异常兜底）
 */
export function resetLoading() {
    _loadingCount = 0;
    const el = byId('loading-overlay');
    if (el) el.hidden = true;
}

/**
 * 包裹一个异步流程，自动开关 Loading
 * @param {Function} task   返回 Promise 的函数
 * @returns {Promise<*>}
 */
export async function withLoading(task) {
    showLoading();
    try {
        return await task();
    } finally {
        hideLoading();
    }
}


/* ==========================================================================
   07. 控件：开关 / 勾选
   ========================================================================== */

/**
 * 设置开关状态
 * CSS：.switch.on 或 .switch[aria-checked="true"]
 * @param {Element|string} target  元素或 id
 * @param {boolean} on
 */
export function setSwitch(target, on) {
    const el = typeof target === 'string' ? byId(target) : target;
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-checked', on ? 'true' : 'false');
}

/**
 * 读取开关状态
 * @param {Element|string} target
 * @returns {boolean}
 */
export function getSwitch(target) {
    const el = typeof target === 'string' ? byId(target) : target;
    if (!el) return false;
    return el.classList.contains('on') || el.getAttribute('aria-checked') === 'true';
}

/**
 * 反转开关状态，返回新状态
 * @param {Element|string} target
 * @returns {boolean}
 */
export function toggleSwitch(target) {
    const next = !getSwitch(target);
    setSwitch(target, next);
    return next;
}

/**
 * 设置勾选指示器（.check-indicator.checked）
 * @param {Element|string} target
 * @param {boolean} checked
 */
export function setCheck(target, checked) {
    const el = typeof target === 'string' ? byId(target) : target;
    if (!el) return;
    el.classList.toggle('checked', !!checked);
    el.textContent = checked ? '✓' : '';
}

/**
 * 读取勾选状态
 * @param {Element|string} target
 * @returns {boolean}
 */
export function getCheck(target) {
    const el = typeof target === 'string' ? byId(target) : target;
    return el ? el.classList.contains('checked') : false;
}

/**
 * 按 id 切换勾选状态（供 event.js 使用）
 * @param {string} id
 * @returns {boolean}  切换后的状态
 */
export function toggleCheckById(id) {
    const el = byId(id);
    if (!el) return false;
    const next = !el.classList.contains('checked');
    el.classList.toggle('checked', next);
    el.textContent = next ? '✓' : '';
    return next;
}

/**
 * 分组单选：一组 [data-mode] / [data-shape] 类按钮
 * @param {Element[]|NodeList} group
 * @param {Element} activeEl
 * @param {string} activeClass 默认 'active'
 */
export function setActiveInGroup(group, activeEl, activeClass = 'active') {
    Array.from(group).forEach((el) => {
        el.classList.toggle(activeClass, el === activeEl);
        // 同步 aria-pressed（若存在）
        if (el.hasAttribute('aria-pressed')) {
            el.setAttribute('aria-pressed', el === activeEl ? 'true' : 'false');
        }
    });
}


/* ==========================================================================
   08. 时间 / 日期格式化
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 格式化为 HH:mm
 * @param {Date|number|string} d
 * @returns {string}
 */
export function formatTime(d = new Date()) {
    const date = d instanceof Date ? d : new Date(d);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * 格式化为 YYYY-MM-DD
 * @param {Date|number|string} d
 * @returns {string}
 */
export function formatDate(d = new Date()) {
    const date = d instanceof Date ? d : new Date(d);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 格式化为 YYYY年M月
 * @param {Date|number|string} d
 * @returns {string}
 */
export function formatYearMonth(d = new Date()) {
    const date = d instanceof Date ? d : new Date(d);
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

/**
 * 时长（秒 → mm:ss），用于通话计时、音乐时间
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${pad2(m)}:${pad2(r)}`;
}

/**
 * 聊天气泡上的"人性化时间"
 * 今天 → HH:mm；昨天 → 昨天 HH:mm；更早 → MM-DD HH:mm
 * @param {number|string|Date} ts
 * @returns {string}
 */
export function formatChatTime(ts) {
    const date = ts instanceof Date ? ts : new Date(ts);
    const now = new Date();

    const isSameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isSameDay) return formatTime(date);

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isYesterday) return `昨天 ${formatTime(date)}`;

    return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${formatTime(date)}`;
}

/**
 * 两个日期相差的天数（忽略时分秒）
 * @param {Date|string} a
 * @param {Date|string} b
 * @returns {number}
 */
export function diffDays(a, b = new Date()) {
    const d1 = new Date(a);
    const d2 = new Date(b);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2 - d1) / 86400000);
}


/* ==========================================================================
   09. 通用杂项工具
   ========================================================================== */

/**
 * 防抖
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(fn, wait = 200) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * 节流
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
export function throttle(fn, wait = 200) {
    let last = 0;
    let timer = null;
    return function (...args) {
        const now = Date.now();
        const remain = wait - (now - last);
        if (remain <= 0) {
            last = now;
            fn.apply(this, args);
        } else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn.apply(this, args);
            }, remain);
        }
    };
}

/**
 * 生成简单唯一 id
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

/**
 * 区间随机整数（闭区间）
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min, max) {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * 数组随机取一个
 * @template T
 * @param {T[]} arr
 * @returns {T|null}
 */
export function randomPick(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 洗牌（Fisher-Yates），返回新数组
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 让某个可滚动容器滚到底部（聊天页 / 列表页常用）
 * @param {Element} el
 * @param {boolean} [smooth=false]
 */
export function scrollToBottom(el, smooth = false) {
    if (!el) return;
    el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

/**
 * 触发文件选择
 * @param {Object} [options]
 * @param {string} [options.accept='']
 * @param {boolean} [options.multiple=false]
 * @returns {Promise<File[]>}
 */
export function pickFile(options = {}) {
    const { accept = '', multiple = false } = options;
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.multiple = multiple;
        input.style.display = 'none';

        input.addEventListener('change', () => {
            resolve(Array.from(input.files || []));
            input.remove();
        });

        // 兼容：用户取消选择时清理
        window.addEventListener(
            'focus',
            () => {
                setTimeout(() => input.remove(), 1000);
            },
            { once: true }
        );

        document.body.appendChild(input);
        input.click();
    });
}

/**
 * 下载文本 / Blob 为文件（导出数据用）
 * @param {string|Blob} content
 * @param {string} filename
 * @param {string} [mime='application/json']
 */
export function downloadFile(content, filename, mime = 'application/json') {
    const blob =
        content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 读取文件为文本
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * 读取文件为 DataURL（头像 / 背景图用）
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

/**
 * 估算字符串字节数（存储弹窗用，UTF-8 近似）
 * @param {string} str
 * @returns {number}
 */
export function byteSize(str) {
    if (!str) return 0;
    let bytes = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else bytes += 3;
    }
    return bytes;
}

/**
 * 字节数 → 友好展示（B / KB / MB）
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ==========================================================================
   通用应用内弹窗（替代 window.confirm / alert / prompt）
   ========================================================================== */

export function mjConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal" style="max-width: 320px;">
                <h2 class="modal-title" style="margin-bottom: 14px;">${escapeHtml(options.title || '确认')}</h2>
                <p style="font-size: 14px; line-height: 1.6; color: var(--c-text-1); margin-bottom: 20px; white-space: pre-wrap;">${escapeHtml(message)}</p>
                <div class="modal-actions" style="margin-top: 0;">
                    <button class="modal-btn secondary" data-role="cancel">${escapeHtml(options.cancelText || '取消')}</button>
                    <button class="modal-btn primary" data-role="confirm">${escapeHtml(options.confirmText || '确定')}</button>
                </div>
            </div>
        `;
        const close = (result) => { overlay.remove(); resolve(result); };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('[data-role="cancel"]')) close(false);
            if (e.target.closest('[data-role="confirm"]')) close(true);
        });
        document.body.appendChild(overlay);
    });
}

export function mjAlert(message, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal" style="max-width: 320px;">
                <h2 class="modal-title" style="margin-bottom: 14px;">${escapeHtml(options.title || '提示')}</h2>
                <p style="font-size: 14px; line-height: 1.6; color: var(--c-text-1); margin-bottom: 20px; white-space: pre-wrap;">${escapeHtml(message)}</p>
                <div class="modal-actions" style="margin-top: 0;">
                    <button class="modal-btn primary" data-role="ok" style="flex:1;">${escapeHtml(options.okText || '知道了')}</button>
                </div>
            </div>
        `;
        const close = () => { overlay.remove(); resolve(); };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('[data-role="ok"]')) close();
        });
        document.body.appendChild(overlay);
    });
}

export function mjPrompt(message, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal" style="max-width: 320px;">
                <h2 class="modal-title" style="margin-bottom: 14px;">${escapeHtml(options.title || '请输入')}</h2>
                <p style="font-size: 14px; line-height: 1.6; color: var(--c-text-1); margin-bottom: 12px; white-space: pre-wrap;">${escapeHtml(message)}</p>
                <input type="text" class="form-input" data-role="input"
                    placeholder="${escapeHtml(options.placeholder || '')}"
                    value="${escapeHtml(options.defaultValue || '')}"
                    style="width:100%;height:42px;padding:0 14px;border:1px solid var(--c-line-2);border-radius:12px;font-size:14px;background:var(--c-surface-2);margin-bottom: 20px;">
                <div class="modal-actions" style="margin-top: 0;">
                    <button class="modal-btn secondary" data-role="cancel">${escapeHtml(options.cancelText || '取消')}</button>
                    <button class="modal-btn primary" data-role="confirm">${escapeHtml(options.confirmText || '确定')}</button>
                </div>
            </div>
        `;
        const input = overlay.querySelector('[data-role="input"]');
        const close = (result) => { overlay.remove(); resolve(result); };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target.closest('[data-role="cancel"]')) close(null);
            if (e.target.closest('[data-role="confirm"]')) close(input.value);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') close(input.value);
        });
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 100);
    });
}
