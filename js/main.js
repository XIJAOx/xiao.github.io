/**
 * main.js （v2）
 * 项目入口：初始化所有模块 / 启动 App / 全局错误处理
 * 依赖：全部模块
 * 被依赖：无
 *
 * v2 改动：
 * 1. REQUIRED 列表加上 10 个新模块（chart / tarot-data / image-handler / member-picker /
 *    wordcard-lib / moments-visits / mall-all / question-engine / sticker-manager / pwa）
 * 2. boot() 里加上新模块的 init
 * 3. 后台任务里加上 question-engine 和 moments-visits 的定时触发
 * 4. 启动 PWA（注册 Service Worker）
 */

(function (global) {
    'use strict';

    /* ============================================================
     * 0. 模块检查
     * ============================================================ */
    var REQUIRED = [
        // 核心
        'APP_CONFIG',
        'APP_UTILS',
        'APP_REPLY',
        'APP_STATE',
        'APP_CORE',
        'APP_DATA',
        'APP_BACKUP',
        // 业务基础
        'APP_MOOD',
        'APP_ENVELOPE',
        'APP_AUDIO',
        'APP_CHART',
        'APP_TAROT',
        'APP_IMG',
        'APP_FEATURES',
        // 独立模块
        'APP_CALL',
        'APP_GROUP',
        'APP_THEME_EDITOR',
        'APP_ONBOARDING',
        'APP_GAME',
        'APP_MEMBER_PICKER',
        'APP_WORDCARD_LIB',
        'APP_MOMENTS_VISITS',
        'APP_MALL_ALL',
        'APP_QUESTION_ENGINE',
        'APP_STICKER',
        // 事件
        'APP_LISTENERS'
    ];

    var _missing = [];
    REQUIRED.forEach(function (name) {
        if (!global[name]) _missing.push(name);
    });

    if (_missing.length > 0) {
        console.error(
            '[main] 缺少模块：', _missing.join(', '),
            '\n请检查 HTML 里 <script> 的引入顺序：',
            '\n1. config.js',
            '\n2. utils.js',
            '\n3. reply-library.js',
            '\n4. state.js',
            '\n5. core.js',
            '\n6. data.js',
            '\n7. backup-engine.js',
            '\n8. mood.js',
            '\n9. envelope.js',
            '\n10. audio-player.js',
            '\n11. chart.js',
            '\n12. tarot-data.js',
            '\n13. image-handler.js',
            '\n14. features.js',
            '\n15. call.js',
            '\n16. group-chat.js',
            '\n17. theme-editor.js',
            '\n18. onboarding.js',
            '\n19. game.js',
            '\n20. member-picker.js',
            '\n21. wordcard-lib.js',
            '\n22. moments-visits.js',
            '\n23. mall-all.js',
            '\n24. question-engine.js',
            '\n25. sticker-manager.js',
            '\n26. listeners.js',
            '\n27. pwa.js',
            '\n28. main.js'
        );
        return;
    }

    var CONFIG = global.APP_CONFIG;
    var UTILS = global.APP_UTILS;
    var STATE = global.APP_STATE;
    var CORE = global.APP_CORE;
    var DATA = global.APP_DATA;
    var BACKUP = global.APP_BACKUP;
    var MOOD = global.APP_MOOD;
    var ENV = global.APP_ENVELOPE;
    var AUDIO = global.APP_AUDIO;
    var FEATURES = global.APP_FEATURES;
    var CALL = global.APP_CALL;
    var GROUP = global.APP_GROUP;
    var THEME = global.APP_THEME_EDITOR;
    var ONBOARDING = global.APP_ONBOARDING;
    var GAME = global.APP_GAME;
    var MEMBER_PICKER = global.APP_MEMBER_PICKER;
    var WORDCARD_LIB = global.APP_WORDCARD_LIB;
    var MOMENTS_VISITS = global.APP_MOMENTS_VISITS;
    var MALL_ALL = global.APP_MALL_ALL;
    var QUESTION_ENGINE = global.APP_QUESTION_ENGINE;
    var STICKER = global.APP_STICKER;
    var LISTENERS = global.APP_LISTENERS;
    var PWA = global.APP_PWA;

    var Log = UTILS.Log;

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */
    var _started = false;
    var _timers = [];

    /* ============================================================
     * 2. 启动流程
     * ============================================================ */
    function boot() {
        if (_started) return;

        var t0 = Date.now();
        Log.log('====== 梦角 App 启动 ======');
        Log.log('版本：', CONFIG.APP_INFO.version);

        try {
            // ---------- 底层 ----------
            DATA.init && DATA.init();
            STATE.init && STATE.init();
            BACKUP.init && BACKUP.init();

            // ---------- 业务基础 ----------
            MOOD.init && MOOD.init();
            ENV.init && ENV.init();
            AUDIO.init && AUDIO.init();
            THEME.init && THEME.init();

            // ---------- 独立模块 ----------
            CALL.init && CALL.init();
            GROUP.init && GROUP.init();
            GAME.init && GAME.init();

            // ---------- 新增模块 ----------
            MEMBER_PICKER.init && MEMBER_PICKER.init();
            WORDCARD_LIB.init && WORDCARD_LIB.init();
            MOMENTS_VISITS.init && MOMENTS_VISITS.init();
            MALL_ALL.init && MALL_ALL.init();
            QUESTION_ENGINE.init && QUESTION_ENGINE.init();
            STICKER.init && STICKER.init();

            // ---------- 核心 ----------
            CORE.init && CORE.init();

            // ---------- 功能模块渲染 ----------
            FEATURES.initAll && FEATURES.initAll();

            // ---------- 事件绑定 ----------
            LISTENERS.init && LISTENERS.init();

            // ---------- 新手引导 ----------
            ONBOARDING.init && ONBOARDING.init();

            // ---------- PWA ----------
            _initPWA();

            // ---------- 后台任务 ----------
            _startBackgroundTasks();

            // ---------- 首次使用引导 ----------
            _maybeStartOnboarding();

            // ---------- 完成 ----------
            STATE.set('ready', true);
            _started = true;

            var cost = Date.now() - t0;
            Log.log('====== 启动完成，耗时 ' + cost + 'ms ======');

            CORE.emit('app:ready', {
                cost: cost,
                version: CONFIG.APP_INFO.version
            });

        } catch (err) {
            console.error('[main] 启动失败:', err);
            _showFatalError(err);
        }
    }

    /* ============================================================
     * 3. PWA 注册
     * ============================================================ */
    function _initPWA() {
        if (!PWA) {
            Log.log('[main] PWA 模块未加载，跳过');
            return;
        }

        // 安装提示
        if (PWA.initInstallPrompt) {
            PWA.initInstallPrompt();
        }

        // 注册 Service Worker
        if (PWA.register) {
            PWA.register().then(function (reg) {
                if (reg) Log.log('[main] Service Worker 已注册');
            }).catch(function () {});
        }
    }

    /* ============================================================
     * 4. 后台任务
     * ============================================================ */
    function _startBackgroundTasks() {
        // 4.1 梦角主动发消息 —— 每 5 分钟检查
        _addTimer('taProactive', setInterval(function () {
            _tryTaProactiveMessage();
        }, 5 * 60 * 1000));

        // 4.2 梦角来电 —— 每 10 分钟检查
        _addTimer('taCall', setInterval(function () {
            _tryTaIncomingCall();
        }, 10 * 60 * 1000));

        // 4.3 梦角发朋友圈 —— 每 30 分钟检查
        _addTimer('taMoments', setInterval(function () {
            _tryTaPostMoment();
        }, 30 * 60 * 1000));

        // 4.4 一起听歌邀请 —— 每 20 分钟检查
        _addTimer('taMusic', setInterval(function () {
            _tryListenTogetherInvite();
        }, 20 * 60 * 1000));

        // 4.5 【新增】TA 主动出题 —— 每 30 分钟检查
        _addTimer('taQuestion', setInterval(function () {
            _tryTaAskQuestion();
        }, 30 * 60 * 1000));

        // 4.6 【新增】朋友圈访问记录 —— 每 10 分钟检查
        _addTimer('momentsVisit', setInterval(function () {
            _tryMomentsVisit();
        }, 10 * 60 * 1000));

        // 4.7 自动备份
        _startAutoBackupIfNeeded();

        // 4.8 定时保存状态 —— 每 30 秒
        _addTimer('saveState', setInterval(function () {
            STATE.save && STATE.save();
        }, 30 * 1000));

        // 4.9 页面卸载时保存
        window.addEventListener('beforeunload', function () {
            STATE.save && STATE.save();
        });

        // 4.10 页面切到后台时保存
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                STATE.save && STATE.save();
            }
        });

        Log.log('[main] 后台任务已启动');
    }

    function _addTimer(name, id) {
        _timers.push({ name: name, id: id });
    }

    function _clearAllTimers() {
        _timers.forEach(function (t) {
            clearInterval(t.id);
        });
        _timers = [];
    }

    /* ============================================================
     * 5. 梦角主动行为
     * ============================================================ */

    function _tryTaProactiveMessage() {
        try {
            var s = DATA.Settings.getOne('reply') || {};
            if (!s.taProactive) return;

            var page = STATE.Page && STATE.Page.current();
            if (page === 'chatRoom') return;

            if (Math.random() > 0.5) return;

            var chatId = STATE.get('currentChatId') || 'ta';
            var msgs = DATA.Chat.getMessages(chatId);
            var last = msgs[msgs.length - 1];
            if (last && Date.now() - last.time < 5 * 60 * 1000) return;

            var text;
            var mood = MOOD.get ? MOOD.get() : null;
            if (mood && MOOD.pickReply) {
                text = MOOD.pickReply() || '在干嘛呀';
            } else {
                text = global.APP_REPLY.pick(global.APP_REPLY.DAILY_REPLY.general);
            }

            DATA.Chat.addMessage(chatId, {
                from: 'ta',
                text: text,
                type: 'text'
            });

            STATE.Unread.add(chatId);
            ENV.notifyMessage && ENV.notifyMessage({ id: chatId, name: 'TA' }, { text: text });

            Log.log('[main] 梦角主动发消息：', text);
        } catch (e) {
            Log.warn('[main] 主动发消息出错:', e);
        }
    }

    function _tryTaIncomingCall() {
        try {
            if (!CALL.tryCallFromMiss) return;
            var ok = CALL.tryCallFromMiss();
            if (ok) Log.log('[main] 梦角来电');
        } catch (e) {
            Log.warn('[main] 来电触发出错:', e);
        }
    }

    function _tryTaPostMoment() {
        try {
            if (!FEATURES.Moments || !FEATURES.Moments.taPost) return;
            FEATURES.Moments.taPost();
        } catch (e) {
            Log.warn('[main] 朋友圈触发出错:', e);
        }
    }

    function _tryListenTogetherInvite() {
        try {
            if (!FEATURES.Music || !FEATURES.Music.tryInvite) return;
            var page = STATE.Page && STATE.Page.current();
            if (page === 'musicPage') return;
            FEATURES.Music.tryInvite();
        } catch (e) {
            Log.warn('[main] 一起听歌触发出错:', e);
        }
    }

    /**
     * 【新增】TA 主动出题
     */
    function _tryTaAskQuestion() {
        try {
            if (!QUESTION_ENGINE.tryAutoAsk) return;
            var ok = QUESTION_ENGINE.tryAutoAsk();
            if (ok) Log.log('[main] TA 主动出题');
        } catch (e) {
            Log.warn('[main] 出题触发出错:', e);
        }
    }

    /**
     * 【新增】朋友圈访问记录
     */
    function _tryMomentsVisit() {
        try {
            if (!MOMENTS_VISITS.tryAutoVisit) return;
            var ok = MOMENTS_VISITS.tryAutoVisit();
            if (ok) Log.log('[main] 梦角访问朋友圈');
        } catch (e) {
            Log.warn('[main] 访问触发出错:', e);
        }
    }

    /* ============================================================
     * 6. 自动备份
     * ============================================================ */
    function _startAutoBackupIfNeeded() {
        var interval = CONFIG.DEFAULT_BACKUP && CONFIG.DEFAULT_BACKUP.autoInterval;
        if (!interval || interval <= 0) return;
        BACKUP.startAutoBackup && BACKUP.startAutoBackup(interval);
    }

    /* ============================================================
     * 7. 新手引导
     * ============================================================ */
    function _maybeStartOnboarding() {
        setTimeout(function () {
            if (ONBOARDING.isDone && ONBOARDING.isDone()) {
                Log.log('[main] 已完成引导，跳过');
                return;
            }
            ONBOARDING.autoStart && ONBOARDING.autoStart();
        }, 800);
    }

    /* ============================================================
     * 8. 全局错误处理
     * ============================================================ */
    function _showFatalError(err) {
        var el = document.createElement('div');
        el.style.cssText = [
            'position:fixed',
            'top:0','left:0',
            'width:100%','height:100%',
            'background:#fff',
            'z-index:999999',
            'padding:40px 20px',
            'font-size:14px',
            'color:#333',
            'overflow:auto'
        ].join(';');

        el.innerHTML =
            '<h2 style="color:#dd3333;margin-bottom:16px">启动失败</h2>' +
            '<p style="margin-bottom:12px">请检查控制台（F12）查看详细错误。</p>' +
            '<pre style="background:#f5f5f5;padding:12px;border-radius:8px;overflow:auto;font-size:12px">' +
            (err && err.stack ? err.stack : String(err)) +
            '</pre>';

        document.body.appendChild(el);
    }

    function _bindGlobalErrorHandler() {
        window.addEventListener('error', function (e) {
            Log.error('[全局错误]', e.message, e.filename, e.lineno);
        });

        window.addEventListener('unhandledrejection', function (e) {
            Log.error('[未处理的 Promise 拒绝]', e.reason);
        });
    }

    /* ============================================================
     * 9. 销毁
     * ============================================================ */
    function destroy() {
        _clearAllTimers();
        CALL.destroy && CALL.destroy();
        MOOD.destroy && MOOD.destroy();
        AUDIO.destroy && AUDIO.destroy();
        CORE.destroy && CORE.destroy();
        LISTENERS.unbind && LISTENERS.unbind();
        _started = false;
        Log.log('[main] 已销毁');
    }

    /* ============================================================
     * 10. 对外暴露（调试用）
     * ============================================================ */
    var APP = {
        boot: boot,
        destroy: destroy,

        get started() { return _started; },

        // 快捷引用
        config: CONFIG,
        utils: UTILS,
        state: STATE,
        core: CORE,
        data: DATA,
        backup: BACKUP,
        mood: MOOD,
        envelope: ENV,
        audio: AUDIO,
        features: FEATURES,
        call: CALL,
        group: GROUP,
        theme: THEME,
        onboarding: ONBOARDING,
        game: GAME,
        memberPicker: MEMBER_PICKER,
        wordcardLib: WORDCARD_LIB,
        momentsVisits: MOMENTS_VISITS,
        mallAll: MALL_ALL,
        questionEngine: QUESTION_ENGINE,
        sticker: STICKER,
        listeners: LISTENERS,
        pwa: PWA,

        version: CONFIG.APP_INFO.version
    };

    global.APP = APP;

    /* ============================================================
     * 11. DOM 就绪后启动
     * ============================================================ */
    _bindGlobalErrorHandler();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})(typeof window !== 'undefined' ? window : this);