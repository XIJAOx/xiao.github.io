/**
 * mood.js
 * 角色情绪系统
 * 依赖：config.js / utils.js / state.js / core.js / data.js / reply-library.js
 * 被依赖：features.js / call.js / listeners.js / main.js
 *
 * 说明：
 * 1. 管梦角的当前情绪（happy/calm/sad/angry/shy/miss/excited/tired）。
 * 2. 情绪有强度（0~100），会随时间自然衰减。
 * 3. 外部事件（发消息、打卡、通话、喝水等）可以影响情绪。
 * 4. 提供按情绪取回复语料的接口。
 * 5. 挂到 window.APP_MOOD 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};
    var REPLY = global.APP_REPLY || {};

    var Obj = UTILS.Obj;
    var Num = UTILS.Num;
    var Time = UTILS.Time;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};
    var DEFAULT_MOOD = CONFIG.DEFAULT_MOOD || {
        current: 'calm',
        intensity: 50,
        list: {}
    };

    // 情绪列表
    var MOOD_LIST = DEFAULT_MOOD.list || {
        happy:    { name: '开心', emoji: '😊', color: '#ffcc44' },
        calm:     { name: '平静', emoji: '😌', color: '#88bbff' },
        sad:      { name: '难过', emoji: '😢', color: '#7799cc' },
        angry:    { name: '生气', emoji: '😠', color: '#ff6666' },
        shy:      { name: '害羞', emoji: '😳', color: '#ff99bb' },
        miss:     { name: '想你', emoji: '🥺', color: '#ff88aa' },
        excited:  { name: '兴奋', emoji: '🤩', color: '#ffaa33' },
        tired:    { name: '疲惫', emoji: '😴', color: '#aaaacc' }
    };

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */
    var _current = DEFAULT_MOOD.current || 'calm';
    var _intensity = DEFAULT_MOOD.intensity || 50;
    var _lastUpdate = Date.now();

    // 自然衰减：每次 tick 减多少
    var DECAY_PER_MINUTE = 1;

    // 自然衰减定时器
    var _decayTimer = null;

    // 情绪历史缓存（运行时的，不写盘）
    var _history = [];

    /* ============================================================
     * 2. 基础读写
     * ============================================================ */

    function _emit(event, payload) {
        if (CORE.emit) CORE.emit(event, payload);
    }

    /**
     * 获取当前情绪
     * @returns {object} { mood, intensity, name, emoji, color }
     */
    function get() {
        var info = MOOD_LIST[_current] || MOOD_LIST.calm || {};
        return {
            mood: _current,
            intensity: _intensity,
            name: info.name || '平静',
            emoji: info.emoji || '😌',
            color: info.color || '#88bbff'
        };
    }

    /**
     * 获取情绪 key
     */
    function getCurrent() {
        return _current;
    }

    /**
     * 获取强度
     */
    function getIntensity() {
        return _intensity;
    }

    /**
     * 获取某个情绪的定义
     */
    function getMoodInfo(mood) {
        return MOOD_LIST[mood] || null;
    }

    /**
     * 获取所有情绪列表
     */
    function listMoods() {
        return Obj.deepClone(MOOD_LIST);
    }

    /* ============================================================
     * 3. 设置情绪
     * ============================================================ */

    /**
     * 设置情绪
     * @param {string} mood 情绪 key
     * @param {number} intensity 强度 0~100
     * @param {object} options { silent, source }
     */
    function set(mood, intensity, options) {
        options = options || {};
        if (!MOOD_LIST[mood]) {
            Log.warn('[mood] 未知情绪:', mood);
            return;
        }

        var oldMood = _current;
        var oldIntensity = _intensity;

        _current = mood;
        if (intensity !== undefined && intensity !== null) {
            _intensity = Num.clamp(Number(intensity) || 0, 0, 100);
        } else {
            _intensity = 60; // 默认
        }

        _lastUpdate = Date.now();

        // 记录历史（内存）
        _history.push({
            mood: _current,
            intensity: _intensity,
            time: _lastUpdate,
            source: options.source || 'manual'
        });
        if (_history.length > 100) _history.shift();

        // 写盘
        if (DATA.Mood && DATA.Mood.setCurrent) {
            DATA.Mood.setCurrent(_current, _intensity);
        }

        // 同步 state
        if (STATE.Mood) {
            STATE.Mood.set(_current, _intensity);
        }

        // 触发事件
        if (!options.silent && (oldMood !== _current || oldIntensity !== _intensity)) {
            _emit(EVENTS.MOOD_CHANGE || 'mood:change', {
                from: oldMood,
                fromIntensity: oldIntensity,
                to: _current,
                toIntensity: _intensity,
                source: options.source || 'manual'
            });
        }

        return get();
    }

    /**
     * 调整强度（在当前情绪上加减）
     */
    function adjustIntensity(delta) {
        var v = Num.clamp(_intensity + Number(delta || 0), 0, 100);
        _intensity = v;
        _lastUpdate = Date.now();

        if (DATA.Mood && DATA.Mood.setCurrent) {
            DATA.Mood.setCurrent(_current, _intensity);
        }

        _emit('mood:intensity', { value: _intensity, delta: delta });
        return _intensity;
    }

    /* ============================================================
     * 4. 事件影响情绪
     * ============================================================ */

    /**
     * 用户发来消息 → 梦角情绪变化
     * @param {object} msg { text, type }
     */
    function onUserMessage(msg) {
        if (!msg) return;

        var text = (msg.text || '').toLowerCase();

        // 用户说想 / 爱 / 晚安 等，情绪变好
        if (/想你|想我|爱你|喜欢你|抱抱|亲亲/.test(text)) {
            return set('shy', Num.randInt(60, 90), { source: 'userMessage:love' });
        }
        if (/晚安|睡觉|休息/.test(text)) {
            return set('calm', Num.randInt(50, 70), { source: 'userMessage:night' });
        }
        if (/开心|哈哈|嘿嘿|太好了|好棒/.test(text)) {
            return set('happy', Num.randInt(60, 90), { source: 'userMessage:happy' });
        }
        if (/难过|伤心|不开心|委屈/.test(text)) {
            return set('sad', Num.randInt(50, 80), { source: 'userMessage:sad' });
        }
        if (/生气|讨厌|烦/.test(text)) {
            return set('angry', Num.randInt(40, 70), { source: 'userMessage:angry' });
        }
        if (/累|困|好烦|不想动/.test(text)) {
            return set('tired', Num.randInt(40, 70), { source: 'userMessage:tired' });
        }

        // 默认：轻微提升，向 happy 靠近
        if (_intensity < 40) {
            adjustIntensity(5);
        }
        return get();
    }

    /**
     * 用户很久没来 → 想他
     */
    function onLongTimeNoSee() {
        return set('miss', Num.randInt(70, 90), { source: 'longTimeNoSee' });
    }

    /**
     * 打卡 → 开心
     */
    function onCheckin(streak) {
        var n = Number(streak) || 1;
        var intensity = Num.clamp(50 + n * 2, 50, 95);
        return set('happy', intensity, { source: 'checkin' });
    }

    /**
     * 通话结束 → 根据通话时长变化
     * @param {number} duration 秒
     */
    function onCallEnd(duration) {
        var d = Number(duration) || 0;
        if (d < 5) {
            return set('calm', 40, { source: 'callEnd:short' });
        }
        if (d < 30) {
            return set('happy', Num.randInt(50, 70), { source: 'callEnd:normal' });
        }
        return set('shy', Num.randInt(70, 90), { source: 'callEnd:long' });
    }

    /**
     * 收到信 → 开心
     */
    function onLetterReceived() {
        return set('happy', Num.randInt(75, 95), { source: 'letter' });
    }

    /**
     * 用户写信 → 兴奋
     */
    function onLetterSent() {
        return set('excited', Num.randInt(60, 85), { source: 'letterSent' });
    }

    /**
     * 梦角给用户写信 → 稳定情绪
     */
    function onLetterWritten() {
        return set('calm', Num.randInt(50, 70), { source: 'letterWritten' });
    }

    /**
     * 喝水提醒 → 关心
     */
    function onWaterRemind() {
        return set('calm', Num.randInt(50, 70), { source: 'waterRemind' });
    }

    /**
     * 用户达成喝水目标 → 开心
     */
    function onWaterGoalReached() {
        return set('happy', Num.randInt(70, 90), { source: 'waterGoal' });
    }

    /**
     * 用户下单（商城） → 期待
     */
    function onOrderPlaced() {
        return set('excited', Num.randInt(60, 85), { source: 'orderPlaced' });
    }

    /**
     * 用户加购物车 → 普通开心
     */
    function onCartAdd() {
        if (_intensity < 50) {
            adjustIntensity(3);
        }
        return get();
    }

    /**
     * 音乐一起听 → 害羞
     */
    function onListenTogether() {
        return set('shy', Num.randInt(60, 85), { source: 'listenTogether' });
    }

    /**
     * 朋友圈被点赞 → 开心
     */
    function onMomentLiked() {
        return set('happy', Num.randInt(60, 80), { source: 'momentLiked' });
    }

    /**
     * 纪念日到了 → 兴奋
     */
    function onAnniversaryToday() {
        return set('excited', Num.randInt(80, 95), { source: 'anniversary' });
    }

    /**
     * 用户长时间不回 → 难过 / 想你
     */
    function onUserAway() {
        // 50% 想你，50% 难过
        if (Num.chance(0.5)) {
            return set('miss', Num.randInt(60, 85), { source: 'userAway:miss' });
        }
        return set('sad', Num.randInt(50, 75), { source: 'userAway:sad' });
    }

    /**
     * 用户道歉 → 情绪缓和
     */
    function onUserApologize() {
        return set('calm', Num.randInt(40, 60), { source: 'apologize' });
    }

    /* ============================================================
     * 5. 随机 / 自然变化
     * ============================================================ */

    /**
     * 根据时间自动切换情绪（早上/中午/晚上/深夜）
     */
    function applyTimeMood() {
        var h = new Date().getHours();

        if (h >= 5 && h < 10) {
            return set('calm', Num.randInt(50, 70), { source: 'time:morning' });
        }
        if (h >= 10 && h < 14) {
            return set('calm', Num.randInt(50, 65), { source: 'time:noon' });
        }
        if (h >= 14 && h < 18) {
            return set('calm', Num.randInt(45, 65), { source: 'time:afternoon' });
        }
        if (h >= 18 && h < 22) {
            return set('calm', Num.randInt(50, 70), { source: 'time:evening' });
        }
        // 深夜
        return set('tired', Num.randInt(60, 80), { source: 'time:night' });
    }

    /**
     * 随机小波动
     */
    function randomDrift() {
        if (!Num.chance(0.15)) return get();

        var keys = Object.keys(MOOD_LIST);
        var pick = keys[Math.floor(Math.random() * keys.length)];
        var intensity = Num.randInt(40, 80);
        return set(pick, intensity, { source: 'drift' });
    }

    /* ============================================================
     * 6. 自然衰减
     * ============================================================ */
    function _decayTick() {
        var now = Date.now();
        var elapsedMin = (now - _lastUpdate) / (60 * 1000);
        if (elapsedMin <= 0) return;

        var decay = Math.floor(elapsedMin * DECAY_PER_MINUTE);
        if (decay > 0) {
            _intensity = Num.clamp(_intensity - decay, 0, 100);
            _lastUpdate = now;
            _emit('mood:intensity', { value: _intensity, delta: -decay });
        }

        // 强度降到 30 以下 → 回落到 calm
        if (_intensity <= 30 && _current !== 'calm') {
            set('calm', Num.randInt(40, 55), { source: 'decay' });
        }
    }

    function startDecay(minutes) {
        stopDecay();
        var m = Number(minutes) || 5;
        _decayTimer = setInterval(_decayTick, m * 60 * 1000);
        Log.log('[mood] 衰减已启动，每 ' + m + ' 分钟一次');
    }

    function stopDecay() {
        if (_decayTimer) {
            clearInterval(_decayTimer);
            _decayTimer = null;
        }
    }

    /* ============================================================
     * 7. 取回复语料
     * ============================================================ */

    /**
     * 根据当前情绪，从语料库取一句话
     * @returns {string}
     */
    function pickReply() {
        if (!REPLY.MOOD_REPLY) return '';
        var list = REPLY.MOOD_REPLY[_current];
        if (!list || list.length === 0) return '';
        return REPLY.pick ? REPLY.pick(list) : list[Math.floor(Math.random() * list.length)];
    }

    /**
     * 根据当前情绪取多个回复
     */
    function pickReplies(n) {
        if (!REPLY.MOOD_REPLY) return [];
        var list = REPLY.MOOD_REPLY[_current];
        if (!list || list.length === 0) return [];
        return REPLY.pickMany ? REPLY.pickMany(list, n || 1) : [list[0]];
    }

    /* ============================================================
     * 8. 情绪历史
     * ============================================================ */
    function getHistory(n) {
        var all = DATA.Mood && DATA.Mood.listHistory ? DATA.Mood.listHistory() : [];
        if (n) return all.slice(-n);
        return all;
    }

    function clearHistory() {
        _history = [];
        if (DATA.Mood && DATA.Mood.clearHistory) {
            DATA.Mood.clearHistory();
        }
    }

    /**
     * 统计最近一段时间各情绪出现次数
     */
    function getStats(hours) {
        var h = Number(hours) || 24;
        var since = Date.now() - h * 60 * 60 * 1000;
        var all = getHistory();
        var counts = {};

        Object.keys(MOOD_LIST).forEach(function (k) {
            counts[k] = 0;
        });

        all.forEach(function (item) {
            if (item.time >= since && counts[item.mood] !== undefined) {
                counts[item.mood]++;
            }
        });

        return counts;
    }

    /* ============================================================
     * 9. 初始化
     * ============================================================ */
    function init() {
        // 从 data 恢复
        if (DATA.Mood && DATA.Mood.getCurrent) {
            var saved = DATA.Mood.getCurrent();
            if (saved && saved.mood) {
                _current = saved.mood;
                _intensity = saved.intensity || 50;
                _lastUpdate = saved.updatedAt || Date.now();
            }
        }

        // 同步 state
        if (STATE.Mood) {
            STATE.Mood.set(_current, _intensity);
        }

        // 启动衰减
        startDecay(5);

        Log.log('[mood] 初始化完成，当前情绪:', _current, _intensity);
    }

    function destroy() {
        stopDecay();
    }

    /* ============================================================
     * 10. 对外导出
     * ============================================================ */
    var APP_MOOD = {
        init: init,
        destroy: destroy,

        // 读
        get: get,
        getCurrent: getCurrent,
        getIntensity: getIntensity,
        getMoodInfo: getMoodInfo,
        listMoods: listMoods,

        // 写
        set: set,
        adjustIntensity: adjustIntensity,

        // 事件影响
        onUserMessage: onUserMessage,
        onLongTimeNoSee: onLongTimeNoSee,
        onCheckin: onCheckin,
        onCallEnd: onCallEnd,
        onLetterReceived: onLetterReceived,
        onLetterSent: onLetterSent,
        onLetterWritten: onLetterWritten,
        onWaterRemind: onWaterRemind,
        onWaterGoalReached: onWaterGoalReached,
        onOrderPlaced: onOrderPlaced,
        onCartAdd: onCartAdd,
        onListenTogether: onListenTogether,
        onMomentLiked: onMomentLiked,
        onAnniversaryToday: onAnniversaryToday,
        onUserAway: onUserAway,
        onUserApologize: onUserApologize,

        // 随机 / 时间
        applyTimeMood: applyTimeMood,
        randomDrift: randomDrift,

        // 衰减
        startDecay: startDecay,
        stopDecay: stopDecay,

        // 取语料
        pickReply: pickReply,
        pickReplies: pickReplies,

        // 历史
        getHistory: getHistory,
        clearHistory: clearHistory,
        getStats: getStats
    };

    // 挂到全局
    global.APP_MOOD = APP_MOOD;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_MOOD;

})(typeof window !== 'undefined' ? window : this);