/**
 * tarot-data.js
 * 塔罗牌（78张完整）+ 雷诺曼（36张）数据
 * 依赖：无
 * 被依赖：features.js（占卜模块）
 *
 * 挂到 window.APP_TAROT 上
 */

(function (global) {
    'use strict';

    /* ============================================================
     * 1. 塔罗牌 · 大阿卡纳 22 张
     * ============================================================ */
    var MAJOR = [
        { id: 0, name: '愚者', en: 'The Fool', symbol: '🃏',
          up: '新的开始、冒险、纯真、可能性', down: '鲁莽、逃避、犹豫不决',
          love: '一段新的感情正在萌芽', career: '适合尝试新领域' },
        { id: 1, name: '魔术师', en: 'The Magician', symbol: '🎩',
          up: '创造力、能力、掌控、行动', down: '欺瞒、手段、能力被浪费',
          love: '主动出击会有收获', career: '技能被认可' },
        { id: 2, name: '女祭司', en: 'The High Priestess', symbol: '🌙',
          up: '直觉、潜意识、神秘、内在智慧', down: '忽视直觉、秘密、表面化',
          love: '感情需要静观其变', career: '相信自己的判断' },
        { id: 3, name: '女皇', en: 'The Empress', symbol: '👑',
          up: '丰饶、母性、感性、创造力', down: '依赖、过度保护、缺乏成长',
          love: '一段被滋养的关系', career: '创意工作顺利' },
        { id: 4, name: '皇帝', en: 'The Emperor', symbol: '🏛',
          up: '权威、秩序、掌控、责任感', down: '专制、固执、缺乏弹性',
          love: '稳定可靠的关系', career: '领导力被认可' },
        { id: 5, name: '教皇', en: 'The Hierophant', symbol: '⛪',
          up: '传统、信仰、指导、精神支持', down: '教条、叛逆、不守规则',
          love: '适合步入正式关系', career: '遵从规则会顺利' },
        { id: 6, name: '恋人', en: 'The Lovers', symbol: '💕',
          up: '爱情、选择、吸引、结合', down: '分离、错选、关系失衡',
          love: '真心相爱', career: '需要做重要选择' },
        { id: 7, name: '战车', en: 'The Chariot', symbol: '🏇',
          up: '胜利、意志、前进、掌控', down: '失控、方向迷失、冲动',
          love: '主动出击收获爱情', career: '克服困难就能成功' },
        { id: 8, name: '力量', en: 'Strength', symbol: '🦁',
          up: '勇气、耐心、内在力量', down: '软弱、自卑、缺乏信心',
          love: '以柔克刚', career: '坚持就会胜利' },
        { id: 9, name: '隐者', en: 'The Hermit', symbol: '🕯',
          up: '内省、独处、寻找答案', down: '孤僻、拒绝帮助、迷失',
          love: '需要时间独处思考', career: '适合沉淀期' },
        { id: 10, name: '命运之轮', en: 'Wheel of Fortune', symbol: '🎡',
          up: '转机、命运、时机到来', down: '运势低谷、时机未到',
          love: '缘分到了', career: '机会即将出现' },
        { id: 11, name: '正义', en: 'Justice', symbol: '⚖️',
          up: '公平、真相、因果、责任', down: '不公、偏袒、逃避责任',
          love: '感情需要公平对待', career: '结果与付出成正比' },
        { id: 12, name: '倒吊人', en: 'The Hanged Man', symbol: '🙃',
          up: '牺牲、等待、换个角度', down: '徒劳、固执、抗拒改变',
          love: '耐心等待', career: '退一步海阔天空' },
        { id: 13, name: '死神', en: 'Death', symbol: '💀',
          up: '结束、转变、新生', down: '抗拒改变、停滞',
          love: '旧的结束新的开始', career: '转行或改变方向' },
        { id: 14, name: '节制', en: 'Temperance', symbol: '🏺',
          up: '平衡、调和、耐心、中庸', down: '极端、失衡、缺乏节制',
          love: '互补的关系', career: '稳中求进' },
        { id: 15, name: '恶魔', en: 'The Devil', symbol: '😈',
          up: '欲望、束缚、执念', down: '解脱、觉醒、放下',
          love: '需要警惕沉迷', career: '小心利益陷阱' },
        { id: 16, name: '塔', en: 'The Tower', symbol: '🗼',
          up: '突变、崩塌、意外', down: '避免灾难、转危为安',
          love: '感情可能有变故', career: '突然的变化' },
        { id: 17, name: '星星', en: 'The Star', symbol: '⭐',
          up: '希望、疗愈、灵感、信心', down: '失望、迷茫、缺乏信心',
          love: '希望就在前方', career: '保持信心' },
        { id: 18, name: '月亮', en: 'The Moon', symbol: '🌕',
          up: '幻象、潜意识、焦虑', down: '真相浮现、驱散迷雾',
          love: '注意误会产生', career: '小心暗中的问题' },
        { id: 19, name: '太阳', en: 'The Sun', symbol: '☀️',
          up: '成功、快乐、光明', down: '短暂的阴霾',
          love: '阳光灿烂的感情', career: '大获成功' },
        { id: 20, name: '审判', en: 'Judgement', symbol: '🎺',
          up: '觉醒、重生、决断', down: '犹豫、逃避、悔恨',
          love: '重新评估关系', career: '是时候做决定了' },
        { id: 21, name: '世界', en: 'The World', symbol: '🌍',
          up: '完成、圆满、成功', down: '未完成、缺憾',
          love: '圆满的关系', career: '一个阶段完美结束' }
    ];

    /* ============================================================
     * 2. 塔罗牌 · 小阿卡纳 56 张
     *    四个花色：权杖(Wands) / 圣杯(Cups) / 宝剑(Swords) / 星币(Pentacles)
     *    每花色 14 张：Ace~10 + 侍从/骑士/王后/国王
     * ============================================================ */

    // 花色基础信息
    var SUITS = {
        wands:     { name: '权杖', en: 'Wands',     symbol: '🔥', color: '#ff6b35' },
        cups:      { name: '圣杯', en: 'Cups',      symbol: '💧', color: '#4299e1' },
        swords:    { name: '宝剑', en: 'Swords',    symbol: '⚔️', color: '#88ccdd' },
        pentacles: { name: '星币', en: 'Pentacles', symbol: '🪙', color: '#c9a885' }
    };

    // 数字牌 1~10 通用含义（按花色再补细节）
    var NUM_MEANINGS = {
        1:  { name: 'Ace',     up: '新的开始、机遇',   down: '错失、拖延' },
        2:  { name: '二',      up: '选择、平衡',       down: '犹豫、失衡' },
        3:  { name: '三',      up: '初步成果、协作',   down: '合作破裂' },
        4:  { name: '四',      up: '稳定、休息',       down: '停滞、束缚' },
        5:  { name: '五',      up: '冲突、挑战',       down: '化解、克服' },
        6:  { name: '六',      up: '和谐、顺利',       down: '停滞、依赖' },
        7:  { name: '七',      up: '评估、坚持',       down: '放弃、疲惫' },
        8:  { name: '八',      up: '前进、努力',       down: '停滞、倒退' },
        9:  { name: '九',      up: '接近完成、考验',   down: '焦虑、压力' },
        10: { name: '十',      up: '圆满、结束',       down: '压力、负担' }
    };

    // 宫廷牌
    var COURT = {
        page:   { name: '侍从', en: 'Page',   up: '消息、学习、好奇', down: '幼稚、不成熟' },
        knight: { name: '骑士', en: 'Knight', up: '行动、追求、前进', down: '冲动、鲁莽' },
        queen:  { name: '王后', en: 'Queen',  up: '成熟、滋养、内在', down: '情绪化、控制' },
        king:   { name: '国王', en: 'King',   up: '权威、掌控、成就', down: '专横、固执' }
    };

    // 每花色整体特征
    var SUIT_FLAVOR = {
        wands: {
            theme: '行动、热情、创造',
            love: '热烈而主动的感情',
            career: '事业上的机遇和动力'
        },
        cups: {
            theme: '情感、关系、直觉',
            love: '深情而细腻的关系',
            career: '团队合作顺利'
        },
        swords: {
            theme: '思想、沟通、冲突',
            love: '需要好好沟通',
            career: '需要理性和判断'
        },
        pentacles: {
            theme: '物质、现实、健康',
            love: '务实稳定的感情',
            career: '财运和工作稳定'
        }
    };

    // 生成小阿卡纳
    function _buildMinor() {
        var result = [];
        Object.keys(SUITS).forEach(function (suitKey) {
            var suit = SUITS[suitKey];
            // 1~10
            for (var n = 1; n <= 10; n++) {
                var numInfo = NUM_MEANINGS[n];
                result.push({
                    id: suitKey + '_' + n,
                    suit: suitKey,
                    name: suit.name + numInfo.name,
                    en: numInfo.name + ' of ' + suit.en,
                    symbol: suit.symbol,
                    color: suit.color,
                    up: numInfo.up + '（' + suit.theme + '）',
                    down: numInfo.down + '（' + suit.theme + '）',
                    love: SUIT_FLAVOR[suitKey].love,
                    career: SUIT_FLAVOR[suitKey].career
                });
            }
            // 宫廷牌
            Object.keys(COURT).forEach(function (ck) {
                var c = COURT[ck];
                result.push({
                    id: suitKey + '_' + ck,
                    suit: suitKey,
                    name: suit.name + c.name,
                    en: c.en + ' of ' + suit.en,
                    symbol: suit.symbol,
                    color: suit.color,
                    up: c.up + '（' + suit.theme + '）',
                    down: c.down + '（' + suit.theme + '）',
                    love: SUIT_FLAVOR[suitKey].love,
                    career: SUIT_FLAVOR[suitKey].career
                });
            });
        });
        return result;
    }

    var MINOR = _buildMinor();

    // 完整 78 张
    var TAROT_ALL = MAJOR.concat(MINOR);

    /* ============================================================
     * 3. 雷诺曼 36 张
     * ============================================================ */
    var LENORMAND = [
        { id: 1,  name: '骑士', en: 'Rider', symbol: '🐎',
          up: '消息到来、快速行动', down: '消息延迟、坏消息' },
        { id: 2,  name: '四叶草', en: 'Clover', symbol: '🍀',
          up: '小幸运、短暂好运', down: '好运溜走、小挫折' },
        { id: 3,  name: '船', en: 'Ship', symbol: '🚢',
          up: '旅行、远方、启程', down: '延误、放弃计划' },
        { id: 4,  name: '房子', en: 'House', symbol: '🏠',
          up: '家庭、稳定、安全', down: '家庭矛盾、不安' },
        { id: 5,  name: '树', en: 'Tree', symbol: '🌳',
          up: '成长、健康、根基', down: '停滞、健康问题' },
        { id: 6,  name: '云', en: 'Clouds', symbol: '☁️',
          up: '困惑、不确定', down: '迷雾散去、明朗' },
        { id: 7,  name: '蛇', en: 'Snake', symbol: '🐍',
          up: '欺骗、曲折、女性', down: '真相揭露' },
        { id: 8,  name: '棺材', en: 'Coffin', symbol: '⚰️',
          up: '结束、休息、转变', down: '拖延、慢性问题' },
        { id: 9,  name: '花束', en: 'Bouquet', symbol: '💐',
          up: '礼物、喜悦、美好', down: '失望、虚假' },
        { id: 10, name: '镰刀', en: 'Scythe', symbol: '⚔️',
          up: '突然的切断、决定', down: '犹豫、缓慢' },
        { id: 11, name: '鞭子', en: 'Whip', symbol: '🪢',
          up: '争论、重复、性', down: '和解、结束争论' },
        { id: 12, name: '鸟', en: 'Birds', symbol: '🐦',
          up: '对话、焦虑、小会面', down: '沉默、平静' },
        { id: 13, name: '小孩', en: 'Child', symbol: '👶',
          up: '新的开始、纯真', down: '幼稚、拖延' },
        { id: 14, name: '狐狸', en: 'Fox', symbol: '🦊',
          up: '聪明、工作、欺骗', down: '诚实、失误' },
        { id: 15, name: '熊', en: 'Bear', symbol: '🐻',
          up: '力量、权威、财务', down: '依赖、控制' },
        { id: 16, name: '星星', en: 'Stars', symbol: '⭐',
          up: '希望、指引、灵感', down: '迷茫、失去方向' },
        { id: 17, name: '鹳', en: 'Stork', symbol: '🦢',
          up: '改变、搬迁、转机', down: '停滞、原地踏步' },
        { id: 18, name: '狗', en: 'Dog', symbol: '🐶',
          up: '朋友、忠诚、信任', down: '背叛、孤立' },
        { id: 19, name: '塔', en: 'Tower', symbol: '🗼',
          up: '权威、机构、孤独', down: '开放、打破隔离' },
        { id: 20, name: '花园', en: 'Garden', symbol: '🌷',
          up: '社交、公开、聚会', down: '孤僻、退缩' },
        { id: 21, name: '山', en: 'Mountain', symbol: '⛰',
          up: '障碍、延迟、敌意', down: '障碍消除' },
        { id: 22, name: '十字路口', en: 'Crossroads', symbol: '🛤',
          up: '选择、决定、多条路', down: '方向已定' },
        { id: 23, name: '老鼠', en: 'Mice', symbol: '🐭',
          up: '损失、焦虑、消耗', down: '恢复、弥补' },
        { id: 24, name: '心', en: 'Heart', symbol: '❤️',
          up: '爱情、感情、热情', down: '心碎、冷淡' },
        { id: 25, name: '戒指', en: 'Ring', symbol: '💍',
          up: '承诺、契约、婚约', down: '分手、毁约' },
        { id: 26, name: '书', en: 'Book', symbol: '📖',
          up: '秘密、学习、未知', down: '真相显露' },
        { id: 27, name: '信', en: 'Letter', symbol: '✉️',
          up: '消息、文件、沟通', down: '坏消息、误解' },
        { id: 28, name: '男人', en: 'Man', symbol: '👨',
          up: '男性、问卜者（男）', down: '男性特质失衡' },
        { id: 29, name: '女人', en: 'Woman', symbol: '👩',
          up: '女性、问卜者（女）', down: '女性特质失衡' },
        { id: 30, name: '百合', en: 'Lily', symbol: '🌺',
          up: '和平、成熟、性', down: '冲突、不成熟' },
        { id: 31, name: '太阳', en: 'Sun', symbol: '☀️',
          up: '成功、快乐、能量', down: '暂时的阴霾' },
        { id: 32, name: '月亮', en: 'Moon', symbol: '🌕',
          up: '情感、直觉、名声', down: '情绪不稳、误会' },
        { id: 33, name: '钥匙', en: 'Key', symbol: '🔑',
          up: '关键、答案、成功', down: '无解、锁住' },
        { id: 34, name: '鱼', en: 'Fish', symbol: '🐟',
          up: '财富、生意、流动', down: '财务问题' },
        { id: 35, name: '锚', en: 'Anchor', symbol: '⚓',
          up: '稳定、坚持、工作', down: '停滞、束缚' },
        { id: 36, name: '十字架', en: 'Cross', symbol: '✝️',
          up: '命运、考验、信仰', down: '解脱、放下' }
    ];

    /* ============================================================
     * 4. 抽牌方法
     * ============================================================ */

    /**
     * 洗牌（随机打乱，不修改原数组）
     */
    function shuffle(arr) {
        var copy = arr.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = copy[i];
            copy[i] = copy[j];
            copy[j] = t;
        }
        return copy;
    }

    /**
     * 抽 n 张塔罗
     * @param {number} n
     * @param {string} deck 'all' | 'major' | 'minor'
     * @returns {Array}
     */
    function drawTarot(n, deck) {
        n = n || 1;
        var pool;
        if (deck === 'major') pool = MAJOR;
        else if (deck === 'minor') pool = MINOR;
        else pool = TAROT_ALL;

        var shuffled = shuffle(pool);
        var picked = shuffled.slice(0, Math.min(n, shuffled.length));

        return picked.map(function (card) {
            var reversed = Math.random() < 0.35;
            return {
                id: card.id,
                name: card.name,
                en: card.en,
                symbol: card.symbol,
                color: card.color || '#41346b',
                suit: card.suit || 'major',
                reversed: reversed,
                meaning: reversed ? card.down : card.up,
                love: card.love,
                career: card.career
            };
        });
    }

    /**
     * 抽 n 张雷诺曼
     */
    function drawLenormand(n) {
        n = n || 1;
        var shuffled = shuffle(LENORMAND);
        var picked = shuffled.slice(0, Math.min(n, shuffled.length));

        return picked.map(function (card) {
            // 雷诺曼一般不用逆位，但保留字段以统一结构
            var reversed = false;
            return {
                id: card.id,
                name: card.name,
                en: card.en,
                symbol: card.symbol,
                color: '#4a3d7a',
                suit: 'lenormand',
                reversed: reversed,
                meaning: card.up
            };
        });
    }

    /**
     * 统一抽牌入口
     * @param {string} type 'tarot' | 'lenormand'
     * @param {number} n
     */
    function draw(type, n) {
        if (type === 'lenormand') return drawLenormand(n);
        return drawTarot(n);
    }

    /* ============================================================
     * 5. 查询
     * ============================================================ */
    function getTarotByName(name) {
        for (var i = 0; i < TAROT_ALL.length; i++) {
            if (TAROT_ALL[i].name === name) return TAROT_ALL[i];
        }
        return null;
    }

    function getLenormandByName(name) {
        for (var i = 0; i < LENORMAND.length; i++) {
            if (LENORMAND[i].name === name) return LENORMAND[i];
        }
        return null;
    }

    /* ============================================================
     * 6. 对外导出
     * ============================================================ */
    var APP_TAROT = {
        // 数据
        MAJOR: MAJOR,
        MINOR: MINOR,
        TAROT_ALL: TAROT_ALL,
        LENORMAND: LENORMAND,

        // 元数据
        SUITS: SUITS,
        NUM_MEANINGS: NUM_MEANINGS,
        COURT: COURT,

        // 方法
        shuffle: shuffle,
        draw: draw,
        drawTarot: drawTarot,
        drawLenormand: drawLenormand,
        getTarotByName: getTarotByName,
        getLenormandByName: getLenormandByName,

        // 统计
        count: {
            tarot: TAROT_ALL.length,      // 78
            major: MAJOR.length,          // 22
            minor: MINOR.length,          // 56
            lenormand: LENORMAND.length   // 36
        }
    };

    global.APP_TAROT = APP_TAROT;

})(typeof window !== 'undefined' ? window : this);