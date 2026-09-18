/* ==========================================================================
   梦角 · Dream Corner
   占卜模块  js/modules/divine.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-divine
       - #divine-options（塔罗 / 雷诺曼 切换）
       - #divine-question（问题输入）
       - #divine-counts（1 / 3 / 7 张）
       - #btn-start-divine（开始占卜）
       - #divine-result（结果区）

   数据来源：本地牌库（本文件内），洗牌后随机抽 N 张，附正逆位。
   结果保存到 KEYS.DIVINE。
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setVisible, setText,
    setActiveInGroup,
    formatChatTime,
    uid, shuffle,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 塔罗牌库（78 张）
   --------------------------------------------------------------------------
   数据格式：{ name, upright, reversed }
   ========================================================================== */

/** 大阿卡纳 22 张 */
const TAROT_MAJOR = [
    { name: '愚者',       upright: '新的开始、冒险、纯真、自由', reversed: '鲁莽、不切实际、盲目' },
    { name: '魔术师',     upright: '创造、行动、能力、资源掌控', reversed: '欺骗、操控、才能未发挥' },
    { name: '女祭司',     upright: '直觉、潜意识、神秘、内在智慧', reversed: '压抑直觉、表面化、秘密' },
    { name: '女皇',       upright: '丰饶、母性、滋养、感性', reversed: '依赖、过度保护、忽视自我' },
    { name: '皇帝',       upright: '权威、秩序、稳定、掌控', reversed: '专制、僵化、失控' },
    { name: '教皇',       upright: '传统、信仰、指导、教导', reversed: '教条、反叛、束缚' },
    { name: '恋人',       upright: '爱情、结合、选择、和谐', reversed: '分离、诱惑、价值冲突' },
    { name: '战车',       upright: '意志、胜利、前进、征服', reversed: '方向迷失、失控、失败' },
    { name: '力量',       upright: '勇气、耐心、温柔的力量', reversed: '软弱、自我怀疑、暴躁' },
    { name: '隐士',       upright: '内省、独处、寻求真理', reversed: '孤独、封闭、逃避' },
    { name: '命运之轮',   upright: '转变、机遇、循环、命运', reversed: '厄运、抗拒改变、失控' },
    { name: '正义',       upright: '公平、真相、因果、平衡', reversed: '不公、偏见、逃避责任' },
    { name: '倒吊人',     upright: '停顿、牺牲、换个角度', reversed: '拖延、无谓牺牲、僵局' },
    { name: '死神',       upright: '结束、蜕变、放下、重生', reversed: '抗拒改变、停滞、旧有执念' },
    { name: '节制',       upright: '平衡、融合、耐心、中庸', reversed: '失衡、极端、急躁' },
    { name: '恶魔',       upright: '欲望、束缚、物质、执念', reversed: '解脱、觉醒、挣脱枷锁' },
    { name: '高塔',       upright: '突变、崩塌、觉醒、解放', reversed: '延迟灾难、避免危机、恐惧改变' },
    { name: '星星',       upright: '希望、灵感、平静、疗愈', reversed: '失望、迷惘、失去信心' },
    { name: '月亮',       upright: '潜意识、幻象、不安、直觉', reversed: '真相浮现、恐惧消散、释怀' },
    { name: '太阳',       upright: '成功、喜悦、活力、光明', reversed: '暂时受挫、过于乐观、虚荣' },
    { name: '审判',       upright: '觉醒、召唤、重生、宽恕', reversed: '自我怀疑、逃避召唤、悔恨' },
    { name: '世界',       upright: '完成、圆满、整合、旅程终点', reversed: '未竟、停滞、缺憾' }
];

/** 生成小阿卡纳一套 14 张 */
function buildMinor(suit, suitCN) {
    const ranks = [
        { r: 'Ace',   cn: '一',   up: '纯粹的能量与新的开始', rev: '能量受阻、延迟' },
        { r: 'Two',   cn: '二',   up: '选择、平衡、等待',       rev: '犹豫、失衡' },
        { r: 'Three', cn: '三',   up: '初步成果、合作',         rev: '干扰、拖延' },
        { r: 'Four',  cn: '四',   up: '稳定、巩固、停顿',       rev: '固步自封、停滞' },
        { r: 'Five',  cn: '五',   up: '冲突、挑战、损失',       rev: '走出困境、和解' },
        { r: 'Six',   cn: '六',   up: '和谐、给予、回报',       rev: '失衡、亏欠' },
        { r: 'Seven', cn: '七',   up: '评估、选择、坚持',       rev: '迷茫、放弃' },
        { r: 'Eight', cn: '八',   up: '行动、快速、进展',       rev: '延迟、阻碍' },
        { r: 'Nine',  cn: '九',   up: '接近完成、考验',         rev: '焦虑、戒备' },
        { r: 'Ten',   cn: '十',   up: '完成、总结、循环终点',   rev: '负担、未竟' },
        { r: 'Page',  cn: '侍从', up: '学习、消息、新的机会',   rev: '分心、坏消息' },
        { r: 'Knight',cn: '骑士', up: '行动、追求、冒险',       rev: '鲁莽、停滞' },
        { r: 'Queen', cn: '王后', up: '成熟、关怀、内在掌握',   rev: '情绪化、控制欲' },
        { r: 'King',  cn: '国王', up: '掌控、权威、成熟',       rev: '独断、固执' }
    ];
    return ranks.map((r) => ({
        name: `${suitCN}${r.cn}`,
        upright: r.up,
        reversed: r.rev
    }));
}

const TAROT_MINOR = [
    ...buildMinor('wands',    '权杖'),
    ...buildMinor('cups',     '圣杯'),
    ...buildMinor('swords',   '宝剑'),
    ...buildMinor('pentacles','星币')
];

/** 塔罗全集 78 张 */
const TAROT_DECK = [...TAROT_MAJOR, ...TAROT_MINOR];


/* ==========================================================================
   02. 雷诺曼牌库（36 张）
   ========================================================================== */

const LENORMAND_DECK = [
    { name: '骑士',     upright: '消息、来访、行动',       reversed: '延迟、错失消息' },
    { name: '四叶草',   upright: '好运、小确幸、短暂',     reversed: '运气不佳、错失' },
    { name: '船',       upright: '远行、离别、探索',       reversed: '推迟、返回、受阻' },
    { name: '房子',     upright: '家、稳定、安全',         reversed: '家庭矛盾、不安' },
    { name: '树',       upright: '健康、成长、根基',       reversed: '健康欠佳、停滞' },
    { name: '云',       upright: '困惑、不确定、迷雾',     reversed: '云开雾散、真相' },
    { name: '蛇',       upright: '欺骗、绕路、女性',       reversed: '识破谎言、解脱' },
    { name: '棺材',     upright: '结束、悲伤、转化',       reversed: '走出低谷、重生' },
    { name: '花束',     upright: '礼物、惊喜、欣赏',       reversed: '失望、虚假恭维' },
    { name: '镰刀',     upright: '突然的切断、决断',       reversed: '意外、伤害、迟疑' },
    { name: '鞭子',     upright: '争执、重复、锻炼',       reversed: '和解、停止争吵' },
    { name: '鸟',       upright: '交流、会谈、焦虑',       reversed: '失言、误会' },
    { name: '孩子',     upright: '新的开始、纯真、小事',   reversed: '幼稚、拖延' },
    { name: '狐狸',     upright: '机敏、工作、防备',       reversed: '被识破、坦诚' },
    { name: '熊',       upright: '力量、权威、财富',       reversed: '专制、失控' },
    { name: '星星',     upright: '希望、指引、梦想',       reversed: '失望、迷失方向' },
    { name: '鹳',       upright: '改变、迁移、新生',       reversed: '停滞、推迟' },
    { name: '狗',       upright: '忠诚、朋友、信任',       reversed: '背叛、孤立' },
    { name: '塔',       upright: '孤立、权威、正式',       reversed: '打破束缚、亲近' },
    { name: '花园',     upright: '社交、聚会、公开',       reversed: '独处、社交疏离' },
    { name: '山',       upright: '阻碍、延迟、难题',       reversed: '翻越障碍、突破' },
    { name: '岔路',     upright: '选择、决策、路径',       reversed: '犹豫、走错方向' },
    { name: '老鼠',     upright: '损耗、焦虑、渐失',       reversed: '止损、恢复' },
    { name: '心',       upright: '爱情、热情、真心',       reversed: '伤心、冷淡' },
    { name: '戒指',     upright: '承诺、契约、结合',       reversed: '破裂、解除约定' },
    { name: '书',       upright: '秘密、知识、学习',       reversed: '真相揭露、未知' },
    { name: '信',       upright: '信件、文件、消息',       reversed: '坏消息、误传' },
    { name: '男人',     upright: '男性、主动方',           reversed: '--' },
    { name: '女人',     upright: '女性、被动方',           reversed: '--' },
    { name: '百合',     upright: '平静、成熟、纯洁',       reversed: '冲突、不成熟' },
    { name: '太阳',     upright: '成功、活力、温暖',       reversed: '暂时阴霾、疲惫' },
    { name: '月亮',     upright: '情感、直觉、认可',       reversed: '情绪化、迷茫' },
    { name: '钥匙',     upright: '关键、解答、机会',       reversed: '无解、错过' },
    { name: '鱼',       upright: '财富、流动、丰盛',       reversed: '破财、停滞' },
    { name: '锚',       upright: '稳定、坚持、锚定',       reversed: '漂泊、放弃' },
    { name: '十字',     upright: '命运、负担、考验',       reversed: '解脱、放下' }
];


/* ==========================================================================
   03. 牌阵说明
   ========================================================================== */

/** 1 张牌时的位置说明 */
const SPREAD_1 = ['指引'];

/** 3 张牌时的位置说明 */
const SPREAD_3 = ['过去', '现在', '未来'];

/** 7 张牌时的位置说明（简化版凯尔特十字） */
const SPREAD_7 = [
    '现状',
    '阻碍',
    '目标',
    '根基',
    '过去',
    '未来',
    '建议'
];

/** 根据张数返回位置数组 */
function getSpread(count) {
    if (count === 1) return SPREAD_1;
    if (count === 3) return SPREAD_3;
    if (count === 7) return SPREAD_7;
    return [];
}


/* ==========================================================================
   04. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];
let _currentType = 'tarot';   // tarot / lenormand
let _currentCount = 1;


/* ==========================================================================
   05. 入口
   ========================================================================== */

export function initDivine() {
    if (_initialized) return;
    _initialized = true;

    bindTypeSwitch();
    bindCountSwitch();
    bindStartButton();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-divine') {
                // 每次进入清空上次结果
                hideResult();
            }
        })
    );
}

export function destroyDivine() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   06. 牌种切换（塔罗 / 雷诺曼）
   ========================================================================== */

function bindTypeSwitch() {
    const wrap = byId('divine-options');
    if (!wrap) return;

    wrap.addEventListener('click', (e) => {
        const card = e.target.closest('[data-divine-type]');
        if (!card) return;
        switchType(card.dataset.divineType);
    });
}

/**
 * 切换牌种
 * @param {string} type  tarot / lenormand
 */
export function switchType(type) {
    if (type !== 'tarot' && type !== 'lenormand') return;
    _currentType = type;

    const wrap = byId('divine-options');
    if (wrap) {
        wrap.querySelectorAll('[data-divine-type]').forEach((el) => {
            const active = el.dataset.divineType === type;
            el.classList.toggle('active', active);
            el.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    // 切换提示文案
    const note = byId('divine-note');
    if (note) {
        note.textContent = type === 'tarot'
            ? '塔罗共 78 张 · 结果随机 · 每次重新洗牌'
            : '雷诺曼共 36 张 · 结果随机 · 每次重新洗牌';
    }

    // 清空上次结果
    hideResult();
}


/* ==========================================================================
   07. 张数切换
   ========================================================================== */

function bindCountSwitch() {
    const wrap = byId('divine-counts');
    if (!wrap) return;

    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-divine-count]');
        if (!btn) return;
        switchCount(parseInt(btn.dataset.divineCount, 10));
    });
}

/**
 * 切换抽牌张数
 * @param {number} n  1 / 3 / 7
 */
export function switchCount(n) {
    if (![1, 3, 7].includes(n)) return;
    _currentCount = n;

    const wrap = byId('divine-counts');
    if (wrap) {
        wrap.querySelectorAll('[data-divine-count]').forEach((btn) => {
            const active = parseInt(btn.dataset.divineCount, 10) === n;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    hideResult();
}


/* ==========================================================================
   08. 开始占卜
   ========================================================================== */

function bindStartButton() {
    const btn = byId('btn-start-divine');
    if (!btn) return;
    btn.addEventListener('click', startDivine);
}

/**
 * 执行占卜
 */
export function startDivine() {
    const questionEl = byId('divine-question');
    const question = (questionEl?.value || '').trim();

    if (!question) {
        toast('先写下你想问的问题吧');
        questionEl?.focus();
        return;
    }

    // 取牌库
    const deck = _currentType === 'tarot' ? TAROT_DECK : LENORMAND_DECK;

    // 抽牌
    const drawn = drawCards(deck, _currentCount);

    // 展示
    showResult(question, drawn);

    // 保存记录
    saveRecord({
        type: _currentType,
        question,
        count: _currentCount,
        cards: drawn
    });
}

/**
 * 从牌库中抽 n 张，附正逆位
 * @param {Array} deck
 * @param {number} n
 * @returns {Array<{name, meaning, position, isReversed, orientation, positionName}>}
 */
function drawCards(deck, n) {
    // 洗牌
    const shuffled = shuffle(deck);
    const picked = shuffled.slice(0, n);

    const positions = getSpread(n);

    return picked.map((card, i) => {
        const isReversed = Math.random() < 0.5;
        return {
            name: card.name,
            meaning: isReversed ? card.reversed : card.upright,
            isReversed,
            orientation: isReversed ? '逆位' : '正位',
            positionName: positions[i] || `第 ${i + 1} 张`
        };
    });
}


/* ==========================================================================
   09. 结果展示
   --------------------------------------------------------------------------
   DOM 结构对齐 CSS：
     .divine-result
       .divine-result-card
         .divine-result-name
         .divine-result-position
         .divine-result-desc
   ========================================================================== */

function showResult(question, cards) {
    const wrap = byId('divine-result');
    if (!wrap) return;

    wrap.innerHTML = '';
    wrap.hidden = false;

    // 顶部：问题回顾
    const qEl = document.createElement('div');
    qEl.style.cssText = 'font-size:13px;color:var(--c-text-3);margin-bottom:4px;';
    qEl.textContent = '你的问题';
    wrap.appendChild(qEl);

    const qText = document.createElement('div');
    qText.style.cssText = 'font-size:15px;font-weight:600;color:var(--c-text-1);margin-bottom:12px;line-height:1.6;word-break:break-word;';
    qText.textContent = question;
    wrap.appendChild(qText);

    // 每张牌
    cards.forEach((card) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'divine-result-card';

        const nameEl = document.createElement('div');
        nameEl.className = 'divine-result-name';
        nameEl.textContent = `${card.name} · ${card.orientation}`;

        const posEl = document.createElement('div');
        posEl.className = 'divine-result-position';
        posEl.textContent = `位置：${card.positionName}`;

        const descEl = document.createElement('div');
        descEl.className = 'divine-result-desc';
        descEl.textContent = card.meaning;

        cardEl.appendChild(nameEl);
        cardEl.appendChild(posEl);
        cardEl.appendChild(descEl);
        wrap.appendChild(cardEl);
    });

    // 底部：综合提示
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:var(--c-text-3);text-align:center;padding:8px 0 0;';
    note.textContent = '牌义仅供参考，答案其实一直在你心里。';
    wrap.appendChild(note);

    // 滚动到结果
    setTimeout(() => {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * 隐藏结果
 */
function hideResult() {
    const wrap = byId('divine-result');
    if (!wrap) return;
    wrap.hidden = true;
    wrap.innerHTML = '';
}


/* ==========================================================================
   10. 保存记录
   ========================================================================== */

function saveRecord(record) {
    const data = get(KEYS.DIVINE);
    if (!Array.isArray(data.records)) data.records = [];

    data.records.push({
        id: uid('divine'),
        ts: Date.now(),
        ...record
    });

    // 只保留最近 100 条
    if (data.records.length > 100) {
        data.records = data.records.slice(-100);
    }

    set(KEYS.DIVINE, data);
    bus.emit('divine:new', record);
}


/* ==========================================================================
   11. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const divineActions = {
    'start-divine': () => startDivine()
};

export const divineNavs = {
    'divine': () => {
        hideResult();
        showScreen('screen-divine');
    }
};


/* ==========================================================================
   12. 对外导出
   ========================================================================== */

export default {
    initDivine,
    destroyDivine,
    switchType,
    switchCount,
    startDivine,
    divineActions,
    divineNavs
};