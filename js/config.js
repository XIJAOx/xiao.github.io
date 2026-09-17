/**
 * config.js
 * 全局配置中心
 * 依赖：无
 * 被依赖：几乎所有模块
 *
 * 说明：
 * 1. 本文件只放静态配置、常量、默认值，不放逻辑。
 * 2. 挂到 window.APP_CONFIG 上，方便普通 script 引用。
 * 3. 后续如果改用 ES Module，只需在文件末尾加 export default APP_CONFIG。
 */

(function (global) {
    'use strict';

    /* ============================================================
     * 1. 应用基本信息
     * ============================================================ */
    var APP_INFO = {
        name: '梦角',
        title: '小X',
        version: '0.1.0',
        author: '',
        description: '和梦角一起的日常记录 App'
    };

    /* ============================================================
     * 2. localStorage 存储键名
     *    统一前缀，避免和其他项目冲突
     * ============================================================ */
    var STORAGE_PREFIX = 'mengjiao_';

    var STORAGE_KEYS = {
        // 全局状态
        STATE: STORAGE_PREFIX + 'state',
        SETTINGS: STORAGE_PREFIX + 'settings',
        THEME: STORAGE_PREFIX + 'theme',
        CONNECTION: STORAGE_PREFIX + 'connection',

        // 数据
        CHAT_LIST: STORAGE_PREFIX + 'chat_list',
        CHAT_RECORDS: STORAGE_PREFIX + 'chat_records',
        MESSAGES: STORAGE_PREFIX + 'messages',
        MOOD: STORAGE_PREFIX + 'mood',
        MOOD_HISTORY: STORAGE_PREFIX + 'mood_history',

        // 信件
        LETTERS_SENT: STORAGE_PREFIX + 'letters_sent',
        LETTERS_RECEIVED: STORAGE_PREFIX + 'letters_received',
        LETTERS_TIME: STORAGE_PREFIX + 'letters_time',

        // 朋友圈
        MOMENTS: STORAGE_PREFIX + 'moments',
        MOMENTS_VISITS: STORAGE_PREFIX + 'moments_visits',
        MOMENTS_BG: STORAGE_PREFIX + 'moments_bg',

        // 经期
        PERIOD_RECORDS: STORAGE_PREFIX + 'period_records',
        PERIOD_SETTINGS: STORAGE_PREFIX + 'period_settings',

        // 喝水
        WATER_RECORDS: STORAGE_PREFIX + 'water_records',
        WATER_SETTINGS: STORAGE_PREFIX + 'water_settings',
        WATER_WORDCARDS: STORAGE_PREFIX + 'water_wordcards',

        // 收藏
        FAVORITES: STORAGE_PREFIX + 'favorites',

        // 音乐
        MUSIC_LIBRARY: STORAGE_PREFIX + 'music_library',
        MUSIC_PLAYLISTS: STORAGE_PREFIX + 'music_playlists',

        // 提问
        QUESTIONS: STORAGE_PREFIX + 'questions',

        // 占卜
        DIVINATION_RECORDS: STORAGE_PREFIX + 'divination_records',

        // 纪念日
        ANNIVERSARIES: STORAGE_PREFIX + 'anniversaries',

        // 字卡
        WORDCARDS: STORAGE_PREFIX + 'wordcards',

        // 商城
        SHOP_GOODS: STORAGE_PREFIX + 'shop_goods',
        CART: STORAGE_PREFIX + 'cart',
        ORDERS: STORAGE_PREFIX + 'orders',
        BALANCE: STORAGE_PREFIX + 'balance',

        // 通话
        CALL_RECORDS: STORAGE_PREFIX + 'call_records',

        // 群聊
        GROUP_CHATS: STORAGE_PREFIX + 'group_chats',

        // 备份
        BACKUP_LAST_TIME: STORAGE_PREFIX + 'backup_last_time'
    };

    /* ============================================================
     * 3. 页面列表
     *    和 HTML 里的 data-page 一一对应
     * ============================================================ */
    var PAGES = {
        HOME_FIRST: 'homeFirst',
        HOME_SECOND: 'homeSecond',
        CHAT_LIST: 'chatList',
        CHAT_ROOM: 'chatRoom',
        CHAT_INFO: 'chatInfo',
        LETTER: 'letterPage',
        MOMENTS: 'momentsPage',
        PERIOD: 'periodPage',
        MESSAGE_RECORD: 'messageRecordPage',
        DIVINATION: 'divinationPage',
        FAVORITE: 'favoritePage',
        MUSIC: 'musicPage',
        QUESTION: 'questionPage',
        WATER: 'waterPage',
        SETTING: 'settingPage',
        SHOP: 'shopPage',
        CART: 'cartPage',
        ORDER: 'orderPage'
    };

    // 页面数组形式，方便遍历和校验
    var PAGE_LIST = [
        PAGES.HOME_FIRST,
        PAGES.HOME_SECOND,
        PAGES.CHAT_LIST,
        PAGES.CHAT_ROOM,
        PAGES.CHAT_INFO,
        PAGES.LETTER,
        PAGES.MOMENTS,
        PAGES.PERIOD,
        PAGES.MESSAGE_RECORD,
        PAGES.DIVINATION,
        PAGES.FAVORITE,
        PAGES.MUSIC,
        PAGES.QUESTION,
        PAGES.WATER,
        PAGES.SETTING,
        PAGES.SHOP,
        PAGES.CART,
        PAGES.ORDER
    ];

    // 默认启动页
    var DEFAULT_PAGE = PAGES.HOME_FIRST;

    /* ============================================================
     * 4. 弹窗列表
     *   4.1 有 data-popup 属性的
     *   4.2 只有类名的（JS 用类名匹配）
     * ============================================================ */

    // 4.1 有 data-popup
    var POPUPS = {
        CALL_OUT: 'callOut',
        CALL_IN: 'callIn',
        CREATE_GROUP: 'createGroup',
        CHAT_DATA: 'chatData',
        READ_TIME_SETTING: 'readTimeSetting',
        AVATAR_SETTING: 'avatarSetting',
        TEXT_SETTING: 'textSetting',
        BUBBLE_SETTING: 'bubbleSetting',
        BG_SETTING: 'bgSetting',
        ANNIVERSARY: 'anniversary'
    };

    var POPUP_LIST = [
        POPUPS.CALL_OUT,
        POPUPS.CALL_IN,
        POPUPS.CREATE_GROUP,
        POPUPS.CHAT_DATA,
        POPUPS.READ_TIME_SETTING,
        POPUPS.AVATAR_SETTING,
        POPUPS.TEXT_SETTING,
        POPUPS.BUBBLE_SETTING,
        POPUPS.BG_SETTING,
        POPUPS.ANNIVERSARY
    ];

    // 4.2 只有类名的弹窗
    //     key = 业务名，value = 该弹窗根元素的 class 选择器
    var POPUP_CLASS = {
        // 朋友圈
        PUBLISH_MOMENT: '.popup-publish-moment',
        MOMENTS_VISIT: '.popup-moments-visit',

        // 音乐
        ADD_MUSIC: '.popup-add-music',
        MANAGE_PLAYLIST: '.popup-manage-playlist',
        LISTEN_TOGETHER: '.popup-listen-together',

        // 提问
        NEW_QUESTION: '.popup-new-question',

        // 喝水
        SET_WATER_GOAL: '.popup-set-water-goal',
        SET_ONCE_VOLUME: '.popup-set-once-volume',
        ADD_WATER_WORDCARD: '.popup-add-water-wordcard',

        // 商城
        WISH_GOODS: '.popup-wish-goods',

        // 设置页内弹窗
        WORDCARD_LIB: '.popup-wordcard-lib',
        REPLY_SETTING: '.popup-reply-setting',
        LETTER_SETTING: '.popup-letter-setting',
        MOMENTS_SETTING: '.popup-moments-setting',
        DARK_MODE: '.popup-dark-mode',
        NOTIFY_SETTING: '.popup-notify-setting',
        DATA_SETTING: '.popup-data-setting',
        STORAGE_SETTING: '.popup-storage-setting',
        CHAT_SEND_SETTING: '.popup-chat-send-setting'
    };

    /* ============================================================
     * 5. 悬浮窗
     * ============================================================ */
    var FLOATS = {
        CALL_MINI: 'callMini'
    };

    /* ============================================================
     * 6. 选择器常量
     *    避免 JS 里到处写魔法字符串
     * ============================================================ */
    var SELECTORS = {
        // 容器
        ALL_PAGES_WRAP: '.all-pages-wrap',
        GLOBAL_HEADER: '.app-global-header',

        // 页面
        PAGE: '.page',
        PAGE_ACTIVE: '.page.active',
        PAGE_BY_DATA: function (pageName) {
            return '.page[data-page="' + pageName + '"]';
        },

        // 弹窗
        POPUP: '.popup',
        POPUP_ACTIVE: '.popup.active',
        POPUP_BY_DATA: function (popupName) {
            return '.popup[data-popup="' + popupName + '"]';
        },

        // 悬浮窗
        FLOAT_WINDOW: '.float-window',
        FLOAT_WINDOW_ACTIVE: '.float-window.active',

        // 通用按钮
        BTN_BACK: '.btn-back',
        BTN_POPUP_CLOSE: '.btn-popup-close',
        BTN_POPUP_CANCEL: '.btn-popup-cancel',
        BTN_POPUP_CONFIRM: '.btn-popup-confirm',
        BTN_POPUP_SAVE: '.btn-popup-save',

        // 触发跳转
        DATA_TARGET_PAGE: '[data-target-page]',
        DATA_TARGET_POPUP: '[data-target-popup]',

        // 开关
        SWITCH_TOGGLE: '.switch-toggle',
        SWITCH_TOGGLE_ON: '.switch-toggle.on',

        // Tab 通用
        TAB_BTN: '.tab-btn',
        TAB_BTN_ACTIVE: '.tab-btn.active',
        TAB_CONTENT: '.tab-content',
        TAB_CONTENT_ACTIVE: '.tab-content.active',

        // 连接状态
        CONNECTION_HEARTS: '#connectionHearts',
        CONN_HEART: '.conn-heart',
        CONN_HEART_FILLED: '.conn-heart.filled',

        // 聊天
        CHAT_LIST_CONTAINER: '.chat-list-container',
        CHAT_LIST_ITEM: '.chat-list-item',
        MESSAGE_LIST: '.message-list',
        EMPTY_CHAT_TIP: '.empty-chat-tip',
        MSG_INPUT: '.msg-input',
        BTN_EMOJI: '.btn-emoji',
        BTN_ADD_MORE: '.btn-add-more',
        BTN_SEND_MSG: '.btn-send-msg',

        // 首页
        BTN_CHECKIN: '.btn-checkin',
        CHECKIN_COUNT: '.checkin-count',
        CARD_CONTENT: '.card-content',
        CARD_PLACEHOLDER: '.card-placeholder',

        // 商城
        SHOP_GOODS_GRID: '.shop-goods-grid',
        GOODS_ITEM: '.goods-item',
        BTN_ADD_CART: '.btn-add-cart',
        CART_LIST_WRAP: '.cart-list-wrap',
        ORDER_LIST_WRAP: '.order-list-wrap',
        BALANCE_INPUT: '.balance-input'
    };

    /* ============================================================
     * 7. 事件名常量
     *    用于 core.js 的事件总线
     * ============================================================ */
    var EVENTS = {
        // 页面
        PAGE_CHANGE: 'page:change',
        PAGE_BEFORE_CHANGE: 'page:beforeChange',
        PAGE_AFTER_CHANGE: 'page:afterChange',

        // 弹窗
        POPUP_OPEN: 'popup:open',
        POPUP_CLOSE: 'popup:close',

        // 数据
        DATA_CHANGE: 'data:change',
        STATE_CHANGE: 'state:change',

        // 聊天
        MESSAGE_SEND: 'message:send',
        MESSAGE_RECEIVE: 'message:receive',
        MESSAGE_RENDER: 'message:render',

        // 通话
        CALL_OUT_START: 'call:out:start',
        CALL_IN_START: 'call:in:start',
        CALL_ACCEPT: 'call:accept',
        CALL_REJECT: 'call:reject',
        CALL_END: 'call:end',

        // 情绪
        MOOD_CHANGE: 'mood:change',

        // 主题
        THEME_CHANGE: 'theme:change',

        // 连接状态
        CONNECTION_CHANGE: 'connection:change',

        // 商城
        CART_CHANGE: 'cart:change',
        ORDER_CREATE: 'order:create',
        BALANCE_CHANGE: 'balance:change',

        // 备份
        BACKUP_START: 'backup:start',
        BACKUP_DONE: 'backup:done',

        // 新手引导
        ONBOARDING_START: 'onboarding:start',
        ONBOARDING_DONE: 'onboarding:done'
    };

    /* ============================================================
     * 8. 默认设置
     * ============================================================ */
    var DEFAULT_SETTINGS = {
        // 回复设置
        reply: {
            minDelay: 1,          // 秒
            maxDelay: 10,         // 秒
            minCount: 1,          // 条
            maxCount: 3,          // 条
            joinWordcard: false,  // 拼字卡
            readNoReply: false,   // 已读不回
            taProactive: false    // TA 主动发信息
        },

        // 信件设置
        letter: {
            minWriteTime: 5,      // 秒
            maxWriteTime: 30,     // 秒
            minWordcard: 1,       // 张
            maxWordcard: 5,       // 张
            taWriteProbability: 0.65  // 梦角写信概率
        },

        // 朋友圈设置
        moments: {
            minPostTime: 30,      // 秒
            maxPostTime: 120,     // 秒
            minWordcard: 1,       // 张
            maxWordcard: 3,       // 张
            visibleToAll: true,   // 让全部梦角看见
            allowMutualSee: true, // 允许 TA 们看见对方评论
            taPostProbability: 1.0,   // 梦角发朋友圈概率
            taLikeProbability: 0.5    // 梦角点赞评论概率
        },

        // 深色模式：'system' | 'dark' | 'light'
        darkMode: 'system',

        // 通知
        notify: {
            enabled: false,
            keepAlive: false
        },

        // 聊天
        chat: {
            showTimestamp: true,
            showReadStatus: false,
            bubbleSize: 14,
            bubbleRadius: 15,
            textSize: 14,
            avatarShape: 'circle',  // 'circle' | 'square'
            avatarSize: 38,
            bubbleColorSelf: '#000000',
            bubbleColorOther: '#ffffff',
            bgColor: '#ffffff',
            bgImage: '',
            sendMode: 'both' 
        },

        // 音乐
        music: {
            listenTogetherProbability: 0.15  // 一起听歌概率
        }
    };

    /* ============================================================
     * 9. 默认聊天对象（梦角）
     * ============================================================ */
    var DEFAULT_CHARACTERS = [
        {
            id: 'ta',
            name: 'TA',
            avatar: '',
            avatarBig: '',
            avatarSmall: '',
            remark: '',
            isDefault: true
        }
    ];

    /* ============================================================
     * 10. 默认用户（我）
     * ============================================================ */
    var DEFAULT_USER = {
        id: 'me',
        name: '我',
        avatar: '',
        avatarBig: '',
        avatarSmall: ''
    };

    /* ============================================================
     * 11. 情绪系统默认配置
     * ============================================================ */
    var DEFAULT_MOOD = {
        // 当前情绪
        current: 'calm',
        // 情绪强度 0~100
        intensity: 50,
        // 情绪列表
        list: {
            happy:    { name: '开心',   emoji: '😊', color: '#ffcc44' },
            calm:     { name: '平静',   emoji: '😌', color: '#88bbff' },
            sad:      { name: '难过',   emoji: '😢', color: '#7799cc' },
            angry:    { name: '生气',   emoji: '😠', color: '#ff6666' },
            shy:      { name: '害羞',   emoji: '😳', color: '#ff99bb' },
            miss:     { name: '想你',   emoji: '🥺', color: '#ff88aa' },
            excited:  { name: '兴奋',   emoji: '🤩', color: '#ffaa33' },
            tired:    { name: '疲惫',   emoji: '😴', color: '#aaaacc' }
        }
    };

    /* ============================================================
     * 12. 连接状态配置
     * ============================================================ */
    var CONNECTION = {
        min: 0,
        max: 6,
        default: 6,
        // 连接状态描述
        labels: {
            0: '未连接',
            1: '几乎断开',
            2: '连接很差',
            3: '连接较弱',
            4: '连接一般',
            5: '连接良好',
            6: '连接满格'
        }
    };

    /* ============================================================
     * 13. 喝水默认配置
     * ============================================================ */
    var DEFAULT_WATER = {
        dailyGoalCups: 8,
        cupVolume: 250,        // ml
        onceVolume: 250,       // 单次增加 ml
        todayCups: 0,
        todayMl: 0,
        wordcards: ['别忘了喝水'],
        currentWordcard: '别忘了喝水'
    };

    /* ============================================================
     * 14. 经期默认配置
     * ============================================================ */
    var DEFAULT_PERIOD = {
        cycleLength: 28,       // 平均周期天数
        periodLength: 5,       // 经期天数
        records: [],
        symptoms: {}
    };

    /* ============================================================
     * 15. 商城默认配置
     * ============================================================ */
    var DEFAULT_SHOP = {
        balance: 520.00,
        currency: '¥',
        categories: {
            recommend: '推荐',
            takeaway: '外卖'
        }
    };

    /* ============================================================
     * 16. 商城默认商品（首次进入时写入）
     * ============================================================ */
    var DEFAULT_SHOP_GOODS = {
        recommend: [
            {
                id: 'g_001',
                name: '纯棉白衬衫',
                icon: '👔',
                desc: '100%新疆长绒棉, 亲肤透气, 商务休闲两相宜',
                tags: ['衣物', '新品'],
                price: 129
            },
            {
                id: 'g_002',
                name: '连帽卫衣',
                icon: '🧥',
                desc: '加绒加厚, 宽松版型, 秋冬必备。情侣款可配对穿',
                tags: ['衣物', '热销'],
                price: 169
            },
            {
                id: 'g_003',
                name: '真丝睡裙',
                icon: '👗',
                desc: '100%桑蚕丝, 亲肤丝滑, 蕾丝拼接设计',
                tags: ['衣物', '性感'],
                price: 259
            },
            {
                id: 'g_004',
                name: '情侣拖鞋',
                icon: '🩴',
                desc: 'EVA材质, 防滑耐磨, 可定制刺绣',
                tags: ['衣物', '情侣'],
                price: 49
            }
        ],
        takeaway: [
            {
                id: 'g_101',
                name: '芋泥波波奶茶',
                icon: '🧋',
                desc: '手工芋泥+黑糖珍珠, 大杯700ml',
                tags: ['奶茶', '人气'],
                price: 18
            },
            {
                id: 'g_102',
                name: '杨枝甘露',
                icon: '🥭',
                desc: '新鲜芒果+西柚+椰浆, 清爽解腻',
                tags: ['奶茶', '新品'],
                price: 22
            },
            {
                id: 'g_103',
                name: '生椰拿铁',
                icon: '☕',
                desc: '现萃咖啡+厚椰乳, 丝滑香浓',
                tags: ['奶茶', '热销'],
                price: 20
            },
            {
                id: 'g_104',
                name: '百香果柠檬茶',
                icon: '🍋',
                desc: '新鲜百香果+手捣柠檬, 酸甜开胃',
                tags: ['奶茶', '清爽'],
                price: 16
            }
        ]
    };

    /* ============================================================
     * 17. 字卡默认配置
     * ============================================================ */
    var DEFAULT_WORDCARDS = {
        main: [],       // 主字卡
        kaomoji: [],    // 颜文字
        emoji: [],      // Emoji
        sticker: [],    // 表情库
        voice: []       // 语音
    };

    /* ============================================================
     * 18. 主题默认配置
     * ============================================================ */
    var DEFAULT_THEME = {
        // 深色模式：'system' | 'dark' | 'light'
        mode: 'system',
        // 气泡颜色
        bubbleSelf: '#000000',
        bubbleOther: '#ffffff',
        // 聊天背景
        chatBg: '#ffffff',
        chatBgImage: '',
        // 文字大小
        textSize: 14,
        // 头像
        avatarShape: 'circle',
        avatarSize: 38
    };

    /* ============================================================
     * 19. 通话默认配置
     * ============================================================ */
    var DEFAULT_CALL = {
        // 来电未接自动挂断倒计时（秒）
        incomingTimeout: 15,
        // 通话记录最多保存条数
        maxRecords: 100
    };

    /* ============================================================
     * 20. 备份默认配置
     * ============================================================ */
    var DEFAULT_BACKUP = {
        // 自动备份间隔（毫秒），0 表示不自动
        autoInterval: 0,
        // 最多保留备份数
        maxBackups: 10
    };

    /* ============================================================
     * 21. 新手引导默认配置
     * ============================================================ */
    var DEFAULT_ONBOARDING = {
        // 是否已完成新手引导
        done: false,
        // 引导步骤列表（后续扩展）
        steps: []
    };

    /* ============================================================
     * 22. 功能开关
     * ============================================================ */
    var FEATURES = {
        call: true,
        groupChat: true,
        mood: true,
        letter: true,
        moments: true,
        period: true,
        water: true,
        music: true,
        question: true,
        divination: true,
        favorite: true,
        shop: true,
        game: false,        // game.js 预留
        backup: true,
        themeEditor: true,
        onboarding: true
    };

    /* ============================================================
     * 23. 常量
     * ============================================================ */
    var CONSTANTS = {
        // 时间
        SECOND: 1000,
        MINUTE: 60 * 1000,
        HOUR: 60 * 60 * 1000,
        DAY: 24 * 60 * 60 * 1000,

        // 分页
        PAGE_SIZE: 20,

        // 输入限制
        MAX_INPUT_LENGTH: 2000,

        // 头像默认占位
        DEFAULT_AVATAR: ''
    };

    /* ============================================================
     * 24. 汇总导出
     * ============================================================ */
    var APP_CONFIG = {
        APP_INFO: APP_INFO,
        STORAGE_PREFIX: STORAGE_PREFIX,
        STORAGE_KEYS: STORAGE_KEYS,
        PAGES: PAGES,
        PAGE_LIST: PAGE_LIST,
        DEFAULT_PAGE: DEFAULT_PAGE,
        POPUPS: POPUPS,
        POPUP_LIST: POPUP_LIST,
        POPUP_CLASS: POPUP_CLASS,
        FLOATS: FLOATS,
        SELECTORS: SELECTORS,
        EVENTS: EVENTS,
        DEFAULT_SETTINGS: DEFAULT_SETTINGS,
        DEFAULT_CHARACTERS: DEFAULT_CHARACTERS,
        DEFAULT_USER: DEFAULT_USER,
        DEFAULT_MOOD: DEFAULT_MOOD,
        CONNECTION: CONNECTION,
        DEFAULT_WATER: DEFAULT_WATER,
        DEFAULT_PERIOD: DEFAULT_PERIOD,
        DEFAULT_SHOP: DEFAULT_SHOP,
        DEFAULT_SHOP_GOODS: DEFAULT_SHOP_GOODS,
        DEFAULT_WORDCARDS: DEFAULT_WORDCARDS,
        DEFAULT_THEME: DEFAULT_THEME,
        DEFAULT_CALL: DEFAULT_CALL,
        DEFAULT_BACKUP: DEFAULT_BACKUP,
        DEFAULT_ONBOARDING: DEFAULT_ONBOARDING,
        FEATURES: FEATURES,
        CONSTANTS: CONSTANTS
    };

    // 挂到全局
    global.APP_CONFIG = APP_CONFIG;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_CONFIG;

})(typeof window !== 'undefined' ? window : this);