/**
 * onboarding.js
 * 新手引导：首次进入的欢迎流程 / 分步引导 / 遮罩高亮
 * 依赖：config / utils / state / core / data / reply-library
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 首次打开 App 时，引导用户认识主要功能。
 * 2. 支持分步引导（步骤数组），每步可以高亮某个元素 + 显示说明。
 * 3. 用户完成后写入 localStorage，下次不再显示。
 * 4. 挂到 window.APP_ONBOARDING 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};
    var REPLY = global.APP_REPLY || {};

    var Str = UTILS.Str;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};
    var STORAGE_KEY = 'onboarding_done';

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */
    var _steps = [];
    var _currentIndex = 0;
    var _running = false;

    // DOM
    var _maskEl = null;
    var _tipEl = null;
    var _highlightEl = null;

    /* ============================================================
     * 2. 默认步骤
     * ============================================================ */
    function _getDefaultSteps() {
        return [
            {
                // 欢迎
                target: null,
                title: '欢迎来到梦角',
                body: '和 TA 一起记录每天的点点滴滴。\n让我带你快速看看主要功能。',
                position: 'center',
                nextText: '开始',
                showSkip: false
            },
            {
                // 打卡
                target: '.btn-checkin',
                title: '每天打卡',
                body: '和 TA 一起打卡，连续坚持还会有惊喜哦。',
                position: 'bottom',
                nextText: '下一步'
            },
            {
                // 聊天入口
                target: '.home-function-grid .func-item[data-target-page="chatList"]',
                title: '和 TA 聊天',
                body: '点这里进入聊天，TA 会回复你，还会根据情绪说不同的话。',
                position: 'bottom'
            },
            {
                // 纪念日
                target: '.home-function-grid .func-item[data-target-popup="anniversaryPopup"]',
                title: '纪念日',
                body: '记录你们的每一个重要日子，TA 会帮你记住。',
                position: 'bottom'
            },
            {
                // 信件
                target: '.home-function-grid .func-item[data-target-page="letterPage"]',
                title: '写信给 TA',
                body: '写一封信给 TA，TA 也会回信给你。',
                position: 'bottom'
            },
            {
                // 朋友圈
                target: '.home-function-grid .func-item[data-target-page="momentsPage"]',
                title: '朋友圈',
                body: '发一条动态，TA 会看到、点赞、评论。',
                position: 'bottom'
            },
            {
                // 第二页
                target: '.home-page-indicator',
                title: '左右滑动',
                body: '主页可以左右滑动，第二页有更多功能。',
                position: 'top'
            },
            {
                // 结束
                target: null,
                title: '好了',
                body: '这些就是主要功能啦。\n以后慢慢探索吧~',
                position: 'center',
                nextText: '完成',
                showSkip: false
            }
        ];
    }

    /* ============================================================
     * 3. 完成状态
     * ============================================================ */
    function isDone() {
        if (STATE.get && STATE.get('onboardingDone')) return true;
        return !!UTILS.Store.get(STORAGE_KEY);
    }

    function markDone() {
        UTILS.Store.set(STORAGE_KEY, {
            done: true,
            time: Date.now()
        });
        if (STATE.set) STATE.set('onboardingDone', true);
        if (DATA.Settings && DATA.Settings.setOne) {
            DATA.Settings.setOne('onboarding.done', true);
        }
        if (CORE.emit) CORE.emit(EVENTS.ONBOARDING_DONE || 'onboarding:done', {});
    }

    function reset() {
        UTILS.Store.remove(STORAGE_KEY);
        if (STATE.set) STATE.set('onboardingDone', false);
        if (DATA.Settings && DATA.Settings.setOne) {
            DATA.Settings.setOne('onboarding.done', false);
        }
        Log.log('[onboarding] 已重置');
    }

    /* ============================================================
     * 4. 创建遮罩层
     * ============================================================ */
    function _ensureMask() {
        if (_maskEl) return _maskEl;

        var mask = document.createElement('div');
        mask.className = 'onboarding-mask';
        mask.style.cssText = [
            'position:fixed',
            'top:0','left:0',
            'width:100%','height:100%',
            'background:rgba(0,0,0,0.55)',
            'z-index:99990',
            'opacity:0',
            'transition:opacity 0.25s ease',
            'pointer-events:auto'
        ].join(';');

        document.body.appendChild(mask);
        _maskEl = mask;
        return mask;
    }

    /* ============================================================
     * 5. 创建提示框
     * ============================================================ */
    function _ensureTip() {
        if (_tipEl) return _tipEl;

        var tip = document.createElement('div');
        tip.className = 'onboarding-tip';
        tip.style.cssText = [
            'position:fixed',
            'z-index:99992',
            'background:#ffffff',
            'color:#222222',
            'border-radius:18px',
            'padding:20px 22px',
            'box-shadow:0 10px 30px rgba(0,0,0,0.2)',
            'max-width:300px',
            'width:calc(100% - 40px)',
            'opacity:0',
            'transform:translateY(8px)',
            'transition:all 0.25s ease',
            'pointer-events:auto'
        ].join(';');

        document.body.appendChild(tip);
        _tipEl = tip;
        return tip;
    }

    /* ============================================================
     * 6. 高亮元素
     * ============================================================ */
    function _clearHighlight() {
        if (_highlightEl) {
            _highlightEl.style.position = '';
            _highlightEl.style.zIndex = '';
            _highlightEl.style.boxShadow = '';
            _highlightEl.style.borderRadius = '';
            _highlightEl.style.transition = '';
            _highlightEl.style.background = '';
            _highlightEl = null;
        }
    }

    function _highlight(target) {
        _clearHighlight();

        if (!target) return null;

        // 计算位置
        var rect = target.getBoundingClientRect();

        // 让元素浮到遮罩之上
        var originalPos = target.style.position;
        var originalZ = target.style.zIndex;

        // 用 box-shadow 大光环制造"挖洞"效果
        target.style.position = 'relative';
        target.style.zIndex = '99991';
        target.style.boxShadow = '0 0 0 4px #ffffff, 0 0 0 9999px rgba(0,0,0,0.55)';
        target.style.borderRadius = '12px';
        target.style.transition = 'box-shadow 0.25s ease';

        _highlightEl = target;

        return rect;
    }

    /* ============================================================
     * 7. 计算提示框位置
     * ============================================================ */
    function _positionTip(tip, rect, position) {
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var tipW = 300;
        var gap = 16;

        tip.style.left = '50%';
        tip.style.top = '50%';
        tip.style.transform = 'translate(-50%, -50%)';

        if (!rect || position === 'center') {
            return;
        }

        var left, top;

        if (position === 'top') {
            top = rect.top - gap;
            tip.style.transform = 'translate(-50%, -100%)';
            left = Math.max(20, Math.min(vw - 20, rect.left + rect.width / 2));
        } else if (position === 'bottom') {
            top = rect.bottom + gap;
            tip.style.transform = 'translate(-50%, 0)';
            left = Math.max(20, Math.min(vw - 20, rect.left + rect.width / 2));
        } else if (position === 'left') {
            top = rect.top + rect.height / 2;
            tip.style.transform = 'translate(-100%, -50%)';
            left = rect.left - gap;
        } else if (position === 'right') {
            top = rect.top + rect.height / 2;
            tip.style.transform = 'translate(0, -50%)';
            left = rect.right + gap;
        } else {
            return;
        }

        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    /* ============================================================
     * 8. 渲染某一步
     * ============================================================ */
    function _renderStep(index) {
        var step = _steps[index];
        if (!step) return;

        _currentIndex = index;

        var mask = _ensureMask();
        var tip = _ensureTip();

        // 找到目标元素
        var targetEl = step.target ? document.querySelector(step.target) : null;

        // 高亮
        var rect = null;
        if (targetEl) {
            rect = _highlight(targetEl);
        } else {
            _clearHighlight();
        }

        // 组装内容
        var html = '';
        html += '<h3 style="font-size:17px;font-weight:600;margin:0 0 10px">' + Str.escapeHtml(step.title || '') + '</h3>';
        html += '<p style="font-size:14px;line-height:1.6;color:#555;margin:0 0 18px;white-space:pre-line">' + Str.escapeHtml(step.body || '') + '</p>';

        // 进度
        if (_steps.length > 1) {
            html += '<div style="font-size:12px;color:#999;margin-bottom:10px">'
                + (index + 1) + ' / ' + _steps.length + '</div>';
        }

        // 按钮行
        var nextText = step.nextText || (index === _steps.length - 1 ? '完成' : '下一步');
        var showSkip = step.showSkip !== false && index < _steps.length - 1;

        html += '<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end">';
        if (showSkip) {
            html += '<button class="onboarding-btn-skip" style="border:none;background:transparent;color:#999;font-size:14px;padding:8px 12px;cursor:pointer">跳过</button>';
        }
        html += '<button class="onboarding-btn-next" style="border:none;background:#000;color:#fff;font-size:14px;padding:10px 20px;border-radius:12px;cursor:pointer">' + Str.escapeHtml(nextText) + '</button>';
        html += '</div>';

        tip.innerHTML = html;

        // 定位
        _positionTip(tip, rect, step.position || 'center');

        // 显示
        requestAnimationFrame(function () {
            mask.style.opacity = '1';
            tip.style.opacity = '1';
            tip.style.transform = tip.style.transform.replace('translateY(8px)', '') || tip.style.transform;
        });

        // 绑定按钮
        var btnNext = tip.querySelector('.onboarding-btn-next');
        if (btnNext) {
            btnNext.addEventListener('click', function () {
                next();
            });
        }
        var btnSkip = tip.querySelector('.onboarding-btn-skip');
        if (btnSkip) {
            btnSkip.addEventListener('click', function () {
                finish();
            });
        }
    }

    /* ============================================================
     * 9. 控制
     * ============================================================ */

    /**
     * 开始引导
     * @param {array} steps 自定义步骤（不传则用默认）
     * @param {object} options { force: 强制显示（即使已完成） }
     */
    function start(steps, options) {
        options = options || {};

        if (_running) return false;
        if (!options.force && isDone()) {
            Log.log('[onboarding] 已完成，跳过');
            return false;
        }

        _steps = (steps && steps.length > 0) ? steps : _getDefaultSteps();
        _currentIndex = 0;
        _running = true;

        if (CORE.emit) CORE.emit(EVENTS.ONBOARDING_START || 'onboarding:start', { steps: _steps });

        _renderStep(0);
        Log.log('[onboarding] 开始，共 ' + _steps.length + ' 步');
        return true;
    }

    /**
     * 下一步
     */
    function next() {
        if (!_running) return false;
        if (_currentIndex >= _steps.length - 1) {
            return finish();
        }
        _renderStep(_currentIndex + 1);
        return true;
    }

    /**
     * 上一步
     */
    function prev() {
        if (!_running) return false;
        if (_currentIndex <= 0) return false;
        _renderStep(_currentIndex - 1);
        return true;
    }

    /**
     * 跳到某一步
     */
    function goTo(index) {
        if (!_running) return false;
        if (index < 0 || index >= _steps.length) return false;
        _renderStep(index);
        return true;
    }

    /**
     * 完成 / 跳过
     */
    function finish() {
        if (!_running) return false;
        _running = false;

        _clearHighlight();

        if (_maskEl) {
            _maskEl.style.opacity = '0';
            setTimeout(function () {
                if (_maskEl && _maskEl.parentNode) {
                    _maskEl.parentNode.removeChild(_maskEl);
                    _maskEl = null;
                }
            }, 250);
        }
        if (_tipEl) {
            _tipEl.style.opacity = '0';
            setTimeout(function () {
                if (_tipEl && _tipEl.parentNode) {
                    _tipEl.parentNode.removeChild(_tipEl);
                    _tipEl = null;
                }
            }, 250);
        }

        markDone();

        if (CORE.emit) CORE.emit('onboarding:finish', { totalSteps: _steps.length });
        Log.log('[onboarding] 完成');
        return true;
    }

    /**
     * 是否正在引导
     */
    function isRunning() {
        return _running;
    }

    /**
     * 获取当前步骤索引
     */
    function getCurrentIndex() {
        return _currentIndex;
    }

    /* ============================================================
     * 10. 首次自动触发
     * ============================================================ */
    function autoStart(options) {
        if (isDone() && !(options && options.force)) return false;
        return start(null, options);
    }

    /* ============================================================
     * 11. 初始化
     * ============================================================ */
    function init() {
        // 监听键盘
        document.addEventListener('keydown', function (e) {
            if (!_running) return;
            if (e.key === 'Escape') {
                finish();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                next();
            } else if (e.key === 'ArrowLeft') {
                prev();
            }
        });

        // 窗口大小变化时重新定位
        window.addEventListener('resize', function () {
            if (_running) {
                _renderStep(_currentIndex);
            }
        });

        Log.log('[onboarding] 初始化完成，已完成:', isDone());
    }

    /* ============================================================
     * 12. 对外导出
     * ============================================================ */
    var APP_ONBOARDING = {
        init: init,

        // 状态
        isDone: isDone,
        markDone: markDone,
        reset: reset,
        isRunning: isRunning,
        getCurrentIndex: getCurrentIndex,

        // 控制
        start: start,
        next: next,
        prev: prev,
        goTo: goTo,
        finish: finish,
        autoStart: autoStart,

        // 默认步骤
        getDefaultSteps: _getDefaultSteps
    };

    global.APP_ONBOARDING = APP_ONBOARDING;

})(typeof window !== 'undefined' ? window : this);