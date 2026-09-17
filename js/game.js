/**
 * game.js
 * 小游戏模块：猜拳 / 骰子 / 抽签 / 真心话 / 今日运势
 * 依赖：config / utils / state / core / data / reply-library / mood / envelope
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 每个游戏都是独立对象，统一接口：play() / render()
 * 2. 目前 config.FEATURES.game = false，需要手动开启才会生效
 * 3. 挂到 window.APP_GAME 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};
    var REPLY = global.APP_REPLY || {};
    var MOOD = global.APP_MOOD || {};
    var ENV = global.APP_ENVELOPE || {};

    var Str = UTILS.Str;
    var Num = UTILS.Num;
    var Time = UTILS.Time;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var FEATURES = CONFIG.FEATURES || {};
    var GAME_ENABLED = FEATURES.game === true;

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }

    /* ============================================================
     * 1. 猜拳 Rock Paper Scissors
     * ============================================================ */
    var RPS = {
        // 'rock' | 'paper' | 'scissors'
        _userChoice: null,
        _taChoice: null,
        _result: null,

        choices: [
            { key: 'rock', name: '石头', emoji: '✊' },
            { key: 'paper', name: '布', emoji: '✋' },
            { key: 'scissors', name: '剪刀', emoji: '✌️' }
        ],

        /**
         * 出拳
         * @param {string} userChoice
         * @returns {object} { user, ta, result, text }
         */
        play: function (userChoice) {
            if (['rock', 'paper', 'scissors'].indexOf(userChoice) === -1) {
                return null;
            }

            this._userChoice = userChoice;
            this._taChoice = Num.randPick(this.choices).key;
            this._result = this._judge(userChoice, this._taChoice);

            var result = {
                user: this._userChoice,
                ta: this._taChoice,
                result: this._result,   // 'win' | 'lose' | 'draw'
                text: this._resultText(),
                userEmoji: this._emojiOf(this._userChoice),
                taEmoji: this._emojiOf(this._taChoice)
            };

            // 记录
            this._saveRecord(result);

            // 情绪影响
            if (this._result === 'win' && MOOD.set) {
                MOOD.set('happy', Num.randInt(60, 85), { source: 'game:rps' });
            } else if (this._result === 'lose' && MOOD.set) {
                MOOD.set('shy', Num.randInt(50, 75), { source: 'game:rps' });
            }

            return result;
        },

        _judge: function (u, t) {
            if (u === t) return 'draw';
            if (
                (u === 'rock' && t === 'scissors') ||
                (u === 'paper' && t === 'rock') ||
                (u === 'scissors' && t === 'paper')
            ) return 'win';
            return 'lose';
        },

        _resultText: function () {
            if (this._result === 'draw') return '平局，再来一次';
            if (this._result === 'win') return '你赢啦';
            return '我赢了';
        },

        _emojiOf: function (key) {
            var c = this.choices.filter(function (x) { return x.key === key; })[0];
            return c ? c.emoji : '';
        },

        _saveRecord: function (r) {
            var s = DATA.Settings.getOne('game') || {};
            s.rps = s.rps || { win: 0, lose: 0, draw: 0, total: 0 };
            s.rps[r.result]++;
            s.rps.total++;
            DATA.Settings.setOne('game', s);
        },

        getStats: function () {
            var s = DATA.Settings.getOne('game') || {};
            return s.rps || { win: 0, lose: 0, draw: 0, total: 0 };
        },

        // 随机出（给 AI 用）
        randomChoice: function () {
            return Num.randPick(this.choices).key;
        }
    };

    /* ============================================================
     * 2. 骰子 Dice
     * ============================================================ */
    var Dice = {
        /**
         * 掷骰子
         * @param {number} count 几个（默认 1）
         * @param {number} sides 几面（默认 6）
         * @returns {object} { results, total, text }
         */
        roll: function (count, sides) {
            var n = Number(count) || 1;
            var s = Number(sides) || 6;
            if (n < 1 || n > 10) n = 1;
            if (s < 2 || s > 100) s = 6;

            var results = [];
            for (var i = 0; i < n; i++) {
                results.push(Num.randInt(1, s));
            }
            var total = results.reduce(function (a, b) { return a + b; }, 0);

            var result = {
                count: n,
                sides: s,
                results: results,
                total: total,
                text: n === 1
                    ? '你掷出了 ' + total
                    : '你掷出了 ' + results.join(' + ') + ' = ' + total
            };

            // 情绪
            if (n === 1 && s === 6) {
                if (total === 6 && MOOD.set) {
                    MOOD.set('excited', Num.randInt(70, 90), { source: 'game:dice' });
                } else if (total === 1 && MOOD.set) {
                    MOOD.set('sad', Num.randInt(40, 60), { source: 'game:dice' });
                }
            }

            return result;
        }
    };

    /* ============================================================
     * 3. 抽签 Draw
     * ============================================================ */
    var Draw = {
        _fortunes: [
            { level: '大吉', desc: '今天会有好事发生', emoji: '🌟' },
            { level: '吉', desc: '一切顺利', emoji: '✨' },
            { level: '中吉', desc: '平安顺遂', emoji: '🍀' },
            { level: '小吉', desc: '小心一点就好', emoji: '🌤' },
            { level: '末吉', desc: '事情会慢慢变好', emoji: '🌱' },
            { level: '凶', desc: '今天注意休息', emoji: '🌧' },
            { level: '大凶', desc: '不管做什么，我在陪你', emoji: '⛈' }
        ],

        /**
         * 抽一次
         * @returns {object}
         */
        draw: function () {
            var f = Num.randPick(this._fortunes);

            var result = {
                level: f.level,
                desc: f.desc,
                emoji: f.emoji,
                time: Date.now()
            };

            // 存记录
            this._save(result);

            // 情绪：大吉→开心，凶→平静
            if (MOOD.set) {
                if (f.level === '大吉') {
                    MOOD.set('excited', Num.randInt(75, 95), { source: 'game:draw' });
                } else if (f.level === '凶' || f.level === '大凶') {
                    MOOD.set('calm', Num.randInt(40, 60), { source: 'game:draw' });
                }
            }

            return result;
        },

        _save: function (r) {
            var s = DATA.Settings.getOne('game') || {};
            s.draw = s.draw || [];
            s.draw.unshift(r);
            if (s.draw.length > 30) s.draw = s.draw.slice(0, 30);
            DATA.Settings.setOne('game', s);
        },

        getHistory: function (n) {
            var s = DATA.Settings.getOne('game') || {};
            var list = s.draw || [];
            return n ? list.slice(0, n) : list;
        },

        clearHistory: function () {
            var s = DATA.Settings.getOne('game') || {};
            s.draw = [];
            DATA.Settings.setOne('game', s);
        }
    };

    /* ============================================================
     * 4. 真心话 Truth or Dare
     * ============================================================ */
    var Truth = {
        _truths: [
            '你最喜欢我哪一点',
            '今天有没有想我',
            '最想和我一起做什么',
            '最近一次笑出声是因为什么',
            '有什么事一直没敢告诉我',
            '如果可以重来一件事，你想改什么',
            '最想对我说的一句话是什么',
            '你第一次见我的印象是什么',
            '最近有什么小心事',
            '你觉得我们像什么'
        ],

        _dares: [
            '给我发一句情话',
            '夸我一句',
            '用三个词形容我',
            '唱一句歌给我听',
            '给我说一个冷笑话',
            '告诉我你今天穿了什么',
            '发一个你最常用的表情',
            '说出你今天做的一件小事',
            '答应我一件事（我来说）',
            '对我撒个娇'
        ],

        /**
         * 抽一个
         * @param {string} type 'truth' | 'dare' | 'random'
         */
        pick: function (type) {
            var t = type === 'random' ? Num.randPick(['truth', 'dare']) : type;
            var pool = t === 'dare' ? this._dares : this._truths;
            var text = Num.randPick(pool);

            return {
                type: t,
                typeName: t === 'dare' ? '大冒险' : '真心话',
                text: text
            };
        }
    };

    /* ============================================================
     * 5. 今日运势 Fortune
     * ============================================================ */
    var Fortune = {
        _luckyColors: [
            '白色', '红色', '粉色', '蓝色', '绿色', '黄色', '紫色', '黑色'
        ],

        _luckyNumbers: [1, 3, 5, 6, 7, 8, 9, 12, 16, 18, 21, 28],

        _advice: [
            '今天适合做决定',
            '今天多喝水',
            '今天早点休息',
            '今天可以说出心里话',
            '今天适合散步',
            '今天记得给 TA 发消息',
            '今天不要熬夜',
            '今天穿喜欢的衣服'
        ],

        /**
         * 计算今日运势
         * 同一天结果固定（按日期哈希）
         */
        get: function () {
            var today = Time.formatDate();
            var seed = this._hashDate(today);
            var rng = this._seededRandom(seed);

            var score = Math.floor(rng() * 60) + 40;  // 40~100
            var stars = Math.ceil(score / 20);         // 2~5
            var color = this._luckyColors[Math.floor(rng() * this._luckyColors.length)];
            var number = this._luckyNumbers[Math.floor(rng() * this._luckyNumbers.length)];
            var advice = this._advice[Math.floor(rng() * this._advice.length)];

            return {
                date: today,
                score: score,
                stars: stars,
                color: color,
                number: number,
                advice: advice,
                text: '今日运势 ' + score + ' 分（' + '⭐'.repeat(stars) + '）'
            };
        },

        _hashDate: function (str) {
            var h = 0;
            for (var i = 0; i < str.length; i++) {
                h = ((h << 5) - h) + str.charCodeAt(i);
                h |= 0;
            }
            return Math.abs(h);
        },

        _seededRandom: function (seed) {
            var s = seed % 2147483647;
            if (s <= 0) s += 2147483646;
            return function () {
                s = (s * 16807) % 2147483647;
                return (s - 1) / 2147483646;
            };
        }
    };

    /* ============================================================
     * 6. 猜数字 Number Guess
     * ============================================================ */
    var NumberGuess = {
        _target: null,
        _min: 1,
        _max: 100,
        _tries: 0,
        _maxTries: 7,

        start: function (min, max) {
            this._min = Number(min) || 1;
            this._max = Number(max) || 100;
            this._target = Num.randInt(this._min, this._max);
            this._tries = 0;
            return {
                min: this._min,
                max: this._max,
                maxTries: this._maxTries
            };
        },

        guess: function (n) {
            if (this._target === null) return null;
            var num = Number(n);
            if (isNaN(num)) return null;

            this._tries++;
            var hint;

            if (num === this._target) {
                hint = 'correct';
            } else if (num > this._target) {
                hint = 'high';
            } else {
                hint = 'low';
            }

            var result = {
                guess: num,
                hint: hint,
                tries: this._tries,
                maxTries: this._maxTries,
                remain: this._maxTries - this._tries,
                finished: hint === 'correct' || this._tries >= this._maxTries
            };

            if (hint === 'correct') {
                result.answer = this._target;
                result.text = '猜对了！答案就是 ' + this._target + '，用了 ' + this._tries + ' 次';
                if (MOOD.set) MOOD.set('excited', Num.randInt(70, 90), { source: 'game:guess' });
            } else if (this._tries >= this._maxTries) {
                result.answer = this._target;
                result.text = '次数用完啦，答案是 ' + this._target;
            } else if (hint === 'high') {
                result.text = '太大了，再小一点';
            } else {
                result.text = '太小了，再大一点';
            }

            return result;
        },

        reset: function () {
            this._target = null;
            this._tries = 0;
        },

        isPlaying: function () {
            return this._target !== null && this._tries < this._maxTries;
        }
    };

    /* ============================================================
     * 7. 通用：把结果发到聊天
     * ============================================================ */

    /**
     * 把游戏结果作为一条消息发到聊天
     * @param {string} text 用户侧文字
     * @param {string} taText 梦角侧文字（可选）
     */
    function sendToChat(text, taText) {
        var chatId = STATE.get('currentChatId') || 'ta';

        DATA.Chat.addMessage(chatId, {
            from: 'me',
            text: text,
            type: 'text'
        });

        if (taText) {
            var delay = Num.randInt(1, 3) * 1000;
            setTimeout(function () {
                DATA.Chat.addMessage(chatId, {
                    from: 'ta',
                    text: taText,
                    type: 'text'
                });
                if (CORE.emit) CORE.emit('message:render', { chatId: chatId });
            }, delay);
        }
    }

    /* ============================================================
     * 8. 结算 UI 渲染（简单版，用通知）
     * ============================================================ */
    function showResult(title, body, icon) {
        if (ENV && ENV.notify) {
            ENV.notify({
                title: title,
                body: body,
                icon: icon || '🎮',
                timeout: 3000
            });
        } else {
            alert(title + '\n' + body);
        }
    }

    /* ============================================================
     * 9. 统一入口：玩一个游戏
     * ============================================================ */
    function play(gameName, params) {
        if (!GAME_ENABLED) {
            Log.warn('[game] 游戏功能未开启');
            return null;
        }

        var result;
        switch (gameName) {
            case 'rps':
                result = RPS.play(params && params.choice);
                if (result) {
                    showResult('猜拳', result.userEmoji + ' vs ' + result.taEmoji + '\n' + result.text, '✊');
                }
                break;

            case 'dice':
                result = Dice.roll(params && params.count, params && params.sides);
                showResult('骰子', result.text, '🎲');
                break;

            case 'draw':
                result = Draw.draw();
                showResult('抽签', result.emoji + ' ' + result.level + '\n' + result.desc, '🎋');
                break;

            case 'truth':
                result = Truth.pick(params && params.type);
                showResult(result.typeName, result.text, '🎭');
                break;

            case 'fortune':
                result = Fortune.get();
                showResult('今日运势', result.text + '\n幸运色：' + result.color + '\n幸运数字：' + result.number + '\n' + result.advice, '🔮');
                break;

            case 'guess':
                if (params && params.action === 'start') {
                    result = NumberGuess.start(params.min, params.max);
                    showResult('猜数字', '我想了一个 ' + result.min + '~' + result.max + ' 之间的数字，你有 ' + result.maxTries + ' 次机会', '🎯');
                } else if (params && params.action === 'guess') {
                    result = NumberGuess.guess(params.number);
                    if (result) showResult('猜数字', result.text, '🎯');
                }
                break;

            default:
                Log.warn('[game] 未知游戏:', gameName);
                return null;
        }

        if (CORE.emit) CORE.emit('game:played', { game: gameName, result: result });
        return result;
    }

    /* ============================================================
     * 10. 初始化
     * ============================================================ */
    function init() {
        if (!GAME_ENABLED) {
            Log.log('[game] 游戏模块未开启（FEATURES.game = false）');
            return;
        }
        Log.log('[game] 初始化完成');
    }

    /* ============================================================
     * 11. 对外导出
     * ============================================================ */
    var APP_GAME = {
        init: init,
        enabled: GAME_ENABLED,

        // 统一入口
        play: play,

        // 各游戏
        RPS: RPS,
        Dice: Dice,
        Draw: Draw,
        Truth: Truth,
        Fortune: Fortune,
        NumberGuess: NumberGuess,

        // 工具
        sendToChat: sendToChat
    };

    global.APP_GAME = APP_GAME;

})(typeof window !== 'undefined' ? window : this);