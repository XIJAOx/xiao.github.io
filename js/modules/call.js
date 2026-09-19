/* ==========================================================================
   梦角 · Dream Corner
   通话模块  js/modules/call.js
   ========================================================================== */

import {
    $, $$, byId,
    toast,
    setText, setVisible,
    formatDuration, formatChatTime,
    uid, randomInt,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   常量
   ========================================================================== */

/** 来电倒计时秒数 */
const INCOMING_TIMEOUT = 15;

/** 拨出后对方"接听"的等待时长范围（秒） */
const OUTGOING_WAIT_MIN = 3;
const OUTGOING_WAIT_MAX = 8;

/** 拨出后对方拒绝的概率 */
const OUTGOING_REJECT_RATE = 0.15;

/** TA 主动来电：检查间隔（毫秒） */
const INCOMING_CHECK_INTERVAL = 5 * 60 * 1000;

/** TA 主动来电：冷却时间（防止太频繁） */
const INCOMING_COOLDOWN = 8 * 60 * 1000;

/** TA 主动来电：触发概率 */
const INCOMING_PROBABILITY = 0.5;

const CALL_END_LINES = [
    '通话结束，刚刚听到你的声音好开心 ♥',
    '聊得好开心，下次再打给你呀',
    '嗯嗯，那就先这样，想我了再打给我',
    '挂啦挂啦，早点休息哦'
];

const REJECT_LINES = [
    '（对方暂时无法接听）',
    '（对方拒绝了你的通话）',
    '（对方正忙，稍后再试）'
];


/* ==========================================================================
   内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

let _state = 'idle';
let _callStartAt = 0;

let _durationTimer = null;
let _outgoingWaitTimer = null;
let _incomingTimer = null;
let _incomingLoopTimer = null;

let _incomingCountdown = INCOMING_TIMEOUT;
let _lastIncomingAt = 0;


/* ==========================================================================
   入口
   ========================================================================== */

export function initCall() {
    if (_initialized) return;
    _initialized = true;

    bindButtons();

    _unsubs.push(
        bus.on('call:start', ({ name }) => startCall(name)),
        bus.on('call:simulate-incoming', () => simulateIncomingCall())
    );

    startIncomingLoop();
}

export function destroyCall() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    if (_incomingLoopTimer) clearInterval(_incomingLoopTimer);
    _incomingLoopTimer = null;
    cleanup();
    _initialized = false;
}


/* ==========================================================================
   按钮
   ========================================================================== */

function bindButtons() {
    const minimizeBtn = byId('btn-minimize-call');
    if (minimizeBtn) minimizeBtn.addEventListener('click', minimizeCall);

    const hangupBtn = byId('btn-hang-up');
    if (hangupBtn) hangupBtn.addEventListener('click', hangUp);

    const acceptBtn = byId('btn-accept-call');
    if (acceptBtn) acceptBtn.addEventListener('click', acceptIncoming);

    const rejectBtn = byId('btn-reject-call');
    if (rejectBtn) rejectBtn.addEventListener('click', rejectIncoming);
}


/* ==========================================================================
   TA 主动来电循环
   --------------------------------------------------------------------------
   每 5 分钟检查一次：
     - 当前必须 idle
     - 距离上次来电至少 8 分钟
     - 50% 概率触发
   ========================================================================== */

export function startIncomingLoop() {
    if (_incomingLoopTimer) clearInterval(_incomingLoopTimer);

    _incomingLoopTimer = setInterval(() => {
        if (_state !== 'idle') return;

        const now = Date.now();
        if (now - _lastIncomingAt < INCOMING_COOLDOWN) return;

        if (Math.random() < INCOMING_PROBABILITY) {
            _lastIncomingAt = now;
            simulateIncomingCall();
        }
    }, INCOMING_CHECK_INTERVAL);

    // 用户从后台切回页面时，也检查一次（增强"惊喜感"）
    document.addEventListener('visibilitychange', onVisibilityChange);
}

function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    if (_state !== 'idle') return;

    const now = Date.now();
    if (now - _lastIncomingAt < INCOMING_COOLDOWN) return;

    if (Math.random() < INCOMING_PROBABILITY) {
        _lastIncomingAt = now;
        simulateIncomingCall();
    }
}


/* ==========================================================================
   拨出
   ========================================================================== */

export function startCall(name) {
    if (_state !== 'idle') {
        toast('当前已有通话进行中');
        return;
    }

    const profile = get(KEYS.PROFILE);
    const taName = name || profile.ta.name || 'TA';

    _state = 'outgoing';
    _callStartAt = 0;

    setText(byId('call-modal-name'), taName);
    setText(byId('call-modal-time'), '呼叫中…');
    applyAvatar(byId('call-modal-avatar'), profile.ta.avatar);

    const overlay = byId('call-modal-overlay');
    if (overlay) {
        overlay.hidden = false;
        overlay.dataset.callState = 'outgoing';
    }

    const waitSec = randomInt(OUTGOING_WAIT_MIN, OUTGOING_WAIT_MAX);
    const willReject = Math.random() < OUTGOING_REJECT_RATE;

    _outgoingWaitTimer = setTimeout(() => {
        if (_state !== 'outgoing') return;

        if (willReject) endCall('rejected');
        else startTalking(taName);
    }, waitSec * 1000);

    toast(`正在呼叫 ${taName}…`);
}

function startTalking(taName) {
    _state = 'talking';
    _callStartAt = Date.now();

    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.dataset.callState = 'talking';

    setText(byId('call-modal-time'), '00:00');
    startDurationTimer();

    toast(`已接通 ${taName}`);
}

export function minimizeCall() {
    // 呼叫中 → 直接取消挂断
    if (_state === 'outgoing') {
        endCall('cancelled');
        return;
    }

    // 来电中 → 拒绝
    if (_state === 'incoming') {
        rejectIncoming();
        return;
    }

    // 只在通话中才允许最小化
    if (_state !== 'talking') return;

    _state = 'minimized';
   
    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.hidden = true;

    const mini = byId('mini-call');
    if (mini) {
        mini.hidden = false;
        const profile = get(KEYS.PROFILE);
        setText(byId('mini-call-name'), profile.ta.name || 'TA');
        setText(byId('mini-call-time'), formatDuration(getCurrentDuration()));
        applyAvatar(byId('mini-call-avatar'), profile.ta.avatar);
    }

    const miniInfo = byId('mini-call-info');
    if (miniInfo) {
        miniInfo.style.cursor = 'pointer';
        miniInfo.addEventListener('click', restoreFromMini, { once: true });
    }
    const miniAvatar = byId('mini-call-avatar');
    if (miniAvatar) {
        miniAvatar.style.cursor = 'pointer';
        miniAvatar.addEventListener('click', restoreFromMini, { once: true });
    }
}

function restoreFromMini() {
    if (_state !== 'minimized') return;
    _state = 'talking';

    const mini = byId('mini-call');
    if (mini) mini.hidden = true;

    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.hidden = false;
}


/* ==========================================================================
   挂断 / 结束
   ========================================================================== */

export function hangUp() {
    if (_state === 'incoming') {
        rejectIncoming();
        return;
    }
    if (_state === 'idle') return;
    endCall('ended');
}

function endCall(reason) {
    const duration = getCurrentDuration();
    cleanup();
    hideAllUI();

    if (reason === 'ended' && duration >= 3) {
        recordCall(duration);
        toast(`通话结束 · 时长 ${formatDuration(duration)}`);
        const line = randomPick(CALL_END_LINES);
        bus.emit('chat:system-message', line);
    } else if (reason === 'rejected') {
        const line = randomPick(REJECT_LINES);
        toast(line);
    } else if (reason === 'cancelled') {
    toast('已取消');
    } else if (reason === 'missed') {
    toast('对方未接听');
    bus.emit('chat:system-message', '刚才给你打了个电话，没接通~');
    }

    _state = 'idle';
    _callStartAt = 0;
}

function recordCall(duration) {
    const data = get(KEYS.CALL);
    if (!Array.isArray(data.records)) data.records = [];

    data.records.push({
        id: uid('call'),
        type: 'out',
        name: get(KEYS.PROFILE).ta.name || 'TA',
        duration,
        ts: Date.now()
    });

    if (data.records.length > 100) data.records = data.records.slice(-100);

    set(KEYS.CALL, data);
    bus.emit('call:ended', { duration });
}


/* ==========================================================================
   来电
   ========================================================================== */

export function simulateIncomingCall() {
    if (_state !== 'idle') {
        toast('当前已有通话');
        return;
    }

    _state = 'incoming';
    _incomingCountdown = INCOMING_TIMEOUT;

    const profile = get(KEYS.PROFILE);

    setText(byId('incoming-name'), profile.ta.name || 'TA');
    setText(byId('incoming-status'), '对方来电…');
    setText(byId('incoming-time'), '00:00');
    setText(byId('incoming-countdown'), `${_incomingCountdown} 秒后未接听`);
    applyAvatar(byId('incoming-avatar'), profile.ta.avatar);

    const overlay = byId('incoming-overlay');
    if (overlay) overlay.hidden = false;

    _incomingTimer = setInterval(() => {
        _incomingCountdown--;
        if (_incomingCountdown <= 0) {
            clearInterval(_incomingTimer);
            _incomingTimer = null;
            _state = 'idle';
            hideAllUI();
            toast('对方挂断了');
            bus.emit('chat:system-message', '（未接来电）');
            return;
        }
        setText(byId('incoming-countdown'), `${_incomingCountdown} 秒后未接听`);
    }, 1000);

    toast('来电中…');
}

function acceptIncoming() {
    if (_state !== 'incoming') return;

    if (_incomingTimer) {
        clearInterval(_incomingTimer);
        _incomingTimer = null;
    }

    const incomingOverlay = byId('incoming-overlay');
    if (incomingOverlay) incomingOverlay.hidden = true;

    const overlay = byId('call-modal-overlay');
    if (overlay) {
        overlay.hidden = false;
        overlay.dataset.callState = 'talking';
    }

    const profile = get(KEYS.PROFILE);
    setText(byId('call-modal-name'), profile.ta.name || 'TA');
    setText(byId('call-modal-time'), '00:00');
    applyAvatar(byId('call-modal-avatar'), profile.ta.avatar);

    _state = 'talking';
    _callStartAt = Date.now();
    startDurationTimer();

    toast('已接听');
}

function rejectIncoming() {
    if (_state !== 'incoming') return;

    if (_incomingTimer) {
        clearInterval(_incomingTimer);
        _incomingTimer = null;
    }

    const incomingOverlay = byId('incoming-overlay');
    if (incomingOverlay) incomingOverlay.hidden = true;

    _state = 'idle';
    toast('已拒绝');

    const data = get(KEYS.CALL);
    if (!Array.isArray(data.records)) data.records = [];
    data.records.push({
        id: uid('call'),
        type: 'in',
        name: get(KEYS.PROFILE).ta.name || 'TA',
        duration: 0,
        ts: Date.now()
    });
    set(KEYS.CALL, data);
}


/* ==========================================================================
   计时器
   ========================================================================== */

function startDurationTimer() {
    stopDurationTimer();

    _durationTimer = setInterval(() => {
        const text = formatDuration(getCurrentDuration());

        const bigTime = byId('call-modal-time');
        if (bigTime && _state !== 'outgoing') bigTime.textContent = text;

        const miniTime = byId('mini-call-time');
        if (miniTime && _state === 'minimized') miniTime.textContent = text;
    }, 1000);
}

function stopDurationTimer() {
    if (_durationTimer) clearInterval(_durationTimer);
    _durationTimer = null;
}

function getCurrentDuration() {
    if (!_callStartAt) return 0;
    return Math.floor((Date.now() - _callStartAt) / 1000);
}


/* ==========================================================================
   清理 / UI
   ========================================================================== */

function cleanup() {
    stopDurationTimer();
    if (_outgoingWaitTimer) {
        clearTimeout(_outgoingWaitTimer);
        _outgoingWaitTimer = null;
    }
    if (_incomingTimer) {
        clearInterval(_incomingTimer);
        _incomingTimer = null;
    }
}

function hideAllUI() {
    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.hidden = true;

    const mini = byId('mini-call');
    if (mini) mini.hidden = true;

    const incoming = byId('incoming-overlay');
    if (incoming) incoming.hidden = true;
}


/* ==========================================================================
   头像
   ========================================================================== */

function applyAvatar(container, src) {
    if (!container) return;

    const oldImg = container.querySelector('img.mj-avatar-img');
    const svg = container.querySelector('svg');

    if (src) {
        let img = oldImg;
        if (!img) {
            img = document.createElement('img');
            img.className = 'mj-avatar-img';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            container.appendChild(img);
        }
        img.src = src;
        if (svg) svg.style.display = 'none';
    } else {
        if (oldImg) oldImg.remove();
        if (svg) svg.style.display = '';
    }
}


/* ==========================================================================
   actions
   ========================================================================== */

export const callActions = {
    'start-call':          () => startCall(),
    'minimize-call':       () => minimizeCall(),
    'hang-up':             () => hangUp(),
    'accept-call':         () => acceptIncoming(),
    'reject-call':         () => rejectIncoming(),
    'simulate-incoming-call': () => simulateIncomingCall()
};


export default {
    initCall,
    destroyCall,
    startCall,
    hangUp,
    minimizeCall,
    simulateIncomingCall,
    startIncomingLoop,
    callActions
};
