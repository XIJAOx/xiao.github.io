/* ==========================================================================
   梦角 · Dream Corner
   消息记录模块  js/modules/message-stats.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-message-stats
       - #stat-my-count   / #stat-ta-count          我/TA 发送条数
       - #stat-my-top5    / #stat-ta-top5            高频词 TOP5
       - #stat-recent7                               最近 7 天柱状图

   数据来源：KEYS.CHAT.ta.messages

   统计维度：
     1. 我 / TA 的总消息条数
     2. 我 / TA 的高频词 TOP5（中文用 2-gram + 停用词过滤）
     3. 最近 7 天的每日消息量
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    formatDate, formatChatTime,
    escapeHtml
} from '../utils/dom.js';

import { KEYS, get } from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 停用词表（高频但无意义） */
const STOP_WORDS = new Set([
    '的', '了', '是', '我', '你', '他', '她', '它', '们', '这', '那',
    '在', '有', '和', '就', '都', '而', '及', '与', '着', '或', '一个',
    '没有', '自己', '什么', '怎么', '这样', '那样', '因为', '所以',
    '但是', '如果', '可以', '不是', '就是', '这个', '那个', '一下',
    '知道', '觉得', '真的', '其实', '还是', '已经', '不会', '不要',
    '很', '太', '也', '还', '又', '再', '才', '让', '被', '把', '给',
    '吧', '呢', '啊', '呀', '哦', '嗯', '哈', '唉', '哎', '嘛', '咯',
    '一', '二', '三', '不', '没', '要', '会', '能', '想', '去', '来',
    '说', '做', '看', '好', '对', '多', '少', '大', '小', '上', '下'
]);

/** 高频词取前 N */
const TOP_N = 5;

/** 最近天数 */
const RECENT_DAYS = 7;


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initMessageStats() {
    if (_initialized) return;
    _initialized = true;

    render();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-message-stats') render();
        }),
        bus.on('chat:new-message', () => {
            // 若当前正在看这个页面，实时刷新
            const screen = byId('screen-message-stats');
            if (screen && screen.classList.contains('active')) render();
        })
    );
}

export function destroyMessageStats() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 渲染主入口
   ========================================================================== */

export function render() {
    const messages = getMessages();

    renderCounts(messages);
    renderTopWords(messages);
    renderRecent7(messages);
}


/* ==========================================================================
   05. 读取消息
   ========================================================================== */

function getMessages() {
    const chat = get(KEYS.CHAT) || {};
    const ta = chat.ta || {};
    const list = Array.isArray(ta.messages) ? ta.messages : [];
    // 只统计文本消息
    return list.filter((m) => m && m.type === 'text' && m.content);
}


/* ==========================================================================
   06. 条数统计
   ========================================================================== */

function renderCounts(messages) {
    const my = messages.filter((m) => m.role === 'me').length;
    const ta = messages.filter((m) => m.role === 'ta').length;

    setNum('stat-my-count', my);
    setNum('stat-ta-count', ta);
}

function setNum(id, n) {
    const el = byId(id);
    if (el) el.textContent = String(n);
}


/* ==========================================================================
   07. 高频词统计
   --------------------------------------------------------------------------
   中文分词策略：
     1. 按标点 / 空白切成短句
     2. 每个短句里：连续中文按 2-gram 切，英文/数字按原样
     3. 过滤停用词、长度 < 2 的、纯数字/纯标点
     4. 计数后排序取 TOP N
   ========================================================================== */

function renderTopWords(messages) {
    const myTexts = messages.filter((m) => m.role === 'me').map((m) => m.content);
    const taTexts = messages.filter((m) => m.role === 'ta').map((m) => m.content);

    const myWords = countWords(myTexts);
    const taWords = countWords(taTexts);

    renderWordList('stat-my-top5', myWords);
    renderWordList('stat-ta-top5', taWords);
}

/**
 * 统计一组文本的高频词
 * @param {string[]} texts
 * @returns {Array<{word:string, count:number}>}
 */
function countWords(texts) {
    const freq = {};

    texts.forEach((text) => {
        tokenize(text).forEach((word) => {
            if (!word) return;
            if (STOP_WORDS.has(word)) return;
            if (word.length < 2) return;
            if (/^\d+$/.test(word)) return;
            freq[word] = (freq[word] || 0) + 1;
        });
    });

    const arr = Object.entries(freq)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

    return arr.slice(0, TOP_N);
}

/**
 * 简单分词
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
    if (!text) return [];

    const out = [];

    // 按标点 / 空白切段
    const segments = String(text).split(/[\s,，。.！!？?；;：:、"'“”‘’（）()\[\]【】…—\-~]+/);

    segments.forEach((seg) => {
        if (!seg) return;

        // 提取连续的中文段 + 英文/数字段
        // 中文段 → 2-gram；英文/数字 → 整词
        const re = /([\u4e00-\u9fa5]+)|([A-Za-z0-9]+)/g;
        let match;

        while ((match = re.exec(seg)) !== null) {
            const cn = match[1];
            const en = match[2];

            if (cn) {
                if (cn.length === 1) {
                    out.push(cn);
                } else {
                    // 2-gram：滑窗
                    for (let i = 0; i < cn.length - 1; i++) {
                        out.push(cn.slice(i, i + 2));
                    }
                    // 长度 3、4 的整段也加进去
                    if (cn.length <= 4) out.push(cn);
                }
            } else if (en) {
                if (en.length >= 2) out.push(en.toLowerCase());
            }
        }
    });

    return out;
}

/**
 * 渲染高频词列表
 * DOM 结构对齐 CSS：
 *   .stat-keyword-list
 *     .stat-keyword
 *       .stat-keyword-name
 *       .stat-keyword-bar > i
 *       .stat-keyword-count
 */
function renderWordList(containerId, words) {
    const el = byId(containerId);
    if (!el) return;

    if (!words.length) {
        el.className = 'stat-block-empty';
        el.textContent = '暂无数据';
        return;
    }

    el.className = 'stat-keyword-list';
    el.innerHTML = '';

    const max = words[0].count || 1;

    words.forEach((w) => {
        const row = document.createElement('div');
        row.className = 'stat-keyword';

        const nameEl = document.createElement('span');
        nameEl.className = 'stat-keyword-name';
        nameEl.textContent = w.word;

        const barWrap = document.createElement('span');
        barWrap.className = 'stat-keyword-bar';
        const bar = document.createElement('i');
        bar.style.width = `${Math.max(6, (w.count / max) * 100)}%`;
        barWrap.appendChild(bar);

        const countEl = document.createElement('span');
        countEl.className = 'stat-keyword-count';
        countEl.textContent = String(w.count);

        row.appendChild(nameEl);
        row.appendChild(barWrap);
        row.appendChild(countEl);
        el.appendChild(row);
    });
}


/* ==========================================================================
   08. 最近 7 天
   --------------------------------------------------------------------------
   DOM 结构对齐 CSS：
     .stat-week
       .stat-week-item
         .stat-week-bar
         .stat-week-label
   ========================================================================== */

function renderRecent7(messages) {
    const el = byId('stat-recent7');
    if (!el) return;

    // 统计近 7 天
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = RECENT_DAYS - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push({
            date: d,
            ymd: formatDate(d),
            label: `${d.getMonth() + 1}/${d.getDate()}`,
            count: 0
        });
    }

    const map = {};
    days.forEach((d) => { map[d.ymd] = d; });

    messages.forEach((m) => {
        const ymd = formatDate(m.ts);
        if (map[ymd]) map[ymd].count++;
    });

    if (messages.length === 0) {
        el.className = 'stat-block-empty';
        el.textContent = '暂无数据';
        return;
    }

    el.className = 'stat-week';
    el.innerHTML = '';

    const maxCount = Math.max(1, ...days.map((d) => d.count));

    days.forEach((d) => {
        const item = document.createElement('div');
        item.className = 'stat-week-item';
        item.dataset.date = d.ymd;

        const bar = document.createElement('div');
        bar.className = 'stat-week-bar';
        // 高度按占比，最少 4px
        const h = d.count > 0 ? Math.max(6, (d.count / maxCount) * 100) : 2;
        bar.style.height = `${h}%`;
        if (d.count > 0) bar.style.background = 'linear-gradient(180deg, #ffb3c4, #ff6b8a)';

        const label = document.createElement('span');
        label.className = 'stat-week-label';
        label.textContent = d.label;

        item.appendChild(bar);
        item.appendChild(label);

        // 点击显示当天数字
        item.addEventListener('click', () => {
            toast(`${d.label}：${d.count} 条消息`);
        });

        el.appendChild(item);
    });
}


/* ==========================================================================
   09. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const messageStatsActions = {
    // 目前没有额外 action
};

export const messageStatsNavs = {
    'message-stats': () => {
        render();
        showScreen('screen-message-stats');
    }
};


/* ==========================================================================
   10. 对外导出
   ========================================================================== */

export default {
    initMessageStats,
    destroyMessageStats,
    render,
    messageStatsActions,
    messageStatsNavs
};