/* ==========================================================================
   梦角 · Dream Corner
   提问模块  js/modules/questions.js
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

import { mjPrompt, mjConfirm, mjAlert } from '../utils/dialogs.js';


const TABS = {
    MY: 'my',
    TA: 'ta'
};

const MAX_QUESTIONS = 10;

const DEFAULT_OPTIONS = ['是', '否', '不确定'];

const TA_COMMENTS = [
    '好可爱呀', '这张照片我好喜欢', '哈哈哈笑死', '嗯嗯，说得对',
    '想和你一起去', '看到这个就想到你', '今天的你也在发光', '抱抱',
    '记下来啦', '什么时候带我去'
];

let _initialized = false;
let _unsubs = [];
let _currentTab = TABS.MY;
let _createItemCount = 1;


/* ==========================================================================
   入口
   ========================================================================== */

export function initQuestions() {
    if (_initialized) return;
    _initialized = true;

    ensureQuestionsData();
    bindTabs();
    bindCreatePanelInputs();

    renderCurrentTab();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-questions') renderCurrentTab();
        })
    );
}

export function destroyQuestions() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   数据
   ========================================================================== */

function ensureQuestionsData() {
    const data = get(KEYS.QUESTIONS);
    if (!Array.isArray(data.my)) data.my = [];
    if (!Array.isArray(data.ta)) data.ta = [];

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
   Tab 切换
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
   渲染列表
   ========================================================================== */

function renderCurrentTab() {
    const wrap = byId('question-list');
    const empty = byId('question-empty');
    if (!wrap) return;

    const list = getList(_currentTab).slice().sort((a, b) => b.ts - a.ts);

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
    note.textContent = _currentTab === TABS.MY
        ? '你发起的提问。一次提问可以包含至少 1 个问题，数量不限。'
        : 'TA 的提问。点击卡片可以回答。';
}

function createQuestionEl(q) {
    const item = document.createElement('div');
    item.className = 'question-item';
    item.dataset.questionId = q.id;

    const title = document.createElement('div');
    title.className = 'question-item-title';
    const first = q.items[0]?.text || '未命名';
    title.textContent = q.items.length > 1
        ? `${first}（共 ${q.items.length} 题）`
        : first;
    item.appendChild(title);

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

    item.addEventListener('click', () => {
        if (_currentTab === TABS.MY) viewMyQuestion(q);
        else answerTaQuestion(q);
    });

    attachLongPressDelete(item, q);

    return item;
}


/* ==========================================================================
   查看我发起的
   ========================================================================== */

async function viewMyQuestion(q) {
    if (q.status !== 'answered') {
        const choice = await mjPrompt('这条提问还没有回答', {
            placeholder: '1. 催一催 TA\n2. 删除提问',
            defaultValue: '1',
            confirmText: '执行'
        });
        if (choice === null) return;
        const n = parseInt(String(choice).trim(), 10);
        if (n === 1) urgeTaAnswer(q);
        else if (n === 2) {
            const ok = await mjConfirm('删除这条提问？', { title: '删除提问' });
            if (ok) deleteQuestion(q.id);
        }
        return;
    }

    const lines = q.items.map((item, i) => {
        const ans = (q.answers && q.answers[i]) || [];
        const ansText = ans.length
            ? ans.map((idx) => DEFAULT_OPTIONS[idx] || `选项 ${idx + 1}`).join('、')
            : '未回答';
        return `${i + 1}. ${item.text}\n   → ${ansText}`;
    }).join('\n\n');

    await mjAlert(lines, { title: 'TA 的回答' });
}

function urgeTaAnswer(q) {
    const delay = randomInt(1500, 3500);
    toast('已提醒 TA，请稍候…');

    setTimeout(() => {
        const data = get(KEYS.QUESTIONS);
        const target = data.my.find((x) => x.id === q.id);
        if (!target) return;

        target.answers = target.items.map((it) => {
            if (it.type === 'multiple') {
                const maxIdx = randomInt(1, 2);
                const picks = [];
                for (let i = 0; i <= maxIdx; i++) picks.push(i);
                return picks;
            }
            return [randomInt(0, 2)];
        });
        target.status = 'answered';
        target.answeredAt = Date.now();
        set(KEYS.QUESTIONS, data);

        renderCurrentTab();
        toast('TA 回答了你！');
        bus.emit('question:answered', { id: q.id });
    }, delay);
}


/* ==========================================================================
   回答 TA 的提问
   ========================================================================== */

let _answerPanelEl = null;

function answerTaQuestion(q) {
    if (q.status === 'answered') {
        mjAlert('你已经回答过这条提问了。', { title: '提示' });
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
            return;
        }
        if (e.target.closest('[data-answer-save]')) {
            const qid = panel.dataset.questionId;
            const data = get(KEYS.QUESTIONS);
            const q = data.ta.find((x) => x.id === qid);
            if (q) submitAnswer(q, panel);
        }
    });

    return panel;
}

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

        const inputType = item.type === 'multiple' ? 'checkbox' : 'radio';
        const groupName = `q_${qIdx}`;

        DEFAULT_OPTIONS.forEach((opt, oIdx) => {
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

function submitAnswer(q, panel) {
    const body = panel.querySelector('#question-answer-body');
    if (!body) return;

    const answers = q.items.map((_, qIdx) => {
        const inputs = body.querySelectorAll(`input[data-qidx="${qIdx}"]:checked`);
        return Array.from(inputs).map((i) => parseInt(i.value, 10));
    });

    const emptyIdx = answers.findIndex((a) => a.length === 0);
    if (emptyIdx !== -1) {
        toast(`第 ${emptyIdx + 1} 题还没选答案`);
        return;
    }

    const data = get(KEYS.QUESTIONS);
    const target = data.ta.find((x) => x.id === q.id);
    if (!target) return;

    target.answers = answers;
    target.status = 'answered';
    target.answeredAt = Date.now();
    set(KEYS.QUESTIONS, data);

    panel.hidden = true;
    renderCurrentTab();
    toast('已提交，TA 会看到的 ♥');
    bus.emit('question:answered', { id: q.id });
}


/* ==========================================================================
   新建提问面板
   ========================================================================== */

function bindCreatePanelInputs() {
    // 输入框回车也保留（可选）
    // 其余按钮全部通过 data-action 分发
}

export function openCreatePanel() {
    const panel = byId('question-create-panel');
    if (!panel) return;

    resetCreatePanel();
    panel.hidden = false;

    setTimeout(() => {
        byId('question-input-1')?.focus();
    }, 200);
}

export function closeCreatePanel() {
    const panel = byId('question-create-panel');
    if (panel) panel.hidden = true;
}

function resetCreatePanel() {
    const body = byId('question-create-body');
    if (!body) return;

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

export function addCreateItem() {
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

    setTimeout(() => {
        document.getElementById(`question-input-${idx}`)?.focus();
    }, 50);
}

export function saveQuestion() {
    const body = byId('question-create-body');
    if (!body) return;

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
   长按删除
   ========================================================================== */

function attachLongPressDelete(el, q) {
    let timer = null;

    const start = () => {
        timer = setTimeout(async () => {
            const ok = await mjConfirm('删除这条提问？', { title: '删除提问' });
            if (ok) deleteQuestion(q.id);
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

    el.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        cancel();
        const ok = await mjConfirm('删除这条提问？', { title: '删除提问' });
        if (ok) deleteQuestion(q.id);
    });
}

function deleteQuestion(id) {
    const list = getList(_currentTab).filter((x) => x.id !== id);
    saveList(_currentTab, list);
    renderCurrentTab();
    toast('已删除');
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const questionsActions = {
    'add-question':          () => openCreatePanel(),
    'close-question-create': () => closeCreatePanel(),
    'add-question-item':     () => addCreateItem(),
    'save-question':         () => saveQuestion()
};

export const questionsNavs = {
    'questions': () => {
        ensureQuestionsData();
        renderCurrentTab();
        showScreen('screen-questions');
    }
};

export default {
    initQuestions,
    destroyQuestions,
    switchTab,
    openCreatePanel,
    questionsActions,
    questionsNavs
};
