/**
 * pwa.js
 * Service Worker 注册 + 与 SW 通信
 * 依赖：无
 * 被依赖：main.js
 */

(function (global) {
    'use strict';

    var _registration = null;
    var _supported = false;

    /**
     * 是否支持 Service Worker
     */
    function isSupported() {
        return 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    }

    /**
     * 注册 Service Worker
     */
    function register() {
        if (!isSupported()) {
            console.log('[PWA] 当前环境不支持 Service Worker（需要 HTTPS 或 localhost）');
            return Promise.resolve(null);
        }

        return navigator.serviceWorker.register('./service-worker.js')
            .then(function (reg) {
                _registration = reg;
                _supported = true;
                console.log('[PWA] 注册成功，scope:', reg.scope);

                // 监听更新
                reg.addEventListener('updatefound', function () {
                    var newWorker = reg.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', function () {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[PWA] 有新版本，提示用户刷新');
                            // 可以在这里弹个提示
                            if (global.APP_ENVELOPE && global.APP_ENVELOPE.tip) {
                                global.APP_ENVELOPE.tip('有新版本，刷新后生效');
                            }
                        }
                    });
                });

                return reg;
            })
            .catch(function (err) {
                console.warn('[PWA] 注册失败:', err);
                return null;
            });
    }

    /**
     * 卸载
     */
    function unregister() {
        if (!_registration) return Promise.resolve(false);
        return _registration.unregister().then(function (ok) {
            _registration = null;
            return ok;
        });
    }

    /**
     * 让等待中的 SW 立即生效
     */
    function skipWaiting() {
        if (!_registration || !_registration.waiting) return;
        _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    /**
     * 通过 SW 弹通知
     * 即使页面切到后台，只要 SW 活着就能弹
     */
    function showNotification(notification) {
        if (!_registration) {
            // 退回用 Notification API
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification(notification.title || '梦角', {
                        body: notification.body || '',
                        icon: notification.icon,
                        tag: notification.tag
                    });
                } catch (e) {}
            }
            return;
        }

        if (!navigator.serviceWorker.controller) return;

        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            notification: notification
        });
    }

    /**
     * 清理 SW 缓存
     */
    function clearCache() {
        if (!navigator.serviceWorker.controller) return;
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }

    /**
     * 检查是否可安装（PWA）
     */
    var _deferredPrompt = null;

    function _onBeforeInstallPrompt(e) {
        e.preventDefault();
        _deferredPrompt = e;
    }

    function initInstallPrompt() {
        window.addEventListener('beforeinstallprompt', _onBeforeInstallPrompt);

        window.addEventListener('appinstalled', function () {
            console.log('[PWA] 已安装到桌面');
            _deferredPrompt = null;
        });
    }

    /**
     * 弹出安装提示
     */
    function promptInstall() {
        if (!_deferredPrompt) return Promise.resolve(false);
        _deferredPrompt.prompt();
        return _deferredPrompt.userChoice.then(function (choice) {
            _deferredPrompt = null;
            return choice.outcome === 'accepted';
        });
    }

    /**
     * 是否可安装
     */
    function canInstall() {
        return !!_deferredPrompt;
    }

    /**
     * 是否已安装（standalone 模式）
     */
    function isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    }

    /* ============================================================
     * 导出
     * ============================================================ */
    var APP_PWA = {
        isSupported: isSupported,
        register: register,
        unregister: unregister,
        skipWaiting: skipWaiting,
        showNotification: showNotification,
        clearCache: clearCache,
        initInstallPrompt: initInstallPrompt,
        promptInstall: promptInstall,
        canInstall: canInstall,
        isInstalled: isInstalled
    };

    global.APP_PWA = APP_PWA;

})(typeof window !== 'undefined' ? window : this);