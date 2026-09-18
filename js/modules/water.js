/* ==========================================================================
   梦角 · Dream Corner
   喝水模块  js/modules/water.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-water
       - #water-count / #water-sub             今日大数字
       - #water-progress-bar                   进度条
       - #water-cups > .water-cup[data-cup-index]  8 个杯子
       - #water-bars > .water-bar-item[data-date]  近 7 天柱状
       - #btn-water-minus / #btn-water-plus    加减
       - #btn-water-remind                     提醒按钮
       - #btn-water-send-chat / #btn-water-ta-remind   发到聊天 / TA 提醒
       - #btn-water-set-goal / #btn-water-set-volume / #btn-water-add-reminder

   数据结构（KEYS.WATER）：
     {
       goal: 8,               // 目标杯数
       volumePerCup: 250,     // 每杯毫升
       records: {
         'YYYY-MM-DD': { cups, ml }
       },
       reminders: ['别忘了喝水', ...]   // 自定义提醒语
     }
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setText, setVisible,
    formatDate, formatChatTime,
    uid, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 图表展示最近 N 天 */
const CHART_DAYS = 7;

/** 默认提醒语池 */
const DEFAULT_REMINDERS = [
    '别忘了喝水',
    '喝一口水吧，好嘛~',
    '水杯空了，我帮你满上',
    '咕嘟咕嘟，该补水啦',
    '今天也要多喝水呀'
];

/** TA 提醒的语料池 */
const TA_REMIND_TEXTS = [
    '记得多喝水哦，我给你倒好了',
    '忙起来也要喝水呀，别让我担心',
    '今天喝水了吗？喝满 8 杯我给你一个抱抱',
    '我刚喝了一杯，你也来一杯吧',
    '水杯就在手边吧？端起来喝一口'
];


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initWater() {
    if (_initialized) return;
    _initialized = true;

    ensureWaterData();
    bindMainButtons();
    bindActionButtons();
    bindSettingButtons();

    renderAll();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-water') {
                renderAll();
            }
        })
    );
}

export function destroyWater() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensureWaterData() {
    const data = get(KEYS.WATER);
    if (typeof data.goal !== 'number' || data.goal < 1) data.goal = 8;
    if (typeof data.volumePerCup !== 'number' || data.volumePerCup < 1) {
        data.volumePerCup = 250;
    }
    if (!data.records || typeof data.records !== 'object') data.records = {};
    if (!Array.isArray(data.reminders)) data.reminders = [];
    set(KEYS.WATER, data);
    return data;
}

/**
 * 取今天的记录（不存在则创建）
 */
function getTodayRecord() {
    const data = ensureWaterData();
    const today = formatDate();
    if (!data.records[today]) {
        data.records[today] = { cups: 0, ml: 0 };
        set(KEYS.WATER, data);
    }
    return data.records[today];
}

/**
 * 保存今天的记录
 */
function saveTodayRecord(record) {
    const data = ensureWaterData();
    const today = formatDate();
    data.records[today] = record;
    set(KEYS.WATER, data);
}


/* ==========================================================================
   05. 渲染：全部
   ========================================================================== */

function renderAll() {
    renderMainCard();
    renderCups();
    renderChart();
    renderProgress();
}

function renderMainCard() {
    const data = ensureWaterData();
    const rec = getTodayRecord();

    const countEl = byId('water-count');
    if (countEl) countEl.textContent = String(rec.cups || 0);

    const subEl = byId('water-sub');
    if (subEl) {
        subEl.textContent = `${rec.cups || 0} 杯 · ${rec.ml || 0} ml / ${data.goal} 杯 · ${data.goal * data.volumePerCup} ml`;
    }
}

function renderProgress() {
    const data = ensureWaterData();
    const rec = getTodayRecord();
    const bar = byId('water-progress-bar');
    if (!bar) return;

    const pct = Math.min(100, ((rec.cups || 0) / data.goal) * 100);
    bar.style.width = `${pct}%`;
}

function renderCups() {
    const wrap = byId('water-cups');
    if (!wrap) return;

    const rec = getTodayRecord();
    wrap.querySelectorAll('.water-cup').forEach((cup) => {
        const idx = parseInt(cup.dataset.cupIndex, 10);
        cup.classList.toggle('filled', idx <= (rec.cups || 0));
    });
}


/* ==========================================================================
   06. 渲染：近 7 天柱状图
   --------------------------------------------------------------------------
   DOM：
     .water-bars
       .water-bar-item[data-date] > .water-bar + .water-bar-label
   ========================================================================== */

function renderChart() {
    const wrap = byId('water-bars');
    if (!wrap) return;

    const data = ensureWaterData();

    // 生成最近 7 天
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = CHART_DAYS - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ymd = formatDate(d);
        const rec = data.records[ymd] || { cups: 0, ml: 0 };
        days.push({
            ymd,
            label: String(d.getDate()),
            cups: rec.cups || 0,
            isToday: i === 0
        });
    }

    const maxCups = Math.max(data.goal, ...days.map((d) => d.cups)) || 8;

    wrap.innerHTML = '';
    days.forEach((day) => {
        const item = document.createElement('div');
        item.className = 'water-bar-item';
        item.dataset.date = day.ymd;

        const bar = document.createElement('div');
        bar.className = 'water-bar';
        if (day.isToday) bar.classList.add('active');

        // 高度：按 cups / maxCups 比例，最低 6px
        const h = day.cups > 0
            ? Math.max(8, (day.cups / maxCups) * 100)
            : 6;
        bar.style.height = `${h}%`;

        const label = document.createElement('div');
        label.className = 'water-bar-label';
        label.textContent = day.label;

        item.appendChild(bar);
        item.appendChild(label);

        // 点击显示当天数据
        item.addEventListener('click', () => {
            toast(`${day.ymd}：${day.cups} 杯`);
        });

        wrap.appendChild(item);
    });
}


/* ==========================================================================
   07. 交互：加减
   ========================================================================== */

function bindMainButtons() {
    const plus = byId('btn-water-plus');
    const minus = byId('btn-water-minus');

    if (plus) plus.addEventListener('click', () => changeCups(1));
    if (minus) minus.addEventListener('click', () => changeCups(-1));
}

/**
 * 加减一杯
 * @param {number} delta  +1 / -1
 */
export function changeCups(delta) {
    const data = ensureWaterData();
    const rec = getTodayRecord();

    let next = (rec.cups || 0) + delta;
    if (next < 0) next = 0;
    if (next > 30) next = 30;

    if (next === rec.cups) {
        if (delta > 0) toast('今天已经喝很多啦～');
        return;
    }

    rec.cups = next;
    rec.ml = next * data.volumePerCup;
    saveTodayRecord(rec);

    renderMainCard();
    renderCups();
    renderProgress();
    renderChart();

    // 达到目标时祝贺
    if (delta > 0 && next === data.goal) {
        toast('达成今日目标！好棒 🎉');
        bus.emit('water:goal-reached', { cups: next });
    } else if (delta > 0) {
        toast(`+1 杯，共 ${next} 杯`);
    } else {
        toast(`-1 杯，共 ${next} 杯`);
    }
}


/* ==========================================================================
   08. 交互：发到聊天 / TA 提醒 / 提醒按钮
   ========================================================================== */

function bindActionButtons() {
    const sendChat = byId('btn-water-send-chat');
    if (sendChat) {
        sendChat.addEventListener('click', () => {
            const data = ensureWaterData();
            const rec = getTodayRecord();
            const text = `我今天喝了 ${rec.cups} 杯水（${rec.ml} ml）~ 你也要多喝水呀 💧`;
            bus.emit('chat:system-message', text);
            toast('已发送到聊天');
            bus.emit('nav:chat');
        });
    }

    const taRemind = byId('btn-water-ta-remind');
    if (taRemind) {
        taRemind.addEventListener('click', () => {
            const text = randomPick(TA_REMIND_TEXTS);
            // 由 chat 模块去追加一条 TA 消息
            bus.emit('chat:ta-message', text);
            toast('TA 已经提醒你啦 💌');
        });
    }

    const remindBtn = byId('btn-water-remind');
    if (remindBtn) {
        remindBtn.addEventListener('click', () => {
            const data = ensureWaterData();
            const pool = data.reminders.length ? data.reminders : DEFAULT_REMINDERS;
            remindBtn.textContent = `"${randomPick(pool)}"`;
            toast('换了一句提醒');
        });
    }
}


/* ==========================================================================
   09. 交互：设置（目标 / 单次量 / 加提醒）
   ========================================================================== */

function bindSettingButtons() {
    const goalBtn = byId('btn-water-set-goal');
    if (goalBtn) goalBtn.addEventListener('click', setGoal);

    const volumeBtn = byId('btn-water-set-volume');
    if (volumeBtn) volumeBtn.addEventListener('click', setVolume);

    const reminderBtn = byId('btn-water-add-reminder');
    if (reminderBtn) reminderBtn.addEventListener('click', addReminder);
}

/**
 * 设置目标杯数
 */
export function setGoal() {
    const data = ensureWaterData();
    const input = window.prompt('每天目标杯数（1-30）：', String(data.goal));
    if (input === null) return;

    const n = parseInt(input, 10);
    if (Number.isNaN(n) || n < 1 || n > 30) {
        toast('请输入 1-30 之间的数字');
        return;
    }

    data.goal = n;
    set(KEYS.WATER, data);
    renderAll();
    toast(`目标已设为 ${n} 杯`);
}

/**
 * 设置单杯容量
 */
export function setVolume() {
    const data = ensureWaterData();
    const input = window.prompt('每杯容量（ml，50-1000）：', String(data.volumePerCup));
    if (input === null) return;

    const n = parseInt(input, 10);
    if (Number.isNaN(n) || n < 50 || n > 1000) {
        toast('请输入 50-1000 之间的数字');
        return;
    }

    data.volumePerCup = n;
    // 重新计算今天 ml
    const rec = getTodayRecord();
    rec.ml = (rec.cups || 0) * n;
    data.records[formatDate()] = rec;
    set(KEYS.WATER, data);

    renderAll();
    toast(`单杯已设为 ${n} ml`);
}

/**
 * 添加自定义提醒语
 */
export function addReminder() {
    const text = window.prompt('写一句提醒自己的话：', '');
    if (text === null) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const data = ensureWaterData();
    data.reminders.push(trimmed);
    set(KEYS.WATER, data);

    // 立刻应用
    const remindBtn = byId('btn-water-remind');
    if (remindBtn) remindBtn.textContent = `"${trimmed}"`;

    toast('提醒语已添加');
}


/* ==========================================================================
   10. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const waterActions = {
    'water-plus':       () => changeCups(1),
    'water-minus':      () => changeCups(-1),
    'water-send-chat':  () => byId('btn-water-send-chat')?.click(),
    'water-ta-remind':  () => byId('btn-water-ta-remind')?.click(),
    'water-remind':     () => byId('btn-water-remind')?.click(),
    'water-set-goal':   () => setGoal(),
    'water-set-volume': () => setVolume(),
    'water-add-reminder': () => addReminder()
};

export const waterNavs = {
    'water': () => {
        ensureWaterData();
        renderAll();
        showScreen('screen-water');
    }
};


/* ==========================================================================
   11. 对外导出
   ========================================================================== */

export default {
    initWater,
    destroyWater,
    changeCups,
    setGoal,
    setVolume,
    addReminder,
    waterActions,
    waterNavs
};