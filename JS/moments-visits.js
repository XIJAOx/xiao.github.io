/**
 * moments-visits.js
 * 朋友圈访问记录
 * 依赖：config / utils / state / core / data / reply-library / mood
 * 被依赖：listeners.js / main.js
 *
 * 功能：
 * 1. 渲染访问记录列表
 * 2. 梦角访问用户朋友圈（模拟/定时）
 * 3. 支持清空
 *
 * 挂到 window.APP_MOMENTS_VISITS 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};
    var REPLY = global.APP_REPLY || {};
    var MOOD = global.APP_MOOD || {};
    var ENV = global.APP_ENVELOPE || {};

    var Str = UTILS.Str;
    var Time = UTILS.Time;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }
    function $(s, p) { return (p || document).querySelector(s); }
    function $$(s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); }

    /* ============================================================
     * 1. 渲染访问记录
     * ============================================================ */
    function render() {
        var container = document.querySelector('.popup-moments-visit .visit-list');
        if (!container) return;

        var visits = DATA.Moments.listVisits();

        if (visits.length === 0) {
            container.innerHTML = '<p class="empty-text" style="text-align:center;color:#999;padding:30px 0">暂无访问记录</p>';
            return;
        }

        container.innerHTML = visits.map(function (v) {
            var name = v.name || 'TA';
            var avatarHtml = '<div class="avatar avatar-ta-small"' +
                (v.avatar ? ' style="background-image:url(' + esc(v.avatar) + ');background-size:cover"' : '') +
                '></div>';

            return '<div class="visit-item" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f2f2f2">' +
                avatarHtml +
                '<div style="flex:1">' +
                    '<p style="font-size:14px;margin:0 0 2px">' + esc(name) + '</p>' +
                    '<p style="font-size:12px;color:#999;margin:0">' + esc(v.action || '看了你的朋友圈') + '</p>' +
                '</div>' +
                '<span style="font-size:12px;color:#aaa">' + Time.fromNow(v.time) + '</span>' +
            '</div>';
        }).join('');
    }

    /* ============================================================
     * 2. 打开弹窗
     * ============================================================ */
    function open() {
        if (CORE.openPopup) CORE.openPopup('momentsVisit');
        setTimeout(render, 100);
    }

    /* ============================================================
     * 3. 记录一次访问
     * ============================================================ */

    /**
     * 添加一条访问记录
     * @param {object} options
     *   - name: 名字
     *   - avatar: 头像
     *   - action: 动作描述
     *   - charId: 角色 id
     */
    function addVisit(options) {
        options = options || {};
        var visit = {
            name: options.name || 'TA',
            avatar: options.avatar || '',
            action: options.action || '看了你的朋友圈',
            charId: options.charId || 'ta',
            time: Date.now()
        };
        DATA.Moments.addVisit(visit);
        Log.log('[moments-visits] 新增访问:', visit.name, visit.action);
        return visit;
    }

    /**
     * 梦角随机访问
     */
    function taVisit() {
        var char = DATA.Character.list()[0] || { id: 'ta', name: 'TA', avatar: '' };

        var actions = [
            '看了你的朋友圈',
            '点开了你最新的动态',
            '翻了你以前的朋友圈',
            '看了你半小时前发的动态'
        ];

        var action = Num.randPick(actions);

        addVisit({
            name: char.name,
            avatar: char.avatar,
            action: action,
            charId: char.id
        });

        // 情绪联动
        if (MOOD.set) {
            MOOD.set('calm', Num.randInt(55, 75), { source: 'momentsVisit' });
        }
    }

    /**
     * 检查是否需要触发访问（定时调用）
     * 1. 距离上次访问超过 30 分钟
     * 2. 用户最近有发朋友圈
     * 3. 20% 概率
     */
    function tryAutoVisit() {
        var visits = DATA.Moments.listVisits();
        var lastVisit = visits[0];
        var lastTime = lastVisit ? lastVisit.time : 0;
        var sinceMin = (Date.now() - lastTime) / 60000;

        // 距离上次不足 30 分钟不访问
        if (sinceMin < 30) return false;

        // 用户最近 24 小时有发朋友圈
        var posts = DATA.Moments.list();
        var recentPost = posts.filter(function (p) {
            return p.authorName === '我' && (Date.now() - p.createdAt) < 24 * 3600 * 1000;
        });
        if (recentPost.length === 0) return false;

        // 20% 概率
        if (!Num.chance(0.2)) return false;

        taVisit();
        return true;
    }

    /* ============================================================
     * 4. 清空访问记录
     * ============================================================ */
    function clear() {
        DATA.Moments.addVisit && 0; // 占位，避免 lint
        // 用 saveAll 直接清空
        // 但 DATA 里没有 saveVisits，需要直接操作
        var saved = UTILS.Store.get('moments_visits', []);
        UTILS.Store.set('moments_visits', []);
        render();
        Log.log('[moments-visits] 已清空');
    }

    /* ============================================================
     * 5. 统计
     * ============================================================ */
    function count() {
        return DATA.Moments.listVisits().length;
    }

    function getLatest(n) {
        var visits = DATA.Moments.listVisits();
        if (n) return visits.slice(0, n);
        return visits;
    }

    /* ============================================================
     * 6. 初始化
     * ============================================================ */
    function init() {
        // 首次进入如果一条记录都没有，加一条
        var visits = DATA.Moments.listVisits();
        if (visits.length === 0) {
            // 延迟 5 秒再记录，避免启动时突兀
            setTimeout(function () {
                var posts = DATA.Moments.list();
                var myPost = posts.filter(function (p) { return p.authorName === '我'; });
                if (myPost.length > 0) {
                    taVisit();
                }
            }, 5000);
        }

        // 监听梦角发朋友圈 → 记录一条"TA 发动态"
        if (CORE.on) {
            CORE.on('data:moments:add', function (payload) {
                var post = payload && (payload.data || payload);
                if (post && post.authorName === 'TA') {
                    // 不记录梦角自己发朋友圈到访问列表
                }
            });
        }

        Log.log('[moments-visits] 初始化完成，现有访问记录:', visits.length);
    }

    /* ============================================================
     * 7. 对外导出
     * ============================================================ */
    var APP_MOMENTS_VISITS = {
        init: init,
        open: open,
        render: render,
        addVisit: addVisit,
        taVisit: taVisit,
        tryAutoVisit: tryAutoVisit,
        clear: clear,
        count: count,
        getLatest: getLatest
    };

    global.APP_MOMENTS_VISITS = APP_MOMENTS_VISITS;

})(typeof window !== 'undefined' ? window : this);