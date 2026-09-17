/**
 * sticker-manager.js
 * 表情库 + 语音管理
 * 依赖：config / utils / data / core / envelope / image-handler
 * 被依赖：listeners.js / wordcard-lib.js
 *
 * 功能：
 * 1. 表情包：上传图片 → 压缩 → 存 base64 → 在列表显示缩略图
 * 2. 语音：输入文字 + 可选 TTS 播放 / 也支持上传音频文件
 * 3. 和 wordcard-lib 联动，都在同一个弹窗里
 *
 * 挂到 window.APP_STICKER 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var DATA = global.APP_DATA || {};
    var CORE = global.APP_CORE || {};
    var ENV = global.APP_ENVELOPE || {};
    var IMG = global.APP_IMG || {};

    var Str = UTILS.Str;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }
    function $(s, p) { return (p || document).querySelector(s); }

    /* ============================================================
     * 1. 表情包管理
     * ============================================================ */
    var Sticker = {
        /**
         * 上传表情包图片
         * 压缩到 300×300 以内，转 base64
         */
        upload: function () {
            var handler = IMG.pickAndCompress || IMG.pick;
            if (!handler) {
                if (ENV.tip) ENV.tip('图片模块未加载');
                return;
            }

            IMG.pickAndCompress({
                maxWidth: 300,
                maxHeight: 300,
                quality: 0.85,
                format: 'image/png'
            }).then(function (dataUrl) {
                // 存进字卡库
                DATA.Wordcard.add('sticker', {
                    text: dataUrl,
                    isImage: true,
                    createdAt: Date.now()
                });
                if (ENV.tip) ENV.tip('表情已添加');

                // 触发重渲染
                _refreshLib();
            }).catch(function (err) {
                if (err && err.message === '未选择文件') return;
                Log.error('[sticker] 上传失败:', err);
                if (ENV.tip) ENV.tip('上传失败');
            });
        },

        /**
         * 从 URL 添加表情
         */
        addFromUrl: function (url) {
            if (!url) {
                if (ENV.tip) ENV.tip('请输入图片链接');
                return false;
            }
            DATA.Wordcard.add('sticker', {
                text: url,
                isImage: true,
                createdAt: Date.now()
            });
            if (ENV.tip) ENV.tip('表情已添加');
            _refreshLib();
            return true;
        },

        /**
         * 删除表情
         */
        remove: function (id) {
            DATA.Wordcard.remove('sticker', id);
            if (ENV.tip) ENV.tip('已删除');
            _refreshLib();
        },

        /**
         * 批量删除
         */
        removeMany: function (ids) {
            (ids || []).forEach(function (id) {
                DATA.Wordcard.remove('sticker', id);
            });
            if (ENV.tip) ENV.tip('已删除 ' + ids.length + ' 项');
            _refreshLib();
        },

        /**
         * 获取所有表情
         */
        list: function () {
            return DATA.Wordcard.getByType('sticker');
        }
    };

    /* ============================================================
     * 2. 语音管理
     * ============================================================ */
    var Voice = {
        /**
         * 上传语音文件（音频）
         */
        uploadAudio: function () {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = function () {
                var file = input.files[0];
                if (!file) return;

                // 限制大小 5MB
                if (file.size > 5 * 1024 * 1024) {
                    if (ENV.tip) ENV.tip('音频文件不能超过 5MB');
                    return;
                }

                var reader = new FileReader();
                reader.onload = function (e) {
                    var dataUrl = e.target.result;
                    var name = prompt('给这段语音起个名字：', file.name.replace(/\.[^.]+$/, ''));
                    if (!name) return;

                    DATA.Wordcard.add('voice', {
                        text: name,
                        audio: dataUrl,
                        isAudio: true,
                        createdAt: Date.now()
                    });
                    if (ENV.tip) ENV.tip('语音已添加');
                    _refreshLib();
                };
                reader.readAsDataURL(file);
            };
            input.click();
        },

        /**
         * 添加文字语音（TTS 用）
         */
        addText: function (text) {
            if (!text || !text.trim()) {
                if (ENV.tip) ENV.tip('内容不能为空');
                return false;
            }
            DATA.Wordcard.add('voice', {
                text: text.trim(),
                isTTS: true,
                createdAt: Date.now()
            });
            if (ENV.tip) ENV.tip('已添加');
            _refreshLib();
            return true;
        },

        /**
         * 播放语音
         * - 有 audio → 播放音频
         * - 没有 → 用 TTS 朗读文字
         */
        play: function (id) {
            var list = DATA.Wordcard.getByType('voice');
            var item = null;
            for (var i = 0; i < list.length; i++) {
                if ((list[i].id || list[i]) === id) {
                    item = list[i];
                    break;
                }
            }
            if (!item) {
                if (ENV.tip) ENV.tip('找不到语音');
                return;
            }

            // 有音频文件
            if (item.audio) {
                var audio = new Audio(item.audio);
                audio.play().catch(function (err) {
                    Log.error('[voice] 播放失败:', err);
                    if (ENV.tip) ENV.tip('播放失败');
                });
                return;
            }

            // TTS
            _tts(item.text);
        },

        /**
         * 用浏览器 TTS 朗读
         */
        speak: function (text) {
            _tts(text);
        },

        /**
         * 删除语音
         */
        remove: function (id) {
            DATA.Wordcard.remove('voice', id);
            if (ENV.tip) ENV.tip('已删除');
            _refreshLib();
        },

        list: function () {
            return DATA.Wordcard.getByType('voice');
        },

        /**
         * 是否支持 TTS
         */
        isTTSSupported: function () {
            return 'speechSynthesis' in window;
        }
    };

    /* ============================================================
     * 3. TTS 朗读
     * ============================================================ */
    function _tts(text) {
        if (!text) return;
        if (!('speechSynthesis' in window)) {
            if (ENV.tip) ENV.tip('当前浏览器不支持语音朗读');
            return;
        }

        try {
            // 停止之前的朗读
            window.speechSynthesis.cancel();

            var utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 0.9;

            // 选择中文语音（如果有）
            var voices = window.speechSynthesis.getVoices();
            var zhVoice = voices.filter(function (v) {
                return v.lang && v.lang.indexOf('zh') === 0;
            })[0];
            if (zhVoice) utterance.voice = zhVoice;

            utterance.onerror = function (e) {
                Log.warn('[voice] TTS 出错:', e);
            };

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            Log.error('[voice] TTS 异常:', e);
        }
    }

    /* ============================================================
     * 4. 刷新字卡库弹窗
     * ============================================================ */
    function _refreshLib() {
        var LIB = global.APP_WORDCARD_LIB;
        if (LIB && LIB.render) {
            LIB.render();
        }
    }

    /* ============================================================
     * 5. 和消息发送联动
     * ============================================================ */

    /**
     * 把表情发到聊天
     * @param {string} id 表情 id
     */
    function sendStickerToChat(id) {
        var list = DATA.Wordcard.getByType('sticker');
        var item = null;
        for (var i = 0; i < list.length; i++) {
            if ((list[i].id || list[i]) === id) {
                item = list[i];
                break;
            }
        }
        if (!item) return;

        var chatId = (global.APP_STATE && global.APP_STATE.get('currentChatId')) || 'ta';
        DATA.Chat.addMessage(chatId, {
            from: 'me',
            text: '',
            type: 'image',
            image: item.text
        });

        // 如果在聊天室就刷新
        var page = global.APP_STATE && global.APP_STATE.Page && global.APP_STATE.Page.current();
        if (page === 'chatRoom' && global.APP_FEATURES && global.APP_FEATURES.Chat) {
            global.APP_FEATURES.Chat.renderRoom();
        }
    }

    /**
     * 把语音发到聊天
     */
    function sendVoiceToChat(id) {
        var list = DATA.Wordcard.getByType('voice');
        var item = null;
        for (var i = 0; i < list.length; i++) {
            if ((list[i].id || list[i]) === id) {
                item = list[i];
                break;
            }
        }
        if (!item) return;

        var chatId = (global.APP_STATE && global.APP_STATE.get('currentChatId')) || 'ta';
        DATA.Chat.addMessage(chatId, {
            from: 'me',
            text: '🎤 ' + (item.text || '语音'),
            type: 'voice',
            audio: item.audio || null
        });

        var page = global.APP_STATE && global.APP_STATE.Page && global.APP_STATE.Page.current();
        if (page === 'chatRoom' && global.APP_FEATURES && global.APP_FEATURES.Chat) {
            global.APP_FEATURES.Chat.renderRoom();
        }
    }

    /* ============================================================
     * 6. 首次进入给几个默认表情和语音
     * ============================================================ */
    function _initDefaults() {
        var stickers = DATA.Wordcard.getByType('sticker');
        var voices = DATA.Wordcard.getByType('voice');

        // 默认语音（文字版，可用 TTS 播放）
        if (!voices || voices.length === 0) {
            var defaultVoices = ['晚安', '早安', '想你', '抱抱', '晚安好梦'];
            defaultVoices.forEach(function (t) {
                DATA.Wordcard.add('voice', { text: t, isTTS: true });
            });
        }

        // 表情库如果空就不填，等用户上传
    }

    /* ============================================================
     * 7. 初始化
     * ============================================================ */
    function init() {
        _initDefaults();

        // 预加载 TTS 语音列表
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            // 有些浏览器需要等一等
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = function () {
                    window.speechSynthesis.getVoices();
                };
            }
        }

        Log.log('[sticker] 初始化完成，表情:', Sticker.list().length, '语音:', Voice.list().length);
    }

    /* ============================================================
     * 8. 对外导出
     * ============================================================ */
    var APP_STICKER = {
        init: init,

        // 表情
        Sticker: Sticker,
        uploadSticker: Sticker.upload,
        addStickerFromUrl: Sticker.addFromUrl,
        removeSticker: Sticker.remove,
        listStickers: Sticker.list,

        // 语音
        Voice: Voice,
        uploadVoice: Voice.uploadAudio,
        addVoiceText: Voice.addText,
        playVoice: Voice.play,
        speak: Voice.speak,
        removeVoice: Voice.remove,
        listVoices: Voice.list,
        isTTSSupported: Voice.isTTSSupported,

        // 发送
        sendStickerToChat: sendStickerToChat,
        sendVoiceToChat: sendVoiceToChat
    };

    global.APP_STICKER = APP_STICKER;

})(typeof window !== 'undefined' ? window : this);