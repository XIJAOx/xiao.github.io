/* ==========================================================================
   梦角 · Dream Corner
   提问模块  js/modules/questions.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-questions
       - #question-tabs（我的提问 / TA 的提问）
       - #btn-questions-add（新建提问）
       - #question-list（列表）
       - #question-empty（空状态）
       - #question-note（底部说明）
       - #question-create-panel（底部弹层）
         - #btn-question-create-close
         - #question-create-body（动态题目列表）
         - #btn-question-add-item / #btn-question-save

   数据结构（KEYS.QUESTIONS）：
     {
       my: [
         {
           id, items: [{ text, type }], ts, status,
           answers: [[...], [...]],   // 每题答案（单选是 [i]，多选是 [i,j]）
           answeredAt
         }
       ],
       ta: [ 同上 ]
     }

     type: 'single' | 'multiple'
     status: 'pending' | 'answered'
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setVisible, setText,
    formatChatTime,
    uid, randomInt, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

const TABS = {
    MY: 'my',   // 我的提问（我发起，TA 回答）
    TA: 'ta'    // TA 的提问（TA 发起，我回答）
};

/** 单次提问最多题目数 */
const MAX_QUESTIONS = 10;

/** 单选/多选的默认选项（用于 TA 回答时模拟） */
const DEFAULT_OPTIONS = ['是', '否', '不确定'];

/** 模拟 TA 回答时的通用选项池 */
const TA_OPTION_POOL = [
    ['会', '不会', '看情况'],
    ['喜欢', '一般', '不喜欢'],
    ['经常', '偶尔', '从不'],
    ['当然', '也许吧', '不太想'],
    ['开心', '平静', '难过'],
    ['听你的', '听我的', '商量一下']
];


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];
let _currentTab = TABS.MY;

/** 新建面板里当前题目数量（控制 id 递增） */
let _createItemCount = 1;


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initQuestions() {
    if (_initialized) return;
    _initialized = true;

    ensureQuestionsData();
    bindTabs();
    bindAddButton();
    bindCreatePanel();

    renderCurrentTab();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-questions') {
                renderCurrentTab();
            }
        })
    );
}

export function destroyQuestions() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensureQuestionsData() {
    const data = get(KEYS.QUESTIONS);
    if (!Array.isArray(data.my)) data.my = [];
    if (!Array.isArray(data.ta)) data.ta = [];

    // 首次给 TA 填充一条示例，便于展示
    if (data.ta.length === 0 && data.my.length === 0) {
        data.ta.push({
            id: uid('q'),
            items: [
                { text: '今天想我了吗？', type: 'single' },
                { text: '周末想做什么？', type: 'multiple' }
            ],
            ts: Date.now() - 3600 * 1000,
            status: 'pending',
            answers: null,
            answeredAt: null
        });
    }

    set(KEYS.QUESTIONS, data);
    return data;
}

function getList(tab) {
    const data = ensureQuestionsData();
    return data[tab] || [];
}

function saveList(tab, list) {
    const data = get(KEYS.QUESTIONS);
    data[tab] = list;
    set(KEYS.QUESTIONS, data);
}


/* ==========================================================================
   05. Tab 切换
   ========================================================================== */

function bindTabs() {
    const wrap = byId('question-tabs');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-question-tab]');
        if (!btn) return;
        switchTab(btn.dataset.questionTab);
    });
}

export function switchTab(tab) {
    if (!Object.values(TABS).includes(tab)) return;
    _currentTab = tab;

    const wrap = byId('question-tabs');
    if (wrap) {
        wrap.querySelectorAll('[data-question-tab]').forEach((btn) => {
            const active = btn.dataset.questionTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    renderCurrentTab();
}


/* ==========================================================================
   06. 渲染列表
   --------------------------------------------------------------------------
   DOM 结构对齐 CSS：
     .question-item
       .question-item-title
       .question-item-sub
   ========================================================================== */

function renderCurrentTab() {
    const wrap = byId('question-list');
    const empty = byId('question-empty');
    if (!wrap) return;

    const list = getList(_currentTab).slice().sort((a, b) => b.ts - a.ts);

    // 清空（保留空状态）
    Array.from(wrap.children).forEach((child) => {
        if (child !== empty) child.remove();
    });

    if (!list.length) {
        if (empty) {
            empty.hidden = false;
            empty.textContent = _currentTab === TABS.MY
                ? '还没有提问，点右上角 + 新建一个吧'
                : 'TA 还没有向你提问';
        }
        updateNote();
        return;
    }
    if (empty) empty.hidden = true;

    const fragment = document.createDocumentFragment();
    list.forEach((q) => fragment.appendChild(createQuestionEl(q)));
    wrap.appendChild(fragment);

    updateNote();
}

function updateNote() {
    const note = byId('question-note');
    if (!note) return;
    if (_currentTab === TABS.MY) {
        note.textContent = '你发起的提问。一次提问可以包含至少 1 个问题，数量不限。';
    } else {
        note.textContent = 'TA 的提问。点击卡片可以回答。';
    }
}

/**
 * 创建单条提问卡片
 */
function createQuestionEl(q) {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.dataset.questionId = q.id;

    // 标题：第一题内容 + 额外数量
    const title = document.createElement('div');
    title.className = 'question-item-title';
    const first = q.items[0]?.text || '未命名';
    title.textContent = q.items.length > 1
        ? `${first}（共 ${q.items.length} 题）`
        : first;
    item.appendChild(title);

    // 副信息：时间 + 状态
    const sub = document.createElement('div');
    sub.className = 'question-item-sub';
    const timeStr = formatChatTime(q.ts);
    let statusStr = '';
    if (_currentTab === TABS.MY) {
        statusStr = q.status === 'answered' ? '· TA 已回答' : '· 等待 TA 回答';
    } else {
        statusStr = q.status === 'answered' ? '· 已回答' : '· 待回答';
    }
    sub.textContent = `${timeStr} ${statusStr}`;
    item.appendChild(sub);

    // 点击
    item.addEventListener('click', () => {
        if (_currentTab === TABS.MY) {
            viewMyQuestion(q);
        } else {
            answerTaQuestion(q);
        }
    });

    // 长按删除
    attachLongPressDelete(item, q);

    return item;
}


/* ==========================================================================
   07. 查看我发起的提问
   ========================================================================== */

function viewMyQuestion(q) {
    if (q.status !== 'answered') {
        const choice = window.prompt(
            '这条提问还没有回答。\n\n1. 催一催 TA\n2. 删除提问',
            '1'
        );
        if (choice === null) return;
        const n = parseInt(choice, 10);
        if (n === 1) urgeTaAnswer(q);
        else if (n === 2) deleteQuestion(q.id);
        return;
    }

    // 已回答 → 展示明细
    const lines = q.items.map((item, i) => {
        const ans = (q.answers && q.answers[i]) || [];
        const ansText = ans.length
            ? ans.map((idx) => item.text ? `选项 ${idx + 1}` : '').join('、')
            : '未回答';
        return `${i + 1}. ${item.text}\n   → ${ansText}`;
    }).join('\n\n');

    window.alert(`TA 的回答：\n\n${lines}`);
}

/**
 * 模拟 TA 回答
 */
function urgeTaAnswer(q) {
    const delay = randomInt(1500, 3500);
    toast('已提醒 TA，请稍候…');

    setTimeout(() => {
        const data = get(KEYS.QUESTIONS);
        const target = data.my.find((x) => x.id === q.id);
        if (!target) return;

        // 生成随机答案
        target.answers = target.items.map((it) => {
            if (it.type === 'multiple') {
                // 多选：随机 1~3 项
                const maxIdx = randomInt(2, 3);
                const picks = [];
                for (let i = 0; i <= maxIdx; i++) picks.push(i);
                return picks;
            }
            // 单选：随机一个
            return [randomInt(0, 2)];
        });
        target.status = 'answered';
        target.answeredAt = Date.now();
        set(KEYS.QUESTIONS, data);

        renderCurrentTab();
        toast('TA 回答了你！');
        bus.emit('question:answered', { id: q.id });

        // 通知聊天模块推一条消息
        bus.emit('chat:system-message', '我回答完了你的问题，去看看？');
    }, delay);
}


/* ==========================================================================
   08. 回答 TA 的提问
   ========================================================================== */

let _answerPanelEl = null;

function answerTaQuestion(q) {
    if (q.status === 'answered') {
        window.alert('你已经回答过这条提问了。');
        return;
    }

    if (!_answerPanelEl) {
        _answerPanelEl = createAnswerPanel();
        const screen = byId('screen-questions');
        if (screen) screen.appendChild(_answerPanelEl);
    }

    _answerPanelEl.dataset.questionId = q.id;
    _answerPanelEl.hidden = false;

    renderAnswerBody(q);

    // 保存
    const saveBtn = _answerPanelEl.querySelector('[data-answer-save]');
    // 先移除旧的监听（用 clone 替换的方式清空）
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    newSaveBtn.addEventListener('click', () => submitAnswer(q));
}

function createAnswerPanel() {
    const panel = document.createElement('div');
    panel.className = 'question-create-panel';
    panel.id = 'question-answer-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <div class="question-create-header">
            <h3>回答 TA 的提问</h3>
            <button data-answer-close aria-label="关闭">✕</button>
        </div>
        <div class="question-create-body" id="question-answer-body"></div>
        <div class="question-create-actions">
            <button data-answer-close>取消</button>
            <button data-answer-save>提交</button>
        </div>
    `;

    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-answer-close]')) {
            panel.hidden = true;
        }
    });

    return panel;
}

/**
 * 渲染回答表单
 */
function renderAnswerBody(q) {
    const body = _answerPanelEl.querySelector('#question-answer-body');
    if (!body) return;

    body.innerHTML = '';

    q.items.forEach((item, qIdx) => {
        const wrap = document.createElement('div');
        wrap.className = 'question-create-item';

        const label = document.createElement('label');
        label.textContent = `第 ${qIdx + 1} 题 · ${item.text}`;
        wrap.appendChild(label);

        const typeHint = document.createElement('div');
        typeHint.style.cssText = 'font-size:12px;color:var(--c-text-3);margin-bottom:6px;';
        typeHint.textContent = item.type === 'multiple' ? '（多选）' : '（单选）';
        wrap.appendChild(typeHint);

        // 生成选项（暂时用默认通用选项）
        const options = DEFAULT_OPTIONS;
        const inputType = item.type === 'multiple' ? 'checkbox' : 'radio';
        const groupName = `q_${qIdx}`;

        options.forEach((opt, oIdx) => {
            const row = document.createElement('label');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:14px;color:var(--c-text-1);';

            const input = document.createElement('input');
            input.type = inputType;
            input.name = groupName;
            input.value = String(oIdx);
            input.dataset.qidx = String(qIdx);

            const text = document.createElement('span');
            text.textContent = opt;

            row.appendChild(input);
            row.appendChild(text);
            wrap.appendChild(row);
        });

        body.appendChild(wrap);
    });
}

/**
 * 提交回答
 */
function submitAnswer(q) {
    const body = _answerPanelEl.querySelector('#question-answer-body');
    if (!body) return;

    // 收集答案
    const answers = q.items.map((_, qIdx) => {
        const inputs = body.querySelectorAll(`input[data-qidx="${qIdx}"]:checked`);
        return Array.from(inputs).map((i) => parseInt(i.value, 10));
    });

    // 校验：每题至少选 1 项
    const emptyIdx = answers.findIndex((a) => a.length === 0);
    if (emptyIdx !== -1) {
        toast(`第 ${emptyIdx + 1} 题还没选答案`);
        return;
    }

    // 保存
    const data = get(KEYS.QUESTIONS);
    const target = data.ta.find((x) => x.id === q.id);
    if (!target) return;

    target.answers = answers;
    target.status = 'answered';
    target.answeredAt = Date.now();
    set(KEYS.QUESTIONS, data);

    _answerPanelEl.hidden = true;
    renderCurrentTab();
    toast('已提交，TA 会看到的 ♥');
    bus.emit('question:answered', { id: q.id });
}


/* ==========================================================================
   09. 新建提问
   ========================================================================== */

function bindAddButton() {
    const btn = byId('btn-questions-add');
    if (!btn) return;
    btn.addEventListener('click', openCreatePanel);
}

function bindCreatePanel() {
    const panel = byId('question-create-panel');
    if (!panel) return;

    // 关闭
    const closeBtn = byId('btn-question-create-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCreatePanel);

    // 添加问题
    const addBtn = byId('btn-question-add-item');
    if (addBtn) addBtn.addEventListener('click', addCreateItem);

    // 保存
    const saveBtn = byId('btn-question-save');
    if (saveBtn) saveBtn.addEventListener('click', submitCreate);
}

/**
 * 打开新建面板
 */
export function openCreatePanel() {
    const panel = byId('question-create-panel');
    if (!panel) return;

    resetCreatePanel();
    panel.hidden = false;

    // 聚焦第一个输入框
    setTimeout(() => {
        byId('question-input-1')?.focus();
    }, 200);
}

/**
 * 关闭新建面板
 */
function closeCreatePanel() {
    const panel = byId('question-create-panel');
    if (panel) panel.hidden = true;
}

/**
 * 重置面板到初始状态（只有一道题）
 */
function resetCreatePanel() {
    const body = byId('question-create-body');
    if (!body) return;

    // 保留第一题，删除其它
    const items = body.querySelectorAll('.question-create-item');
    items.forEach((item, i) => {
        if (i > 0) item.remove();
    });

    const first = byId('question-create-item-1');
    if (first) {
        const input = first.querySelector('#question-input-1');
        const select = first.querySelector('#question-type-1');
        if (input) input.value = '';
        if (select) select.value = 'single';
    }

    _createItemCount = 1;
}

/**
 * 添加一道题
 */
function addCreateItem() {
    if (_createItemCount >= MAX_QUESTIONS) {
        toast(`最多 ${MAX_QUESTIONS} 道题`);
        return;
    }

    _createItemCount++;
    const idx = _createItemCount;

    const body = byId('question-create-body');
    if (!body) return;

    const item = document.createElement('div');
    item.className = 'question-create-item';
    item.id = `question-create-item-${idx}`;
    item.innerHTML = `
        <label for="question-input-${idx}">问题 ${idx}</label>
        <input type="text" id="question-input-${idx}" name="question-${idx}"
               placeholder="输入问题..." aria-label="问题 ${idx}">
        <select id="question-type-${idx}" name="question-type-${idx}" aria-label="问题类型">
            <option value="single">单选题</option>
            <option value="multiple">多选题</option>
        </select>
    `;
    body.appendChild(item);

    // 聚焦
    setTimeout(() => {
        document.getElementById(`question-input-${idx}`)?.focus();
    }, 50);
}

/**
 * 保存新建的提问
 */
function submitCreate() {
    const body = byId('question-create-body');
    if (!body) return;

    // 收集题目
    const items = [];
    for (let i = 1; i <= _createItemCount; i++) {
        const input = document.getElementById(`question-input-${i}`);
        const select = document.getElementById(`question-type-${i}`);
        if (!input) continue;
        const text = (input.value || '').trim();
        if (!text) continue;
        items.push({
            text,
            type: select?.value || 'single'
        });
    }

    if (!items.length) {
        toast('至少填写一道题');
        return;
    }

    // 保存
    const data = get(KEYS.QUESTIONS);
    data.my.push({
        id: uid('q'),
        items,
        ts: Date.now(),
        status: 'pending',
        answers: null,
        answeredAt: null
    });
    set(KEYS.QUESTIONS, data);

    closeCreatePanel();
    switchTab(TABS.MY);
    renderCurrentTab();
    toast(`已发起 ${items.length} 道提问，等 TA 回答`);
}


/* ==========================================================================
   10. 删除
   ========================================================================== */

function attachLongPressDelete(el, q) {
    let timer = null;

    const start = () => {
        timer = setTimeout(() => {
            if (window.confirm('删除这条提问？')) {
                deleteQuestion(q.id);
            }
        }, 700);
    };
    const cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('touchcancel', cancel);

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancel();
        if (window.confirm('删除这条提问？')) {
            deleteQuestion(q.id);
        }
    });
}

function deleteQuestion(id) {
    const list = getList(_currentTab).filter((x) => x.id !== id);
    saveList(_currentTab, list);
    renderCurrentTab();
    toast('已删除');
}


/* ==========================================================================
   11. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const questionsActions = {
    'add-question':           () => openCreatePanel(),
    'close-question-create':  () => closeCreatePanel(),
    'add-question-item':      () => addCreateItem(),
    'save-question':          () => submitCreate()
};

export const questionsNavs = {
    'questions': () => {
        ensureQuestionsData();
        renderCurrentTab();
        showScreen('screen-questions');
    }
};


/* ==========================================================================
   12. 对外导出
   ========================================================================== */

export default {
    initQuestions,
    destroyQuestions,
    switchTab,
    openCreatePanel,
    questionsActions,
    questionsNavs
};