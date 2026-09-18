/* ==========================================================================
   梦角 · Dream Corner
   喝水模块  js/modules/water.js
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

import { mjPrompt, mjConfirm, mjAlert } from '../utils/dialogs.js';


const CHART_DAYS = 7;

const DEFAULT_REMINDERS = [
    '别忘了喝水',
    '喝一口水吧，好嘛~',
    '水杯空了，我帮你满上',
    '咕嘟咕嘟，该补水啦',
    '今天也要多喝水呀'
];

const TA_REMIND_TEXTS = [
    '记得多喝水哦，我给你倒好了',
    '忙起来也要喝水呀，别让我担心',
    '今天喝水了吗？喝满 8 杯我给你一个抱抱',
    '我刚喝了一杯，你也来一杯吧',
    '水杯就在手边吧？端起来喝一口'
];

let _initialized = false;
let _unsubs = [];


/* ==========================================================================
   入口
   ========================================================================== */

export function initWater() {
    if (_initialized) return;
    _initialized = true;

    ensureWaterData();
    renderAll();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-water') renderAll();
        })
    );
}

export function destroyWater() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   数据
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

function getTodayRecord() {
    const data = ensureWaterData();
    const today = formatDate();
    if (!data.records[today]) {
        data.records[today] = { cups: 0, ml: 0 };
        set(KEYS.WATER, data);
    }
    return data.records[today];
}

function saveTodayRecord(record) {
    const data = ensureWaterData();
    const today = formatDate();
    data.records[today] = record;
    set(KEYS.WATER, data);
}


/* ==========================================================================
   渲染
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

function renderChart() {
    const wrap = byId('water-bars');
    if (!wrap) return;

    const data = ensureWaterData();

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

        const h = day.cups > 0
            ? Math.max(8, (day.cups / maxCups) * 100)
            : 6;
        bar.style.height = `${h}%`;

        const label = document.createElement('div');
        label.className = 'water-bar-label';
        label.textContent = day.label;

        item.appendChild(bar);
        item.appendChild(label);

        item.addEventListener('click', () => {
            toast(`${day.ymd}：${day.cups} 杯`);
        });

        wrap.appendChild(item);
    });
}


/* ==========================================================================
   加减一杯
   ========================================================================== */

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
   发到聊天 / TA 提醒 / 换提醒语
   ========================================================================== */

export function sendToChat() {
    const data = ensureWaterData();
    const rec = getTodayRecord();
    const text = `我今天喝了 ${rec.cups} 杯水（${rec.ml} ml）~ 你也要多喝水呀 💧`;
    bus.emit('chat:system-message', text);
    toast('已发送到聊天');
    bus.emit('nav:chat');
}

export function remindFromTa() {
    const text = randomPick(TA_REMIND_TEXTS);
    bus.emit('chat:ta-message', text);
    toast('TA 已经提醒你啦 💌');
}

export function refreshReminder() {
    const data = ensureWaterData();
    const pool = data.reminders.length ? data.reminders : DEFAULT_REMINDERS;
    const remindBtn = byId('btn-water-remind');
    if (remindBtn) remindBtn.textContent = `"${randomPick(pool)}"`;
    toast('换了一句提醒');
}


/* ==========================================================================
   设置
   ========================================================================== */

export async function setGoal() {
    const data = ensureWaterData();
    const input = await mjPrompt('每天目标杯数', {
        placeholder: '1 - 30 杯',
        defaultValue: String(data.goal),
        confirmText: '保存'
    });
    if (input === null) return;

    const n = parseInt(String(input).trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > 30) {
        toast('请输入 1-30 之间的数字');
        return;
    }

    data.goal = n;
    set(KEYS.WATER, data);
    renderAll();
    toast(`目标已设为 ${n} 杯`);
}

export async function setVolume() {
    const data = ensureWaterData();
    const input = await mjPrompt('每杯容量（ml）', {
        placeholder: '50 - 1000',
        defaultValue: String(data.volumePerCup),
        confirmText: '保存'
    });
    if (input === null) return;

    const n = parseInt(String(input).trim(), 10);
    if (Number.isNaN(n) || n < 50 || n > 1000) {
        toast('请输入 50-1000 之间的数字');
        return;
    }

    data.volumePerCup = n;
    const rec = getTodayRecord();
    rec.ml = (rec.cups || 0) * n;
    data.records[formatDate()] = rec;
    set(KEYS.WATER, data);

    renderAll();
    toast(`单杯已设为 ${n} ml`);
}

export async function addReminder() {
    const text = await mjPrompt('写一句提醒自己的话', {
        placeholder: '例如：多喝水皮肤好',
        confirmText: '添加'
    });
    if (text === null) return;
    const trimmed = String(text).trim();
    if (!trimmed) return;

    const data = ensureWaterData();
    data.reminders.push(trimmed);
    set(KEYS.WATER, data);

    const remindBtn = byId('btn-water-remind');
    if (remindBtn) remindBtn.textContent = `"${trimmed}"`;

    toast('提醒语已添加');
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const waterActions = {
    'water-plus':         () => changeCups(1),
    'water-minus':        () => changeCups(-1),
    'water-send-chat':    () => sendToChat(),
    'water-ta-remind':    () => remindFromTa(),
    'water-remind':       () => refreshReminder(),
    'water-set-goal':     () => setGoal(),
    'water-set-volume':   () => setVolume(),
    'water-add-reminder': () => addReminder()
};

export const waterNavs = {
    'water': () => {
        ensureWaterData();
        renderAll();
        showScreen('screen-water');
    }
};

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
