/* ==========================================================================
   梦角 · Dream Corner
   通话模块  js/modules/call.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #call-modal-overlay   拨出电话弹窗
       - #call-modal-avatar / #call-modal-name / #call-modal-time
       - #btn-minimize-call
     #mini-call            悬浮小窗
       - #mini-call-avatar / #mini-call-name / #mini-call-time
       - #btn-hang-up
     #incoming-overlay     来电弹窗
       - #incoming-avatar / #incoming-name / #incoming-status
       - #incoming-time / #incoming-countdown
       - #btn-accept-call / #btn-reject-call

   状态机：
     idle
      ├─→ outgoing  → talking  → minimized ↔ talking → ended
      └─→ incoming  → (accept) talking / (reject) ended / (timeout) missed

   数据：KEYS.CALL.records 记录每次通话
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
   01. 常量
   ========================================================================== */

/** 来电倒计时秒数 */
const INCOMING_TIMEOUT = 15;

/** 拨出后对方"接听"的等待时长范围（秒） */
const OUTGOING_WAIT_MIN = 3;
const OUTGOING_WAIT_MAX = 8;

/** 拨出后对方拒绝的概率 */
const OUTGOING_REJECT_RATE = 0.15;

/** 通话结束语料（用于聊天里追加一条） */
const CALL_END_LINES = [
    '通话结束，刚刚听到你的声音好开心 ♥',
    '聊得好开心，下次再打给你呀',
    '嗯嗯，那就先这样，想我了再打给我',
    '挂啦挂啦，早点休息哦'
];

/** TA 拒绝时的理由 */
const REJECT_LINES = [
    '（对方暂时无法接听）',
    '（对方拒绝了你的通话）',
    '（对方正忙，稍后再试）'
];


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

/** 当前状态 */
let _state = 'idle';   // idle / outgoing / talking / incoming / minimized

/** 通话开始时间 */
let _callStartAt = 0;

/** 计时器 id */
let _durationTimer = null;
let _outgoingWaitTimer = null;
let _incomingTimer = null;

/** 来电倒计时剩余秒数 */
let _incomingCountdown = INCOMING_TIMEOUT;


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initCall() {
    if (_initialized) return;
    _initialized = true;

    bindButtons();

    _unsubs.push(
        bus.on('call:start', ({ name }) => startCall(name)),
        bus.on('call:simulate-incoming', () => simulateIncomingCall())
    );
}

export function destroyCall() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    cleanup();
    _initialized = false;
}


/* ==========================================================================
   04. 绑定按钮
   ========================================================================== */

function bindButtons() {
    // 拨出弹窗：最小化
    const minimizeBtn = byId('btn-minimize-call');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', minimizeCall);
    }

    // 悬浮小窗：挂断
    const hangupBtn = byId('btn-hang-up');
    if (hangupBtn) {
        hangupBtn.addEventListener('click', hangUp);
    }

    // 来电：接听 / 拒绝
    const acceptBtn = byId('btn-accept-call');
    if (acceptBtn) acceptBtn.addEventListener('click', acceptIncoming);

    const rejectBtn = byId('btn-reject-call');
    if (rejectBtn) rejectBtn.addEventListener('click', rejectIncoming);
}


/* ==========================================================================
   05. 拨出电话
   ========================================================================== */

/**
 * 发起通话
 * @param {string} [name] 通话对象名字，默认从 profile 取
 */
export function startCall(name) {
    if (_state !== 'idle') {
        toast('当前已有通话进行中');
        return;
    }

    const profile = get(KEYS.PROFILE);
    const taName = name || profile.ta.name || 'TA';

    _state = 'outgoing';
    _callStartAt = 0;

    // 更新 UI
    setText(byId('call-modal-name'), taName);
    setText(byId('call-modal-time'), '呼叫中…');
    applyAvatar(byId('call-modal-avatar'), profile.ta.avatar);

    // 显示拨出弹窗
    const overlay = byId('call-modal-overlay');
    if (overlay) {
        overlay.hidden = false;
        overlay.dataset.callState = 'outgoing';
    }

    // 随机决定对方是否接听
    const waitSec = randomInt(OUTGOING_WAIT_MIN, OUTGOING_WAIT_MAX);
    const willReject = Math.random() < OUTGOING_REJECT_RATE;

    _outgoingWaitTimer = setTimeout(() => {
        if (_state !== 'outgoing') return;

        if (willReject) {
            endCall('rejected');
        } else {
            // 对方接听
            startTalking(taName);
        }
    }, waitSec * 1000);

    toast(`正在呼叫 ${taName}…`);
}

/**
 * 从拨出 → 通话中
 */
function startTalking(taName) {
    _state = 'talking';
    _callStartAt = Date.now();

    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.dataset.callState = 'talking';

    setText(byId('call-modal-time'), '00:00');

    // 开始计时
    startDurationTimer();

    toast(`已接通 ${taName}`);
}

/**
 * 最小化到悬浮小窗
 */
export function minimizeCall() {
    if (_state !== 'talking') return;

    _state = 'minimized';

    // 隐藏大弹窗
    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.hidden = true;

    // 显示小窗
    const mini = byId('mini-call');
    if (mini) {
        mini.hidden = false;

        const profile = get(KEYS.PROFILE);
        setText(byId('mini-call-name'), profile.ta.name || 'TA');
        setText(byId('mini-call-time'), formatDuration(getCurrentDuration()));
        applyAvatar(byId('mini-call-avatar'), profile.ta.avatar);
    }

    // 点击小窗主体 → 恢复大弹窗
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

/**
 * 从悬浮小窗恢复到大弹窗
 */
function restoreFromMini() {
    if (_state !== 'minimized') return;
    _state = 'talking';

    const mini = byId('mini-call');
    if (mini) mini.hidden = true;

    const overlay = byId('call-modal-overlay');
    if (overlay) overlay.hidden = false;
}


/* ==========================================================================
   06. 挂断 / 结束
   ========================================================================== */

/**
 * 挂断（从任何状态都可以调用）
 */
export function hangUp() {
    if (_state === 'incoming') {
        rejectIncoming();
        return;
    }
    if (_state === 'idle') return;
    endCall('ended');
}

/**
 * 结束通话
 * @param {string} reason  'ended' / 'rejected' / 'missed'
 */
function endCall(reason) {
    const duration = getCurrentDuration();

    // 停止所有计时
    cleanup();

    // 隐藏所有 UI
    hideAllUI();

    // 若通话时长 > 3 秒才记录（避免误触）
    if (reason === 'ended' && duration >= 3) {
        recordCall(duration);
        toast(`通话结束 · 时长 ${formatDuration(duration)}`);

        // 聊天里追加一条提示
        const line = randomPick(CALL_END_LINES);
        bus.emit('chat:system-message', line);
    } else if (reason === 'rejected') {
        const line = randomPick(REJECT_LINES);
        toast(line);
    } else if (reason === 'missed') {
        toast('对方未接听');
        bus.emit('chat:system-message', '刚才给你打了个电话，没接通~');
    }

    _state = 'idle';
    _callStartAt = 0;
}

/**
 * 记录一次通话
 */
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

    // 只保留最近 100 条
    if (data.records.length > 100) {
        data.records = data.records.slice(-100);
    }

    set(KEYS.CALL, data);
    bus.emit('call:ended', { duration });
}


/* ==========================================================================
   07. 来电
   ========================================================================== */

/**
 * 模拟来电（供 dev 按钮 / bus 触发）
 */
export function simulateIncomingCall() {
    if (_state !== 'idle') {
        toast('当前已有通话');
        return;
    }

    _state = 'incoming';
    _incomingCountdown = INCOMING_TIMEOUT;

    const profile = get(KEYS.PROFILE);

    // 更新 UI
    setText(byId('incoming-name'), profile.ta.name || 'TA');
    setText(byId('incoming-status'), '对方来电…');
    setText(byId('incoming-time'), '00:00');
    setText(byId('incoming-countdown'), `${_incomingCountdown} 秒后未接听`);
    applyAvatar(byId('incoming-avatar'), profile.ta.avatar);

    // 显示来电弹窗
    const overlay = byId('incoming-overlay');
    if (overlay) overlay.hidden = false;

    // 倒计时
    _incomingTimer = setInterval(() => {
        _incomingCountdown--;
        if (_incomingCountdown <= 0) {
            // 超时 → 未接听
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

/**
 * 接听来电
 */
function acceptIncoming() {
    if (_state !== 'incoming') return;

    // 停止倒计时
    if (_incomingTimer) {
        clearInterval(_incomingTimer);
        _incomingTimer = null;
    }

    // 隐藏来电弹窗
    const incomingOverlay = byId('incoming-overlay');
    if (incomingOverlay) incomingOverlay.hidden = true;

    // 显示拨出弹窗（复用为"通话中"界面）
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

/**
 * 拒绝来电
 */
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

    // 记录到通话历史
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
   08. 计时器
   ========================================================================== */

function startDurationTimer() {
    stopDurationTimer();

    _durationTimer = setInterval(() => {
        const text = formatDuration(getCurrentDuration());

        // 大弹窗
        const bigTime = byId('call-modal-time');
        if (bigTime && _state !== 'outgoing') bigTime.textContent = text;

        // 悬浮小窗
        const miniTime = byId('mini-call-time');
        if (miniTime && _state === 'minimized') miniTime.textContent = text;
    }, 1000);
}

function stopDurationTimer() {
    if (_durationTimer) clearInterval(_durationTimer);
    _durationTimer = null;
}

/**
 * 获取当前通话已持续秒数
 */
function getCurrentDuration() {
    if (!_callStartAt) return 0;
    return Math.floor((Date.now() - _callStartAt) / 1000);
}


/* ==========================================================================
   09. 清理 & UI 控制
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
   10. 头像应用
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
   11. 供 app.js 注册的 action 集合
   ========================================================================== */

export const callActions = {
    'start-call':          () => startCall(),
    'minimize-call':       () => minimizeCall(),
    'hang-up':             () => hangUp(),
    'accept-call':         () => acceptIncoming(),
    'reject-call':         () => rejectIncoming(),
    'simulate-incoming-call': () => simulateIncomingCall()
};


/* ==========================================================================
   12. 对外导出
   ========================================================================== */

export default {
    initCall,
    destroyCall,
    startCall,
    hangUp,
    minimizeCall,
    simulateIncomingCall,
    callActions
};