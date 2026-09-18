/* ==========================================================================
   梦角 · Dream Corner
   经期记录模块  js/modules/period.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-period
       - 头部：#btn-period-notifications / #btn-period-settings
       - 记录卡片：#period-info-title / #period-info-sub
                   #btn-mark-period-start / #btn-record-today
       - 日历卡片：#calendar-nav / #btn-calendar-prev / #calendar-title
                   #btn-calendar-next / #period-calendar
       - 历史记录：#period-history-list
       - 统计：#period-stat-text / #period-stat-sub / #btn-monthly-report
       - 症状建议：#period-relief-text
       - 健康贴士：#period-tips-text / #period-tip-text

   数据结构（KEYS.PERIOD）：
     {
       records: [
         { id, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'|null, symptoms: [], note }
       ],
       settings: {
         cycleLength: 28,       // 平均周期天数
         periodLength: 5,       // 平均经期天数
         reminder: false,
         ovulationOffset: 14    // 排卵日距下次月经天数
       },
       symptoms: {
         'YYYY-MM-DD': ['头痛', '乏力']
       }
     }
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setText, setVisible,
    formatDate, formatYearMonth, formatChatTime,
    uid, randomInt, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set, update
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 单次经期最短 / 最长天数（用于校验） */
const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 15;

/** 可选症状列表 */
const SYMPTOM_LIST = [
    '腹痛', '腰酸', '头痛', '乏力', '情绪低落',
    '乳房胀痛', '食欲不振', '长痘', '便秘', '失眠'
];

/** 症状 → 缓解建议 */
const RELIEF_TIPS = {
    '腹痛':     '喝杯温热的红糖姜茶，用暖水袋热敷小腹，能缓解绞痛。',
    '腰酸':     '避免久坐久站，躺下时在腰下垫个薄枕，让腰背放松。',
    '头痛':     '保证睡眠，减少屏幕时间，必要时在医生指导下用药。',
    '乏力':     '多休息，补铁（红肉、动物肝脏、菠菜），别硬撑。',
    '情绪低落': '经期激素波动很正常，允许自己慢一点，听点喜欢的歌。',
    '乳房胀痛': '换宽松内衣，减少咖啡因，冷敷或热敷都可以试试。',
    '食欲不振': '少量多餐，吃温软好消化的食物，避免生冷。',
    '长痘':     '温和清洁，别乱挤，多喝水，少吃高糖食物。',
    '便秘':     '多喝水、多吃纤维，顺时针轻揉小腹。',
    '失眠':     '睡前泡泡脚，少刷手机，把灯光调暗。'
};

/** 健康小贴士随机池 */
const HEALTH_TIPS = [
    '经期注意保暖，别喝冰饮，小腹暖起来疼痛会轻很多。',
    '记录症状能帮你看清自己的规律，也能让医生更了解你。',
    '周期偶尔波动几天是正常的，不用焦虑。',
    '经期前几天适当减少盐分，可以缓解水肿。',
    '适度运动（散步、瑜伽）能改善经期不适。',
    '睡眠不足会加重经期反应，早点休息吧。',
    '维生素 B6、镁对缓解经前综合征有帮助。',
    '如果疼痛严重影响生活，一定要去看医生。'
];


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

/** 当前显示的日历年月 */
let _viewYear;
let _viewMonth;   // 0-11

/** 长按录入症状时暂存的目标日期 */
let _longPressDate = null;


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initPeriod() {
    if (_initialized) return;
    _initialized = true;

    ensurePeriodData();

    const now = new Date();
    _viewYear = now.getFullYear();
    _viewMonth = now.getMonth();

    bindRecordButtons();
    bindCalendarNav();
    bindCalendarDelegate();
    bindStatsButton();
    bindHeaderButtons();

    renderAll();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-period') {
                renderAll();
            }
        })
    );

    // 响应首页请求
    bus.on('home:request-period-status', () => {
        syncHomeCard();
    });
}

export function destroyPeriod() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensurePeriodData() {
    const data = get(KEYS.PERIOD);
    if (!Array.isArray(data.records)) data.records = [];
    if (!data.settings || typeof data.settings !== 'object') {
        data.settings = {
            cycleLength: 28,
            periodLength: 5,
            reminder: false,
            ovulationOffset: 14
        };
    }
    if (!data.symptoms || typeof data.symptoms !== 'object') {
        data.symptoms = {};
    }
    set(KEYS.PERIOD, data);
    return data;
}

function getRecords() {
    return ensurePeriodData().records;
}

function saveRecords(list) {
    const data = get(KEYS.PERIOD);
    data.records = list;
    set(KEYS.PERIOD, data);
}

function getSettings() {
    return ensurePeriodData().settings;
}

function saveSettings(patch) {
    const data = get(KEYS.PERIOD);
    data.settings = { ...data.settings, ...patch };
    set(KEYS.PERIOD, data);
}

function getSymptomsMap() {
    return ensurePeriodData().symptoms;
}

function saveSymptomsMap(map) {
    const data = get(KEYS.PERIOD);
    data.symptoms = map;
    set(KEYS.PERIOD, data);
}


/* ==========================================================================
   05. 日期工具
   ========================================================================== */

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * 用 "YYYY-MM-DD" 字符串构造 Date（避免时区问题）
 */
function parseYmd(ymd) {
    if (!ymd) return null;
    const parts = String(ymd).split('-').map(Number);
    if (parts.length !== 3) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Date → "YYYY-MM-DD"
 */
function toYmd(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * 两个日期相差天数
 */
function daysBetween(a, b) {
    const d1 = parseYmd(a);
    const d2 = parseYmd(b);
    if (!d1 || !d2) return 0;
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    return Math.round((d2 - d1) / 86400000);
}

/**
 * 日期加减 n 天，返回 "YYYY-MM-DD"
 */
function addDays(ymd, n) {
    const d = parseYmd(ymd);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return toYmd(d);
}

/**
 * ymd 是否在 [start, end] 区间内（含端点）
 */
function isInRange(ymd, start, end) {
    if (!ymd || !start) return false;
    const s = parseYmd(start);
    const e = end ? parseYmd(end) : s;
    const t = parseYmd(ymd);
    if (!s || !e || !t) return false;
    return t >= s && t <= e;
}


/* ==========================================================================
   06. 计算：当前状态 / 预测 / 排卵
   ========================================================================== */

/**
 * 找出最近一次已开始的经期记录
 */
function getLatestRecord() {
    const list = getRecords().filter((r) => r.start);
    if (!list.length) return null;
    return list.slice().sort((a, b) => (a.start < b.start ? 1 : -1))[0];
}

/**
 * 当前是否处于经期中
 * 规则：最新记录没有 end 且今天距离 start 在 periodLength 内
 */
function isCurrentlyOnPeriod() {
    const latest = getLatestRecord();
    if (!latest) return false;
    if (latest.end) return false;

    const days = daysBetween(latest.start, toYmd(new Date()));
    return days >= 0 && days <= (getSettings().periodLength || 5) + 3;
}

/**
 * 预测下次经期开始日
 * 用最新的 start + cycleLength
 */
function predictNextStart() {
    const latest = getLatestRecord();
    if (!latest) return null;
    const cycle = getSettings().cycleLength || 28;
    return addDays(latest.start, cycle);
}

/**
 * 计算预测区间（下次经期的起止日）
 */
function predictRange() {
    const nextStart = predictNextStart();
    if (!nextStart) return null;
    const len = getSettings().periodLength || 5;
    return {
        start: nextStart,
        end: addDays(nextStart, len - 1)
    };
}

/**
 * 计算排卵日 / 排卵期
 * 排卵日 = 下次经期开始日 - ovulationOffset（默认 14）
 * 排卵期 = 排卵日 ± 4 天（共 9 天窗口）
 */
function getOvulationRange() {
    const nextStart = predictNextStart();
    if (!nextStart) return null;
    const offset = getSettings().ovulationOffset || 14;
    const ovulationDay = addDays(nextStart, -offset);
    if (!ovulationDay) return null;
    return {
        day: ovulationDay,
        start: addDays(ovulationDay, -4),
        end: addDays(ovulationDay, 4)
    };
}

/**
 * 判断某个日期在展示时的"标记类型"
 * @returns {'period'|'predicted'|'ovulation'|'symptom'|'today'|''}
 */
function getDayFlag(ymd) {
    const today = toYmd(new Date());

    // 今天
    if (ymd === today) return 'today';

    // 已记录的经期
    for (const r of getRecords()) {
        if (isInRange(ymd, r.start, r.end)) return 'period';
    }

    // 预测区间
    const pr = predictRange();
    if (pr && isInRange(ymd, pr.start, pr.end)) return 'predicted';

    // 排卵期
    const ov = getOvulationRange();
    if (ov && isInRange(ymd, ov.start, ov.end)) return 'ovulation';

    // 有症状记录
    const sm = getSymptomsMap();
    if (sm[ymd] && sm[ymd].length) return 'symptom';

    return '';
}


/* ==========================================================================
   07. 渲染：全部
   ========================================================================== */

function renderAll() {
    renderStatusCard();
    renderCalendar();
    renderHistory();
    renderStats();
    renderRelief();
    renderTips();
    syncHomeCard();
}

/**
 * 顶部记录卡片（今天的整体状态）
 */
function renderStatusCard() {
    const titleEl = byId('period-info-title');
    const subEl = byId('period-info-sub');

    const latest = getLatestRecord();
    const today = toYmd(new Date());
    const settings = getSettings();

    if (!latest) {
        if (titleEl) titleEl.textContent = '暂无记录';
        if (subEl) subEl.textContent = '点下方按钮标记本次经期开始';
        return;
    }

    // 进行中
    if (isCurrentlyOnPeriod()) {
        const day = daysBetween(latest.start, today) + 1;
        const total = settings.periodLength || 5;
        if (titleEl) titleEl.textContent = `经期第 ${day} 天`;
        if (subEl) {
            subEl.textContent = `预计经期共 ${total} 天，注意休息 ♥`;
        }
        return;
    }

    // 已结束 → 显示距离下次
    const nextStart = predictNextStart();
    if (nextStart) {
        const d = daysBetween(today, nextStart);
        if (titleEl) titleEl.textContent = d > 0 ? `距离下次还有 ${d} 天` : '经期可能已延迟';
        if (subEl) {
            subEl.textContent = d > 0
                ? `预测下次开始：${nextStart}`
                : '如果已开始，记得点击记录';
        }
        return;
    }

    if (titleEl) titleEl.textContent = '已记录';
    if (subEl) subEl.textContent = '继续记录，让预测更准确';
}


/* ==========================================================================
   08. 渲染：日历
   --------------------------------------------------------------------------
   月份标题、上个月、下个月、每格的状态
   ========================================================================== */

function renderCalendar() {
    const titleEl = byId('calendar-title');
    if (titleEl) {
        titleEl.textContent = `${_viewYear} 年 ${_viewMonth + 1} 月`;
    }

    const grid = byId('period-calendar');
    if (!grid) return;

    // 保留 7 个表头（日一二三四五六）
    // 用最简单的方式：清空后重建
    grid.innerHTML = '';

    ['日', '一', '二', '三', '四', '五', '六'].forEach((label) => {
        const cell = document.createElement('div');
        cell.className = 'calendar-header';
        cell.setAttribute('aria-hidden', 'true');
        cell.textContent = label;
        grid.appendChild(cell);
    });

    // 当月第一天是星期几
    const first = new Date(_viewYear, _viewMonth, 1);
    const firstWeekday = first.getDay();

    // 上月尾部空白
    for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day calendar-day-empty';
        grid.appendChild(blank);
    }

    // 当月天数
    const daysInMonth = new Date(_viewYear, _viewMonth + 1, 0).getDate();

    const today = toYmd(new Date());

    for (let d = 1; d <= daysInMonth; d++) {
        const ymd = `${_viewYear}-${pad2(_viewMonth + 1)}-${pad2(d)}`;
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.dataset.date = ymd;
        cell.textContent = String(d);

        if (ymd === today) {
            cell.classList.add('today');
        }

        const flag = getDayFlag(ymd);
        if (flag && flag !== 'today') {
            cell.classList.add(flag);
        } else if (flag === 'today') {
            // today 已加
        }

        // 检查是否有症状
        const sm = getSymptomsMap();
        if (sm[ymd] && sm[ymd].length) {
            cell.classList.add('symptom');
        }

        grid.appendChild(cell);
    }

    // 月末补齐到 7 的倍数（可选）
    const total = firstWeekday + daysInMonth;
    const remain = (7 - (total % 7)) % 7;
    for (let i = 0; i < remain; i++) {
        const blank = document.createElement('div');
        blank.className = 'calendar-day calendar-day-empty';
        grid.appendChild(blank);
    }
}


/* ==========================================================================
   09. 交互：日历
   --------------------------------------------------------------------------
   - 单击某天：若该天已有记录，取消记录；否则把该天加入当前记录区间
   - 长按某天：打开症状录入
   ========================================================================== */

function bindCalendarNav() {
    const prev = byId('btn-calendar-prev');
    const next = byId('btn-calendar-next');

    if (prev) {
        prev.addEventListener('click', () => {
            _viewMonth--;
            if (_viewMonth < 0) { _viewMonth = 11; _viewYear--; }
            renderCalendar();
        });
    }

    if (next) {
        next.addEventListener('click', () => {
            _viewMonth++;
            if (_viewMonth > 11) { _viewMonth = 0; _viewYear++; }
            renderCalendar();
        });
    }
}

function bindCalendarDelegate() {
    const grid = byId('period-calendar');
    if (!grid) return;

    /* ---------- 单击 ---------- */
    grid.addEventListener('click', (e) => {
        const cell = e.target.closest('.calendar-day');
        if (!cell || cell.classList.contains('calendar-day-empty')) return;
        const ymd = cell.dataset.date;
        if (!ymd) return;

        // 若刚才触发了长按，则忽略本次点击
        if (_longPressDate === ymd) {
            _longPressDate = null;
            return;
        }

        toggleDayRecord(ymd);
    });

    /* ---------- 长按 ---------- */
    let pressTimer = null;
    let pressYmd = null;

    grid.addEventListener('touchstart', (e) => {
        const cell = e.target.closest('.calendar-day');
        if (!cell || cell.classList.contains('calendar-day-empty')) return;
        pressYmd = cell.dataset.date;
        pressTimer = setTimeout(() => {
            _longPressDate = pressYmd;
            openSymptomPanel(pressYmd);
        }, 650);
    }, { passive: true });

    const cancelPress = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
        pressYmd = null;
    };
    grid.addEventListener('touchend', cancelPress);
    grid.addEventListener('touchmove', cancelPress);
    grid.addEventListener('touchcancel', cancelPress);

    // 桌面端右键
    grid.addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('.calendar-day');
        if (!cell || cell.classList.contains('calendar-day-empty')) return;
        e.preventDefault();
        openSymptomPanel(cell.dataset.date);
    });
}

/**
 * 单击某天：切换为经期 / 取消经期
 */
function toggleDayRecord(ymd) {
    const list = getRecords();

    // 若某条记录包含该天，则从该记录中"删除这一天"
    // 简化处理：如果该天正好是某条记录的 start 或 end，删除整条；否则跳过
    let handled = false;
    for (const r of list) {
        if (isInRange(ymd, r.start, r.end)) {
            if (r.start === ymd && (!r.end || r.start === r.end)) {
                // 单日记录 → 整条删除
                const idx = list.indexOf(r);
                list.splice(idx, 1);
            } else if (r.start === ymd) {
                // 从头去掉一天
                r.start = addDays(r.start, 1);
                if (daysBetween(r.start, r.end) < 0) r.end = r.start;
            } else if (r.end === ymd) {
                // 从尾去掉一天
                r.end = addDays(r.end, -1);
                if (daysBetween(r.start, r.end) < 0) r.end = r.start;
            } else {
                toast('这一天在经期区间内，请在开始或结束处取消');
                return;
            }
            handled = true;
            break;
        }
    }

    if (!handled) {
        // 新增一天：合并到最近的记录，或新建一条
        const latest = getLatestRecord();
        if (latest && !latest.end && daysBetween(latest.start, ymd) >= 0 && daysBetween(latest.start, ymd) <= 15) {
            // 并入当前未结束的记录
            latest.end = ymd;
        } else {
            list.push({
                id: uid('period'),
                start: ymd,
                end: ymd,
                symptoms: [],
                note: ''
            });
        }
    }

    // 按开始日排序
    list.sort((a, b) => (a.start < b.start ? -1 : 1));
    saveRecords(list);

    renderAll();
    toast('已更新记录');
}


/* ==========================================================================
   10. 症状录入面板
   ========================================================================== */

let _symptomPanelEl = null;

function openSymptomPanel(ymd) {
    if (!ymd) return;

    if (!_symptomPanelEl) {
        _symptomPanelEl = createSymptomPanel();
        const screen = byId('screen-period');
        if (screen) screen.appendChild(_symptomPanelEl);
    }

    _symptomPanelEl.dataset.date = ymd;
    _symptomPanelEl.hidden = false;

    // 渲染当前选中状态
    const sm = getSymptomsMap();
    const selected = sm[ymd] || [];

    const title = _symptomPanelEl.querySelector('#mj-symptom-title');
    if (title) title.textContent = `记录症状 · ${ymd}`;

    _symptomPanelEl.querySelectorAll('[data-symptom]').forEach((btn) => {
        const key = btn.dataset.symptom;
        btn.classList.toggle('active', selected.includes(key));
    });

    const noteEl = _symptomPanelEl.querySelector('#mj-symptom-note');
    if (noteEl) {
        const rec = getRecords().find((r) => isInRange(ymd, r.start, r.end));
        noteEl.value = rec?.note || '';
    }
}

function createSymptomPanel() {
    const panel = document.createElement('div');
    panel.className = 'question-create-panel';
    panel.id = 'period-symptom-panel';
    panel.hidden = true;

    const chips = SYMPTOM_LIST
        .map((s) => `<button type="button" class="mj-symptom-chip" data-symptom="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
        .join('');

    panel.innerHTML = `
        <div class="question-create-header">
            <h3 id="mj-symptom-title">记录症状</h3>
            <button data-symptom-close aria-label="关闭">✕</button>
        </div>
        <div class="question-create-body">
            <div class="question-create-item">
                <label>选择症状（可多选）</label>
                <div class="mj-symptom-chips">${chips}</div>
            </div>
            <div class="question-create-item">
                <label for="mj-symptom-note">备注（可选）</label>
                <textarea id="mj-symptom-note" rows="3"
                    style="width:100%;padding:10px 14px;border:1px solid var(--c-line-2);border-radius:12px;font-size:14px;background:var(--c-surface-2);resize:none;"
                    placeholder="还有什么想记下来的..."></textarea>
            </div>
        </div>
        <div class="question-create-actions">
            <button data-symptom-clear>清空</button>
            <button data-symptom-save>保存</button>
        </div>
    `;

    // 事件
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-symptom-close]')) {
            panel.hidden = true;
            return;
        }
        if (e.target.closest('[data-symptom-clear]')) {
            clearSymptoms(panel.dataset.date);
            panel.hidden = true;
            return;
        }
        if (e.target.closest('[data-symptom-save]')) {
            saveSymptoms(panel.dataset.date, panel);
            panel.hidden = true;
            return;
        }

        const chip = e.target.closest('[data-symptom]');
        if (chip) {
            chip.classList.toggle('active');
        }
    });

    return panel;
}

function clearSymptoms(ymd) {
    if (!ymd) return;
    const sm = getSymptomsMap();
    delete sm[ymd];
    saveSymptomsMap(sm);

    const list = getRecords();
    list.forEach((r) => {
        if (isInRange(ymd, r.start, r.end)) {
            r.symptoms = (r.symptoms || []).filter((x) => x !== ymd);
        }
    });
    saveRecords(list);

    renderAll();
    toast('已清空');
}

function saveSymptoms(ymd, panel) {
    if (!ymd) return;

    const selected = [];
    panel.querySelectorAll('[data-symptom].active').forEach((btn) => {
        selected.push(btn.dataset.symptom);
    });

    const note = (panel.querySelector('#mj-symptom-note')?.value || '').trim();

    const sm = getSymptomsMap();
    if (selected.length) sm[ymd] = selected;
    else delete sm[ymd];
    saveSymptomsMap(sm);

    // 备注写到所属记录上
    const list = getRecords();
    list.forEach((r) => {
        if (isInRange(ymd, r.start, r.end) && note) {
            r.note = note;
        }
    });
    saveRecords(list);

    renderAll();
    toast('已保存症状记录');
}


/* ==========================================================================
   11. 记录按钮
   ========================================================================== */

function bindRecordButtons() {
    const startBtn = byId('btn-mark-period-start');
    if (startBtn) {
        startBtn.addEventListener('click', markTodayAsStart);
    }

    const recordBtn = byId('btn-record-today');
    if (recordBtn) {
        recordBtn.addEventListener('click', recordToday);
    }
}

/**
 * 标记今天为经期开始
 */
function markTodayAsStart() {
    const today = toYmd(new Date());
    const list = getRecords();

    // 若已存在
    const existing = list.find((r) => r.start === today);
    if (existing) {
        toast('今天已经是经期开始日了');
        return;
    }

    // 若存在未结束的记录，先收尾
    const latest = getLatestRecord();
    if (latest && !latest.end) {
        const len = getSettings().periodLength || 5;
        latest.end = addDays(latest.start, len - 1);
    }

    list.push({
        id: uid('period'),
        start: today,
        end: null,
        symptoms: [],
        note: ''
    });
    list.sort((a, b) => (a.start < b.start ? -1 : 1));
    saveRecords(list);

    renderAll();
    toast('已标记今天为经期开始');
    bus.emit('period:update', { text: '经期第 1 天' });
}

/**
 * 记录今天（若已开始则延长；否则视为新开始）
 */
function recordToday() {
    const today = toYmd(new Date());
    const latest = getLatestRecord();

    if (latest && !latest.end) {
        const len = daysBetween(latest.start, today);
        if (len < 0) {
            toast('今天早于开始日，无法记录');
            return;
        }
        if (len > MAX_PERIOD_DAYS) {
            toast(`单次经期最多 ${MAX_PERIOD_DAYS} 天`);
            return;
        }
        latest.end = today;
        saveRecords(getRecords());
        renderAll();
        toast(`已记录到今天，共 ${len + 1} 天`);
        return;
    }

    // 没有进行中的记录 → 视为新开始
    markTodayAsStart();
}


/* ==========================================================================
   12. 历史记录
   ========================================================================== */

function renderHistory() {
    const listEl = byId('period-history-list');
    const emptyEl = byId('period-history-empty');
    if (!listEl) return;

    const list = getRecords().slice().sort((a, b) => (a.start < b.start ? 1 : -1));

    // 清空
    listEl.innerHTML = '';

    if (!list.length) {
        if (emptyEl) {
            emptyEl.hidden = false;
            listEl.appendChild(emptyEl);
        }
        return;
    }
    if (emptyEl) emptyEl.hidden = true;

    list.forEach((r) => {
        const row = document.createElement('div');
        row.className = 'period-history-item';

        const dateEl = document.createElement('span');
        dateEl.className = 'period-history-date';
        dateEl.textContent = r.end && r.end !== r.start
            ? `${r.start} ~ ${r.end}`
            : r.start;

        const lenEl = document.createElement('span');
        lenEl.className = 'period-history-length';
        const days = r.end ? daysBetween(r.start, r.end) + 1 : 1;
        lenEl.textContent = `${days} 天`;

        row.appendChild(dateEl);
        row.appendChild(lenEl);

        // 点击 → 跳到该月
        row.addEventListener('click', () => {
            const d = parseYmd(r.start);
            if (d) {
                _viewYear = d.getFullYear();
                _viewMonth = d.getMonth();
                renderCalendar();
                toast(`已定位到 ${r.start}`);
            }
        });

        listEl.appendChild(row);
    });
}


/* ==========================================================================
   13. 统计
   ========================================================================== */

function renderStats() {
    const textEl = byId('period-stat-text');
    const subEl = byId('period-stat-sub');
    if (!textEl) return;

    const list = getRecords().filter((r) => r.start && r.end);
    if (list.length < 2) {
        textEl.textContent = '继续记录几次经期后，这里会有周期洞察。';
        if (subEl) {
            const sm = getSymptomsMap();
            const dates = Object.keys(sm).filter((k) => sm[k].length);
            if (dates.length) {
                subEl.textContent = `已记录 ${dates.length} 天症状`;
            } else {
                subEl.textContent = '暂无症状记录（长按日格可录入）';
            }
        }
        return;
    }

    // 计算平均周期（相邻两次 start 的差）
    const sorted = list.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    const cycles = [];
    const lengths = [];

    for (let i = 1; i < sorted.length; i++) {
        const c = daysBetween(sorted[i - 1].start, sorted[i].start);
        if (c > 10 && c < 60) cycles.push(c);
    }
    sorted.forEach((r) => {
        const len = daysBetween(r.start, r.end) + 1;
        if (len >= MIN_PERIOD_DAYS && len <= MAX_PERIOD_DAYS) lengths.push(len);
    });

    const avgCycle = cycles.length
        ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
        : (getSettings().cycleLength || 28);
    const avgLen = lengths.length
        ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
        : (getSettings().periodLength || 5);

    // 同步到设置里，让预测更准
    saveSettings({ cycleLength: avgCycle, periodLength: avgLen });

    textEl.textContent = `平均周期 ${avgCycle} 天 · 平均经期 ${avgLen} 天（基于最近 ${sorted.length} 次记录）`;

    if (subEl) {
        const sm = getSymptomsMap();
        const freq = {};
        Object.values(sm).forEach((arr) => {
            (arr || []).forEach((s) => {
                freq[s] = (freq[s] || 0) + 1;
            });
        });
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);
        subEl.textContent = top.length
            ? `最常出现：${top.map(([k, v]) => `${k} ×${v}`).join('、')}`
            : '暂无症状记录（长按日格可录入）';
    }
}


/* ==========================================================================
   14. 症状缓解建议
   ========================================================================== */

function renderRelief() {
    const el = byId('period-relief-text');
    if (!el) return;

    const sm = getSymptomsMap();
    const freq = {};
    Object.values(sm).forEach((arr) => {
        (arr || []).forEach((s) => {
            freq[s] = (freq[s] || 0) + 1;
        });
    });

    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (!top.length) {
        el.textContent = '记录症状后，这里会给针对性缓解建议。';
        return;
    }

    const lines = top
        .map(([k]) => `· ${k}：${RELIEF_TIPS[k] || '注意休息，保持心情舒畅。'}`)
        .join('\n');
    el.textContent = lines;
    el.style.whiteSpace = 'pre-wrap';
}


/* ==========================================================================
   15. 健康小贴士
   ========================================================================== */

function renderTips() {
    const tipEl = byId('period-tip-text');
    if (tipEl) {
        tipEl.textContent = '梦角 · ' + randomPick(HEALTH_TIPS);
    }
}


/* ==========================================================================
   16. 月度报告
   ========================================================================== */

function bindStatsButton() {
    const btn = byId('btn-monthly-report');
    if (btn) {
        btn.addEventListener('click', showMonthlyReport);
    }
}

function showMonthlyReport() {
    const list = getRecords();
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const monthStart = `${y}-${pad2(m + 1)}-01`;
    const monthEnd = `${y}-${pad2(m + 1)}-${pad2(new Date(y, m + 1, 0).getDate())}`;

    const inMonth = list.filter((r) => {
        return (r.start >= monthStart && r.start <= monthEnd)
            || (r.end && r.end >= monthStart && r.end <= monthEnd);
    });

    if (!inMonth.length) {
        toast('本月还没有经期记录');
        return;
    }

    const sm = getSymptomsMap();
    const monthSymptomDays = Object.keys(sm).filter(
        (k) => k >= monthStart && k <= monthEnd && sm[k].length
    ).length;

    const lines = inMonth.map((r) => {
        const days = r.end ? daysBetween(r.start, r.end) + 1 : 1;
        return `${r.start} ~ ${r.end || '进行中'}（${days} 天）`;
    }).join('\n');

    window.alert(
        `【${y} 年 ${m + 1} 月报告】\n\n` +
        `记录次数：${inMonth.length}\n` +
        `症状天数：${monthSymptomDays}\n\n` +
        `明细：\n${lines}`
    );
}


/* ==========================================================================
   17. 头部按钮
   ========================================================================== */

function bindHeaderButtons() {
    const notifBtn = byId('btn-period-notifications');
    if (notifBtn) {
        notifBtn.addEventListener('click', () => {
            const s = getSettings();
            const next = !s.reminder;
            saveSettings({ reminder: next });
            toast(next ? '已开启经期提醒' : '已关闭经期提醒');
        });
    }

    const settingsBtn = byId('btn-period-settings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openPeriodSettings);
    }
}

function openPeriodSettings() {
    const s = getSettings();
    const cycle = window.prompt('平均周期天数（默认 28）：', String(s.cycleLength || 28));
    if (cycle === null) return;
    const cycleNum = parseInt(cycle, 10);
    if (!Number.isNaN(cycleNum) && cycleNum >= 15 && cycleNum <= 60) {
        saveSettings({ cycleLength: cycleNum });
    }

    const len = window.prompt('平均经期天数（默认 5）：', String(s.periodLength || 5));
    if (len === null) return;
    const lenNum = parseInt(len, 10);
    if (!Number.isNaN(lenNum) && lenNum >= 1 && lenNum <= 15) {
        saveSettings({ periodLength: lenNum });
    }

    renderAll();
    toast('设置已保存');
}


/* ==========================================================================
   18. 同步首页卡片
   ========================================================================== */

function syncHomeCard() {
    const el = byId('home-period-status');
    if (!el) return;

    const latest = getLatestRecord();
    if (!latest) {
        el.textContent = '未记录';
        return;
    }

    if (isCurrentlyOnPeriod()) {
        const day = daysBetween(latest.start, toYmd(new Date())) + 1;
        el.textContent = `经期第 ${day} 天`;
        return;
    }

    const next = predictNextStart();
    if (next) {
        const d = daysBetween(toYmd(new Date()), next);
        el.textContent = d > 0 ? `距下次 ${d} 天` : '可能已延迟';
        return;
    }
    el.textContent = '已记录';
}


/* ==========================================================================
   19. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const periodActions = {
    'mark-period-start': () => markTodayAsStart(),
    'record-today':      () => recordToday(),
    'calendar-prev':     () => byId('btn-calendar-prev')?.click(),
    'calendar-next':     () => byId('btn-calendar-next')?.click(),
    'monthly-report':    () => showMonthlyReport(),
    'period-notifications': () => byId('btn-period-notifications')?.click(),
    'period-settings':   () => openPeriodSettings()
};

export const periodNavs = {
    'period': () => {
        ensurePeriodData();
        renderAll();
        showScreen('screen-period');
    }
};


/* ==========================================================================
   20. 对外导出
   ========================================================================== */

export default {
    initPeriod,
    destroyPeriod,
    periodActions,
    periodNavs
};