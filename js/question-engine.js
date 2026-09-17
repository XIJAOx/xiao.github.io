/**
 * question-engine.js
 * 提问增强：TA 主动出题 + 用户回答 + TA 对答案的反应
 * 依赖：config / utils / data / core / reply-library / mood / envelope
 * 被依赖：listeners.js / features.js
 *
 * 挂到 window.APP_QUESTION_ENGINE 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var DATA = global.APP_DATA || {};
    var CORE = global.APP_CORE || {};
    var REPLY = global.APP_REPLY || {};
    var MOOD = global.APP_MOOD || {};
    var ENV = global.APP_ENVELOPE || {};

    var Str = UTILS.Str;
    var Num = UTILS.Num;
    var Time = UTILS.Time;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }
    function $(s, p) { return (p || document).querySelector(s); }

    /* ============================================================
     * 1. TA 可以出题的问题池
     * ============================================================ */
    var TA_QUESTIONS = [
        {
            content: '今天最想我做什么？',
            type: 'single',
            options: ['陪我聊天', '给我打电话', '写封信给我', '一起听歌']
        },
        {
            content: '你觉得我们现在的关系是？',
            type: 'single',
            options: ['刚认识', '有点暧昧', '在恋爱', '老夫老妻']
        },
        {
            content: '今天心情怎么样？',
            type: 'single',
            options: ['很好', '还不错', '一般', '不太好']
        },
        {
            content: '你最喜欢我哪一点？',
            type: 'single',
            options: ['温柔', '幽默', '可靠', '全部']
        },
        {
            content: '如果只能带一样东西去荒岛，你会带？',
            type: 'single',
            options: ['我', '手机', '食物', '书']
        },
        {
            content: '你比较喜欢哪种相处方式？',
            type: 'multi',
            options: ['安静陪伴', '一起玩闹', '深夜长谈', '各做各的']
        },
        {
            content: '这个周末想做什么？',
            type: 'multi',
            options: ['在家躺平', '出门散步', '看电影', '见朋友']
        },
        {
            content: '最近有没有想对我说的话？',
            type: 'single',
            options: ['想你了', '谢谢你', '有点生气', '没什么']
        },
        {
            content: '你觉得我像什么动物？',
            type: 'single',
            options: ['猫', '狗', '兔子', '狐狸']
        },
        {
            content: '你最喜欢的季节是？',
            type: 'single',
            options: ['春', '夏', '秋', '冬']
        },
        {
            content: '今天有按时吃饭吗？',
            type: 'single',
            options: ['吃了', '忘了', '正准备吃', '不饿']
        },
        {
            content: '想和我一起做哪件事？',
            type: 'multi',
            options: ['看日出', '听雨', '做饭', '旅行']
        }
    ];

    /* ============================================================
     * 2. TA 对用户回答的反应
     * ============================================================ */
    var REACTIONS = {
        // 通用：用户答完
        general: [
            '嗯，我知道了',
            '原来你是这样想的呀',
            '好，我记住了',
            '这个回答我喜欢',
            '嗯…让我想想'
        ],
        // 用户选了"想你了"相关
        loveAnswer: [
            '我也想你',
            '听到这个我好开心',
            '嘿嘿，那你多来看看我',
            '我也一样'
        ],
        // 用户选了不太好的答案
        sadAnswer: [
            '没关系，我理解的',
            '嗯…好吧',
            '下次会更好',
            '我等你'
        ],
        // 用户选"我"（荒岛问题）
        pickMe: [
            '真的吗？我好开心',
            '就知道你会选我',
            '那我一定会好好照顾你'
        ]
    };

    /* ============================================================
     * 3. 让 TA 主动出一道题
     * ============================================================ */

    /**
     * TA 出题
     * @param {object} options
     *   - silent: 不通知
     * @returns {object|null} 新问题
     */
    function taAskQuestion(options) {
        options = options || {};

        // 随机选一题
        var template = Num.randPick(TA_QUESTIONS);

        var q = DATA.Question.add('ta', {
            content: template.content,
            type: template.type,
            options: template.options.map(function (t) { return { text: t }; })
        });

        if (!options.silent) {
            ENV.notify({
                title: 'TA 向你提了个问题',
                body: template.content,
                icon: '💬',
                timeout: 3500,
                onClick: function () {
                    if (CORE.showPage) CORE.showPage('questionPage');
                }
            });
        }

        // 情绪联动
        if (MOOD.set) {
            MOOD.set('calm', Num.randInt(55, 75), { source: 'taAsk' });
        }

        Log.log('[question-engine] TA 出题:', template.content);
        return q;
    }

    /* ============================================================
     * 4. 用户回答 → TA 反应
     * ============================================================ */

    /**
     * 用户在 TA 的提问里选了答案
     * @param {string} qid 问题 id
     * @param {string} optText 选项文字
     */
    function onUserAnswer(qid, optText) {
        var q = DATA.Question.get('ta', qid);
        if (!q) return;

        // 判断选了什么，给对应反应
        var reaction = _pickReaction(q, optText);

        // 延迟 1~3 秒后 TA 说话
        setTimeout(function () {
            var chatId = 'ta';
            DATA.Chat.addMessage(chatId, {
                from: 'ta',
                text: reaction,
                type: 'text'
            });

            if (MOOD.set) {
                MOOD.set('happy', Num.randInt(60, 85), { source: 'questionAnswered' });
            }

            // 如果在聊天页就刷新
            if (global.APP_FEATURES && global.APP_FEATURES.Chat) {
                var page = global.APP_STATE && global.APP_STATE.Page && global.APP_STATE.Page.current();
                if (page === 'chatRoom') {
                    global.APP_FEATURES.Chat.renderRoom();
                }
            }
        }, Num.randInt(1000, 3000));
    }

    function _pickReaction(q, optText) {
        var opt = optText || '';

        // 爱情相关
        if (/想你|喜欢你|爱你|我$/.test(opt) || /我/.test(opt) && q.content.indexOf('荒岛') > -1) {
            if (q.content.indexOf('荒岛') > -1) {
                return Num.randPick(REACTIONS.pickMe);
            }
            return Num.randPick(REACTIONS.loveAnswer);
        }

        // 不太好
        if (/不太好|难过|生气|忘了|不饿|没什么/.test(opt)) {
            return Num.randPick(REACTIONS.sadAnswer);
        }

        return Num.randPick(REACTIONS.general);
    }

    /* ============================================================
     * 5. 用户回答完 TA 的问题后，可能 TA 再出下一题
     * ============================================================ */
    function maybeAskAnother() {
        // 30% 概率再出一题
        if (!Num.chance(0.3)) return null;
        // 距离上次出题至少 30 分钟
        var list = DATA.Question.list('ta');
        var last = list[0];
        if (last && (Date.now() - last.createdAt) < 30 * 60 * 1000) return null;
        return taAskQuestion();
    }

    /* ============================================================
     * 6. 自动触发（后台调用）
     * ============================================================ */

    /**
     * 检查是否需要 TA 主动出题
     * 1. 距离上次出题 > 4 小时
     * 2. 已出题数 < 20
     * 3. 15% 概率
     */
    function tryAutoAsk() {
        var list = DATA.Question.list('ta');
        var last = list[0];
        var lastTime = last ? last.createdAt : 0;
        var sinceHour = (Date.now() - lastTime) / 3600000;

        if (sinceHour < 4) return false;
        if (list.length >= 20) return false;
        if (!Num.chance(0.15)) return false;

        taAskQuestion();
        return true;
    }

    /* ============================================================
     * 7. 统计
     * ============================================================ */
    function getStats() {
        var list = DATA.Question.list('ta');
        var answered = list.filter(function (q) { return q.answer && q.answer.length > 0; });
        return {
            total: list.length,
            answered: answered.length,
            pending: list.length - answered.length
        };
    }

    /* ============================================================
     * 8. 初始化
     * ============================================================ */
    function init() {
        // 首次进入如果 TA 没有出过题，延迟 30 秒出一道
        var list = DATA.Question.list('ta');
        if (list.length === 0) {
            setTimeout(function () {
                taAskQuestion();
            }, 30 * 1000);
        }

        Log.log('[question-engine] 初始化完成，TA 已出题:', list.length);
    }

    /* ============================================================
     * 9. 对外导出
     * ============================================================ */
    var APP_QUESTION_ENGINE = {
        init: init,
        taAskQuestion: taAskQuestion,
        onUserAnswer: onUserAnswer,
        maybeAskAnother: maybeAskAnother,
        tryAutoAsk: tryAutoAsk,
        getStats: getStats,
        TA_QUESTIONS: TA_QUESTIONS
    };

    global.APP_QUESTION_ENGINE = APP_QUESTION_ENGINE;

})(typeof window !== 'undefined' ? window : this);