/**
 * call.js
 * 通话模块：拨出 / 来电 / 计时 / 悬浮窗 / 通话记录
 * 依赖：config / utils / state / core / data / reply-library / mood / envelope
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 用户主动拨出：点聊天页 📞 → popup-call-out
 * 2. 梦角来电：后台随机 → popup-call-in（15 秒倒计时）
 * 3. 通话中：显示悬浮窗 float-call-mini
 * 4. 挂断：写通话记录、影响情绪、发到聊天
 * 5. 挂到 window.APP_CALL 上
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

    var Dom = UTILS.Dom;
    var Time = UTILS.Time;
    var Num = UTILS.Num;
    var Str = UTILS.Str;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};
    var DEFAULT_CALL = CONFIG.DEFAULT_CALL || { incomingTimeout: 15, maxRecords: 100 };

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */

    // 'idle' | 'outgoing' | 'incoming' | 'talking'
    var _status = 'idle';

    // 计时器
    var _timer = null;
    var _startTime = 0;

    // 来电倒计时
    var _incomingTimer = null;
    var _incomingLeft = 0;

    // 对方
    var _targetId = 'ta';
    var _targetName = 'TA';

    // 拨出后多久"接通"（模拟）
    var _outgoingConnectDelay = 3000;

    /* ============================================================
     * 2. 工具
     * ============================================================ */
    function _emit(event, payload) {
        if (CORE.emit) CORE.emit(event, payload);
    }

    function _getEl(sel) {
        return document.querySelector(sel);
    }

    function _setStatus(s) {
        _status = s;
        if (STATE.Call) STATE.Call.setStatus(s);
        _emit('call:status', s);
    }

    function _formatTime(sec) {
        return Time.formatHMS(sec);
    }

    /* ============================================================
     * 3. 通用 UI 更新
     * ============================================================ */

    function _setCallUI(sel, name, time) {
        var box = _getEl(sel);
        if (!box) return;
        var nameEl = box.querySelector('.call-name');
        var timeEl = box.querySelector('.call-time-count');
        if (nameEl && name !== undefined) nameEl.textContent = name;
        if (timeEl && time !== undefined) timeEl.textContent = time;
    }

    function _updateAllCallUI(seconds) {
        var t = _formatTime(seconds);
        _setCallUI('.popup-call-out', _targetName, t);
        _setCallUI('.popup-call-in', _targetName, t);

        var mini = _getEl('.float-call-mini');
        if (mini) {
            var nameEl = mini.querySelector('.float-call-name');
            var timeEl = mini.querySelector('.float-call-time');
            if (nameEl) nameEl.textContent = _targetName;
            if (timeEl) timeEl.textContent = t;
        }
    }

    /* ============================================================
     * 4. 计时
     * ============================================================ */
    function _startTimer() {
        _stopTimer();
        _startTime = Date.now();

        _timer = setInterval(function () {
            var sec = Math.floor((Date.now() - _startTime) / 1000);
            _updateAllCallUI(sec);
        }, 1000);
    }

    function _stopTimer() {
        if (_timer) {
            clearInterval(_timer);
            _timer = null;
        }
    }

    function _getDuration() {
        if (!_startTime) return 0;
        return Math.floor((Date.now() - _startTime) / 1000);
    }

    /* ============================================================
     * 5. 拨出电话（用户 → 梦角）
     * ============================================================ */

    /**
     * 拨出
     * @param {object} target { id, name }
     */
    function callOut(target) {
        if (_status !== 'idle') {
            Log.warn('[call] 当前已有通话');
            return false;
        }

        _targetId = (target && target.id) || STATE.get('currentChatId') || 'ta';
        _targetName = (target && target.name) || 'TA';

        _setStatus('outgoing');

        // 打开拨出弹窗
        _setCallUI('.popup-call-out', _targetName, '00:00');
        var statusEl = _getEl('.popup-call-out .call-status');
        if (statusEl) statusEl.textContent = '正在呼叫...';

        CORE.openPopup && CORE.openPopup('callOut', { closeOthers: true });

        // 从 state 里记录
        if (STATE.Call) {
            STATE.set('callStatus', 'outgoing');
            STATE.set('callTargetId', _targetId);
        }

        _emit(EVENTS.CALL_OUT_START || 'call:out:start', {
            targetId: _targetId,
            targetName: _targetName
        });

        // 模拟：3 秒后"接通"
        setTimeout(function () {
            if (_status !== 'outgoing') return;
            _connect();
        }, _outgoingConnectDelay);

        return true;
    }

    // 接通（拨出成功后自动进入通话中）
    function _connect() {
        _setStatus('talking');

        // 关掉拨出弹窗，显示悬浮窗
        CORE.closePopup && CORE.closePopup('callOut');
        CORE.showFloat && CORE.showFloat('callMini');

        _setStatus('talking');
        _startTimer();

        _emit(EVENTS.CALL_ACCEPT || 'call:accept', {
            targetId: _targetId,
            targetName: _targetName,
            direction: 'out'
        });

        // 梦角说一句话
        var chatId = _targetId;
        DATA.Chat.addMessage(chatId, {
            from: 'ta',
            text: REPLY.pick(REPLY.CALL_REPLY.incoming),
            type: 'text'
        });
    }

    /* ============================================================
     * 6. 梦角来电
     * ============================================================ */

    /**
     * 触发一次来电
     * @param {object} target { id, name }
     */
    function callIn(target) {
        if (_status !== 'idle') return false;

        _targetId = (target && target.id) || 'ta';
        _targetName = (target && target.name) || 'TA';

        _setStatus('incoming');

        _setCallUI('.popup-call-in', _targetName, '00:00');

        CORE.openPopup && CORE.openPopup('callIn', { closeOthers: true });

        _emit(EVENTS.CALL_IN_START || 'call:in:start', {
            targetId: _targetId,
            targetName: _targetName
        });

        // 系统通知
        ENV.notifyCallIn && ENV.notifyCallIn({ id: _targetId, name: _targetName });

        // 15 秒倒计时
        _startIncomingCountdown();

        return true;
    }

    function _startIncomingCountdown() {
        _stopIncomingCountdown();

        _incomingLeft = DEFAULT_CALL.incomingTimeout || 15;
        _updateCountdownTip();

        _incomingTimer = setInterval(function () {
            _incomingLeft--;
            _updateCountdownTip();

            if (_incomingLeft <= 0) {
                _stopIncomingCountdown();
                _onMissedCall();
            }
        }, 1000);
    }

    function _stopIncomingCountdown() {
        if (_incomingTimer) {
            clearInterval(_incomingTimer);
            _incomingTimer = null;
        }
    }

    function _updateCountdownTip() {
        var tip = _getEl('.popup-call-in .call-countdown-tip');
        if (tip) {
            tip.textContent = _incomingLeft + ' 秒后未接听自动挂断';
        }
    }

    // 接听
    function acceptCall() {
        if (_status !== 'incoming') return false;

        _stopIncomingCountdown();
        _setStatus('talking');

        // 关来电弹窗，显示悬浮窗
        CORE.closePopup && CORE.closePopup('callIn');
        CORE.showFloat && CORE.showFloat('callMini');

        _startTimer();

        _emit(EVENTS.CALL_ACCEPT || 'call:accept', {
            targetId: _targetId,
            targetName: _targetName,
            direction: 'in'
        });

        // 梦角说一句话
        DATA.Chat.addMessage(_targetId, {
            from: 'ta',
            text: REPLY.pick(REPLY.CALL_REPLY.incoming),
            type: 'text'
        });

        return true;
    }

    // 拒接
    function rejectCall() {
        if (_status !== 'incoming') return false;

        _stopIncomingCountdown();
        _endCall('rejected');
        return true;
    }

    // 未接
    function _onMissedCall() {
        _endCall('missed');
    }

    /* ============================================================
     * 7. 挂断
     * ============================================================ */
    function hangup() {
        if (_status === 'idle') return false;
        _stopIncomingCountdown();
        _endCall('hangup');
        return true;
    }

    /**
     * 结束通话
     * @param {string} reason 'hangup' | 'rejected' | 'missed'
     */
    function _endCall(reason) {
        var duration = _getDuration();

        _stopTimer();
        _startTime = 0;

        // 关 UI
        CORE.closePopup && CORE.closePopup('callOut');
        CORE.closePopup && CORE.closePopup('callIn');
        CORE.hideFloat && CORE.hideFloat('callMini');

        _setStatus('idle');

        // 写通话记录
        var record = {
            targetId: _targetId,
            targetName: _targetName,
            direction: (reason === 'missed' || reason === 'rejected') ? 'in' : 'out',
            status: reason,
            duration: duration,
            time: Date.now()
        };
        DATA.Call.add(record);

        // 通话消息发到聊天
        var chatMsg = '';
        if (reason === 'hangup') {
            chatMsg = '📞 通话 ' + _formatTime(duration);
        } else if (reason === 'rejected') {
            chatMsg = '📞 已拒绝';
        } else if (reason === 'missed') {
            chatMsg = '📞 未接来电';
        }

        DATA.Chat.addMessage(_targetId, {
            from: 'me',
            text: chatMsg,
            type: 'call'
        });

        // 情绪
        if (reason === 'hangup' && MOOD.onCallEnd) {
            MOOD.onCallEnd(duration);
        } else if (reason === 'missed' && MOOD.set) {
            MOOD.set('miss', 70, { source: 'callMissed' });
        }

        // 梦角说一句
        var replyText = '';
        if (reason === 'hangup') {
            replyText = REPLY.pick(REPLY.CALL_REPLY.hangup);
        } else if (reason === 'rejected') {
            replyText = REPLY.pick(REPLY.CALL_REPLY.rejected);
        } else if (reason === 'missed') {
            replyText = REPLY.pick(REPLY.CALL_REPLY.missed);
        }
        if (replyText) {
            DATA.Chat.addMessage(_targetId, {
                from: 'ta',
                text: replyText,
                type: 'text'
            });
        }

        _emit(EVENTS.CALL_END || 'call:end', {
            reason: reason,
            duration: duration,
            targetId: _targetId
        });

        Log.log('[call] 通话结束：', reason, duration + 's');
    }

    /* ============================================================
     * 8. 自动触发来电（后台逻辑）
     * ============================================================ */

    /**
     * 尝试触发一次来电
     * @param {number} prob 概率 0~1
     */
    function tryIncomingCall(prob) {
        if (_status !== 'idle') return false;
        if (!Num.chance(prob === undefined ? 0.15 : prob)) return false;
        return callIn();
    }

    /**
     * 根据"很久没联系"触发
     */
    function tryCallFromMiss() {
        if (_status !== 'idle') return false;

        var lastCall = DATA.Call.list()[0];
        var lastTime = lastCall ? lastCall.time : 0;
        var hoursSince = (Date.now() - lastTime) / 3600000;

        // 超过 24 小时没通话 + 20% 概率 → 来电
        if (hoursSince > 24 && Num.chance(0.2)) {
            return callIn();
        }
        return false;
    }

    /* ============================================================
     * 9. 获取状态
     * ============================================================ */
    function getStatus() {
        return _status;
    }

    function isCalling() {
        return _status !== 'idle';
    }

    function getDuration() {
        return _getDuration();
    }

    function getTarget() {
        return {
            id: _targetId,
            name: _targetName
        };
    }

    /* ============================================================
     * 10. 通话记录
     * ============================================================ */
    function getHistory() {
        return DATA.Call.list();
    }

    function clearHistory() {
        DATA.Call.clear();
    }

    /* ============================================================
     * 11. 初始化
     * ============================================================ */
    function init() {
        // 页面卸载时挂断
        window.addEventListener('beforeunload', function () {
            if (_status !== 'idle') _endCall('hangup');
        });

        // 页面切到后台时检查
        document.addEventListener('visibilitychange', function () {
            if (document.hidden && _status === 'incoming') {
                // 页面切到后台，来电继续（系统通知会提醒）
            }
        });

        Log.log('[call] 初始化完成');
    }

    function destroy() {
        _stopTimer();
        _stopIncomingCountdown();
    }

    /* ============================================================
     * 12. 对外导出
     * ============================================================ */
    var APP_CALL = {
        init: init,
        destroy: destroy,

        // 拨出 / 来电
        callOut: callOut,
        callIn: callIn,

        // 操作
        acceptCall: acceptCall,
        rejectCall: rejectCall,
        hangup: hangup,

        // 自动触发
        tryIncomingCall: tryIncomingCall,
        tryCallFromMiss: tryCallFromMiss,

        // 状态
        getStatus: getStatus,
        isCalling: isCalling,
        getDuration: getDuration,
        getTarget: getTarget,

        // 记录
        getHistory: getHistory,
        clearHistory: clearHistory
    };

    global.APP_CALL = APP_CALL;

})(typeof window !== 'undefined' ? window : this);