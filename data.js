/**
 * data.js
 * 数据存储层：所有业务数据的读写都在这里
 * 依赖：config.js / utils.js / state.js / core.js
 * 被依赖：features.js / call.js / mood.js / listeners.js 等
 *
 * 说明：
 * 1. 上层只调 data.xxx，不直接碰 localStorage。
 * 2. 每个模块提供 列表 / 新增 / 更新 / 删除 / 清空 统一接口。
 * 3. 写操作会自动触发 core.emit('data:change', {...})。
 * 4. 挂到 window.APP_DATA 上。
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};

    var Store = UTILS.Store;
    var Obj = UTILS.Obj;
    var Time = UTILS.Time;
    var Str = UTILS.Str;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var KEYS = CONFIG.STORAGE_KEYS || {};
    var DEFAULT_SETTINGS = CONFIG.DEFAULT_SETTINGS || {};
    var DEFAULT_CHARACTERS = CONFIG.DEFAULT_CHARACTERS || [];
    var DEFAULT_USER = CONFIG.DEFAULT_USER || {};
    var DEFAULT_WATER = CONFIG.DEFAULT_WATER || {};
    var DEFAULT_PERIOD = CONFIG.DEFAULT_PERIOD || {};
    var DEFAULT_SHOP = CONFIG.DEFAULT_SHOP || {};
    var DEFAULT_SHOP_GOODS = CONFIG.DEFAULT_SHOP_GOODS || {};
    var DEFAULT_WORDCARDS = CONFIG.DEFAULT_WORDCARDS || {};
    var DEFAULT_THEME = CONFIG.DEFAULT_THEME || {};
    var DEFAULT_MOOD = CONFIG.DEFAULT_MOOD || {};

    /* ============================================================
     * 0. 内部工具
     * ============================================================ */

    // 统一的变更通知
    function _notify(module, action, payload) {
        if (CORE.emit) {
            CORE.emit('data:change', {
                module: module,
                action: action,
                payload: payload
            });
            CORE.emit('data:' + module + ':' + action, payload);
        }
    }

    // 读取 + 默认值
    function _read(key, defaultValue) {
        var v = Store.get(key);
        if (v === null || v === undefined) {
            return Obj.deepClone(defaultValue);
        }
        return v;
    }

    // 写入
    function _write(key, value) {
        return Store.set(key, value);
    }

    /* ============================================================
     * 1. 用户 & 角色
     * ============================================================ */
    var User = {
        get: function () {
            return _read(KEYS.USER || 'user', DEFAULT_USER);
        },
        save: function (user) {
            _write(KEYS.USER || 'user', user);
            _notify('user', 'update', user);
        },
        patch: function (patch) {
            var u = this.get();
            Obj.assign(u, patch);
            this.save(u);
            return u;
        },
        reset: function () {
            _write(KEYS.USER || 'user', DEFAULT_USER);
        }
    };

    var Character = {
        // 全部角色
        list: function () {
            return _read(KEYS.CHARACTERS || 'characters', DEFAULT_CHARACTERS);
        },
        saveAll: function (list) {
            _write(KEYS.CHARACTERS || 'characters', list);
            _notify('character', 'list', list);
        },
        get: function (id) {
            return Obj.findById(this.list(), id);
        },
        add: function (char) {
            var list = this.list();
            if (!char.id) char.id = Str.uid('char');
            list.push(char);
            this.saveAll(list);
            _notify('character', 'add', char);
            return char;
        },
        update: function (id, patch) {
            var list = this.list();
            var item = Obj.updateById(list, id, patch);
            if (item) {
                this.saveAll(list);
                _notify('character', 'update', item);
            }
            return item;
        },
        remove: function (id) {
            var list = this.list();
            Obj.removeById(list, id);
            this.saveAll(list);
            _notify('character', 'remove', { id: id });
        }
    };

    /* ============================================================
     * 2. 设置
     * ============================================================ */
    var Settings = {
        get: function () {
            var saved = _read(KEYS.SETTINGS || 'settings', {});
            return Obj.deepMerge(Obj.deepClone(DEFAULT_SETTINGS), saved);
        },
        getOne: function (path) {
            // path 支持 'reply.minDelay'
            var s = this.get();
            var keys = String(path).split('.');
            var cur = s;
            for (var i = 0; i < keys.length; i++) {
                if (cur == null) return undefined;
                cur = cur[keys[i]];
            }
            return cur;
        },
        save: function (settings) {
            _write(KEYS.SETTINGS || 'settings', settings);
            _notify('settings', 'update', settings);
        },
        patch: function (patch) {
            var s = this.get();
            Obj.deepMerge(s, patch);
            this.save(s);
            return s;
        },
        setOne: function (path, value) {
            var s = this.get();
            var keys = String(path).split('.');
            var cur = s;
            for (var i = 0; i < keys.length - 1; i++) {
                if (!cur[keys[i]]) cur[keys[i]] = {};
                cur = cur[keys[i]];
            }
            cur[keys[keys.length - 1]] = value;
            this.save(s);
        },
        reset: function () {
            _write(KEYS.SETTINGS || 'settings', DEFAULT_SETTINGS);
            _notify('settings', 'reset', DEFAULT_SETTINGS);
        }
    };

    /* ============================================================
     * 3. 主题
     * ============================================================ */
    var Theme = {
        get: function () {
            var saved = _read(KEYS.THEME || 'theme', {});
            return Obj.deepMerge(Obj.deepClone(DEFAULT_THEME), saved);
        },
        save: function (theme) {
            _write(KEYS.THEME || 'theme', theme);
            _notify('theme', 'update', theme);
        },
        patch: function (patch) {
            var t = this.get();
            Obj.assign(t, patch);
            this.save(t);
            return t;
        },
        reset: function () {
            _write(KEYS.THEME || 'theme', DEFAULT_THEME);
        }
    };

    /* ============================================================
     * 4. 聊天列表 & 消息
     * ============================================================ */
    var Chat = {
        // ---- 会话列表 ----
        listChats: function () {
            var list = _read(KEYS.CHAT_LIST || 'chat_list', null);
            if (list) return list;
            // 默认从角色生成
            var chars = Character.list();
            return chars.map(function (c) {
                return {
                    id: c.id,
                    name: c.name,
                    avatar: c.avatar,
                    lastMsg: '',
                    lastTime: 0,
                    unread: 0,
                    pinned: false,
                    muted: false
                };
            });
        },

        saveChats: function (list) {
            _write(KEYS.CHAT_LIST || 'chat_list', list);
            _notify('chatList', 'list', list);
        },

        getChat: function (id) {
            return Obj.findById(this.listChats(), id);
        },

        updateChat: function (id, patch) {
            var list = this.listChats();
            var item = Obj.updateById(list, id, patch);
            if (item) {
                this.saveChats(list);
                _notify('chatList', 'update', item);
            }
            return item;
        },

        // ---- 消息 ----
        // 存储结构：{ chatId: [msg, msg, ...] }
        allMessages: function () {
            return _read(KEYS.MESSAGES || 'messages', {});
        },

        saveAllMessages: function (map) {
            _write(KEYS.MESSAGES || 'messages', map);
        },

        // 取某个会话的消息
        getMessages: function (chatId) {
            if (!chatId) return [];
            var map = this.allMessages();
            return map[chatId] || [];
        },

        // 新增一条消息
        addMessage: function (chatId, msg) {
            if (!chatId || !msg) return null;
            var map = this.allMessages();
            if (!map[chatId]) map[chatId] = [];

            // 补齐字段
            msg.id = msg.id || Str.uid('msg');
            msg.chatId = chatId;
            msg.time = msg.time || Date.now();
            msg.type = msg.type || 'text';           // 'text' | 'image' | 'call' | 'voice' | 'system'
            msg.from = msg.from || 'me';             // 'me' | 角色id | 'system'
            msg.read = msg.read !== undefined ? msg.read : false;

            map[chatId].push(msg);

            // 单会话消息上限，避免 localStorage 爆掉
            if (map[chatId].length > 2000) {
                map[chatId] = map[chatId].slice(-2000);
            }

            this.saveAllMessages(map);

            // 更新会话摘要
            this.updateChat(chatId, {
                lastMsg: msg.text || msg.content || '',
                lastTime: msg.time
            });

            _notify('message', 'add', { chatId: chatId, msg: msg });
            return msg;
        },

        // 更新某条消息
        updateMessage: function (chatId, msgId, patch) {
            var map = this.allMessages();
            var list = map[chatId] || [];
            var item = Obj.updateById(list, msgId, patch);
            if (item) {
                this.saveAllMessages(map);
                _notify('message', 'update', { chatId: chatId, msg: item });
            }
            return item;
        },

        // 删除某条
        removeMessage: function (chatId, msgId) {
            var map = this.allMessages();
            var list = map[chatId] || [];
            Obj.removeById(list, msgId);
            this.saveAllMessages(map);
            _notify('message', 'remove', { chatId: chatId, msgId: msgId });
        },

        // 清空某会话
        clearMessages: function (chatId) {
            var map = this.allMessages();
            map[chatId] = [];
            this.saveAllMessages(map);
            _notify('message', 'clear', { chatId: chatId });
        },

        // 清空所有
        clearAllMessages: function () {
            _write(KEYS.MESSAGES || 'messages', {});
            _notify('message', 'clearAll', {});
        },

        // 标记已读
        markRead: function (chatId) {
            var map = this.allMessages();
            var list = map[chatId] || [];
            list.forEach(function (m) {
                if (m.from !== 'me') m.read = true;
            });
            this.saveAllMessages(map);
            this.updateChat(chatId, { unread: 0 });
            if (STATE.Unread) STATE.Unread.clear(chatId);
        },

        // 统计
        countMessages: function (chatId) {
            return this.getMessages(chatId).length;
        },

        countByFrom: function (chatId, from) {
            return this.getMessages(chatId).filter(function (m) {
                return m.from === from;
            }).length;
        }
    };

    /* ============================================================
     * 5. 字卡
     * ============================================================ */
    var Wordcard = {
        getAll: function () {
            var saved = _read(KEYS.WORDCARDS || 'wordcards', null);
            if (saved) return saved;
            return Obj.deepClone(DEFAULT_WORDCARDS);
        },
        saveAll: function (obj) {
            _write(KEYS.WORDCARDS || 'wordcards', obj);
            _notify('wordcard', 'list', obj);
        },
        // type: 'main' | 'kaomoji' | 'emoji' | 'sticker' | 'voice'
        getByType: function (type) {
            var all = this.getAll();
            return all[type] || [];
        },
        add: function (type, item) {
            var all = this.getAll();
            if (!all[type]) all[type] = [];
            if (!item.id) item.id = Str.uid('wc');
            item.createdAt = Date.now();
            all[type].push(item);
            this.saveAll(all);
            _notify('wordcard', 'add', { type: type, item: item });
            return item;
        },
        update: function (type, id, patch) {
            var all = this.getAll();
            var list = all[type] || [];
            var item = Obj.updateById(list, id, patch);
            if (item) {
                this.saveAll(all);
                _notify('wordcard', 'update', { type: type, item: item });
            }
            return item;
        },
        remove: function (type, id) {
            var all = this.getAll();
            var list = all[type] || [];
            Obj.removeById(list, id);
            this.saveAll(all);
            _notify('wordcard', 'remove', { type: type, id: id });
        },
        clear: function (type) {
            var all = this.getAll();
            if (type) {
                all[type] = [];
            } else {
                all = Obj.deepClone(DEFAULT_WORDCARDS);
            }
            this.saveAll(all);
        }
    };

    /* ============================================================
     * 6. 收藏
     * ============================================================ */
    var Favorite = {
        // type: 'mine' | 'ta'
        list: function (type) {
            var all = _read(KEYS.FAVORITES || 'favorites', { mine: [], ta: [] });
            if (type) return all[type] || [];
            return all;
        },
        saveAll: function (all) {
            _write(KEYS.FAVORITES || 'favorites', all);
            _notify('favorite', 'list', all);
        },
        add: function (type, item) {
            var all = this.list();
            if (!all[type]) all[type] = [];
            if (!item.id) item.id = Str.uid('fav');
            item.createdAt = Date.now();
            all[type].unshift(item);
            this.saveAll(all);
            _notify('favorite', 'add', { type: type, item: item });
            return item;
        },
        remove: function (type, id) {
            var all = this.list();
            var list = all[type] || [];
            Obj.removeById(list, id);
            this.saveAll(all);
            _notify('favorite', 'remove', { type: type, id: id });
        },
        removeMany: function (type, ids) {
            var all = this.list();
            var list = all[type] || [];
            all[type] = list.filter(function (it) {
                return ids.indexOf(it.id) === -1;
            });
            this.saveAll(all);
            _notify('favorite', 'removeMany', { type: type, ids: ids });
        },
        clear: function (type) {
            var all = this.list();
            if (type) {
                all[type] = [];
            } else {
                all = { mine: [], ta: [] };
            }
            this.saveAll(all);
        }
    };

    /* ============================================================
     * 7. 信件
     * ============================================================ */
    var Letter = {
        // 寄出的信
        listSent: function () {
            return _read(KEYS.LETTERS_SENT || 'letters_sent', []);
        },
        // 收到的信
        listReceived: function () {
            return _read(KEYS.LETTERS_RECEIVED || 'letters_received', []);
        },
        // 时空来信
        listTime: function () {
            return _read(KEYS.LETTERS_TIME || 'letters_time', []);
        },

        addSent: function (letter) {
            var list = this.listSent();
            letter.id = letter.id || Str.uid('letter');
            letter.createdAt = letter.createdAt || Date.now();
            letter.status = letter.status || 'sending'; // 'sending' | 'sent' | 'replied'
            list.unshift(letter);
            _write(KEYS.LETTERS_SENT || 'letters_sent', list);
            _notify('letter', 'addSent', letter);
            return letter;
        },
        addReceived: function (letter) {
            var list = this.listReceived();
            letter.id = letter.id || Str.uid('letter');
            letter.createdAt = letter.createdAt || Date.now();
            list.unshift(letter);
            _write(KEYS.LETTERS_RECEIVED || 'letters_received', list);
            _notify('letter', 'addReceived', letter);
            return letter;
        },
        addTime: function (letter) {
            var list = this.listTime();
            letter.id = letter.id || Str.uid('letter');
            letter.createdAt = letter.createdAt || Date.now();
            list.unshift(letter);
            _write(KEYS.LETTERS_TIME || 'letters_time', list);
            _notify('letter', 'addTime', letter);
            return letter;
        },

        updateSent: function (id, patch) {
            var list = this.listSent();
            var item = Obj.updateById(list, id, patch);
            if (item) {
                _write(KEYS.LETTERS_SENT || 'letters_sent', list);
                _notify('letter', 'updateSent', item);
            }
            return item;
        },
        remove: function (type, id) {
            var key, list;
            if (type === 'sent') { key = KEYS.LETTERS_SENT; list = this.listSent(); }
            else if (type === 'received') { key = KEYS.LETTERS_RECEIVED; list = this.listReceived(); }
            else { key = KEYS.LETTERS_TIME; list = this.listTime(); }

            Obj.removeById(list, id);
            _write(key, list);
            _notify('letter', 'remove', { type: type, id: id });
        }
    };

    /* ============================================================
     * 8. 朋友圈
     * ============================================================ */
    var Moments = {
        list: function () {
            return _read(KEYS.MOMENTS || 'moments', []);
        },
        saveAll: function (list) {
            _write(KEYS.MOMENTS || 'moments', list);
            _notify('moments', 'list', list);
        },
        add: function (post) {
            var list = this.list();
            post.id = post.id || Str.uid('moment');
            post.createdAt = post.createdAt || Date.now();
            post.likes = post.likes || [];
            post.comments = post.comments || [];
            list.unshift(post);
            this.saveAll(list);
            _notify('moments', 'add', post);
            return post;
        },
        get: function (id) {
            return Obj.findById(this.list(), id);
        },
        update: function (id, patch) {
            var list = this.list();
            var item = Obj.updateById(list, id, patch);
            if (item) {
                this.saveAll(list);
                _notify('moments', 'update', item);
            }
            return item;
        },
        remove: function (id) {
            var list = this.list();
            Obj.removeById(list, id);
            this.saveAll(list);
            _notify('moments', 'remove', { id: id });
        },

        // 点赞
        like: function (postId, userId) {
            var item = this.get(postId);
            if (!item) return;
            item.likes = item.likes || [];
            if (item.likes.indexOf(userId) === -1) {
                item.likes.push(userId);
                this.update(postId, { likes: item.likes });
            }
        },
        unlike: function (postId, userId) {
            var item = this.get(postId);
            if (!item) return;
            item.likes = (item.likes || []).filter(function (u) { return u !== userId; });
            this.update(postId, { likes: item.likes });
        },

        // 评论
        comment: function (postId, comment) {
            var item = this.get(postId);
            if (!item) return;
            item.comments = item.comments || [];
            comment.id = comment.id || Str.uid('cmt');
            comment.createdAt = comment.createdAt || Date.now();
            item.comments.push(comment);
            this.update(postId, { comments: item.comments });
            return comment;
        },

        // 访问记录
        listVisits: function () {
            return _read(KEYS.MOMENTS_VISITS || 'moments_visits', []);
        },
        addVisit: function (visit) {
            var list = this.listVisits();
            visit.id = visit.id || Str.uid('visit');
            visit.time = visit.time || Date.now();
            list.unshift(visit);
            if (list.length > 200) list = list.slice(0, 200);
            _write(KEYS.MOMENTS_VISITS || 'moments_visits', list);
            _notify('moments', 'visit', visit);
            return visit;
        },

        // 背景
        getBg: function () {
            return _read(KEYS.MOMENTS_BG || 'moments_bg', '');
        },
        setBg: function (bg) {
            _write(KEYS.MOMENTS_BG || 'moments_bg', bg);
            _notify('moments', 'bg', bg);
        }
    };

    /* ============================================================
     * 9. 经期
     * ============================================================ */
    var Period = {
        getSettings: function () {
            var saved = _read(KEYS.PERIOD_SETTINGS || 'period_settings', {});
            return Obj.deepMerge(Obj.deepClone(DEFAULT_PERIOD), saved);
        },
        saveSettings: function (s) {
            _write(KEYS.PERIOD_SETTINGS || 'period_settings', s);
            _notify('period', 'settings', s);
        },
        listRecords: function () {
            return _read(KEYS.PERIOD_RECORDS || 'period_records', []);
        },
        saveRecords: function (list) {
            _write(KEYS.PERIOD_RECORDS || 'period_records', list);
            _notify('period', 'records', list);
        },
        addRecord: function (record) {
            var list = this.listRecords();
            record.id = record.id || Str.uid('period');
            record.createdAt = record.createdAt || Date.now();
            list.unshift(record);
            this.saveRecords(list);
            return record;
        },
        updateRecord: function (id, patch) {
            var list = this.listRecords();
            var item = Obj.updateById(list, id, patch);
            if (item) this.saveRecords(list);
            return item;
        },
        removeRecord: function (id) {
            var list = this.listRecords();
            Obj.removeById(list, id);
            this.saveRecords(list);
        },
        // 某天是否有症状
        setSymptom: function (date, symptoms) {
            var s = this.getSettings();
            s.symptoms = s.symptoms || {};
            s.symptoms[date] = symptoms;
            this.saveSettings(s);
        },
        getSymptom: function (date) {
            var s = this.getSettings();
            return (s.symptoms && s.symptoms[date]) || null;
        }
    };

    /* ============================================================
     * 10. 喝水
     * ============================================================ */
    var Water = {
        getSettings: function () {
            var saved = _read(KEYS.WATER_SETTINGS || 'water_settings', {});
            return Obj.deepMerge(Obj.deepClone(DEFAULT_WATER), saved);
        },
        saveSettings: function (s) {
            _write(KEYS.WATER_SETTINGS || 'water_settings', s);
            _notify('water', 'settings', s);
        },

        // 记录结构：{ 'YYYY-MM-DD': { cups: 3, ml: 750 } }
        allRecords: function () {
            return _read(KEYS.WATER_RECORDS || 'water_records', {});
        },
        saveAllRecords: function (map) {
            _write(KEYS.WATER_RECORDS || 'water_records', map);
            _notify('water', 'records', map);
        },
        getToday: function () {
            var map = this.allRecords();
            var today = Time.formatDate();
            return map[today] || { cups: 0, ml: 0 };
        },
        addCup: function (n) {
            var map = this.allRecords();
            var today = Time.formatDate();
            if (!map[today]) map[today] = { cups: 0, ml: 0 };
            var settings = this.getSettings();
            var onceMl = settings.onceVolume || 250;
            var delta = n || 1;
            map[today].cups = Math.max(0, map[today].cups + delta);
            map[today].ml = Math.max(0, map[today].ml + delta * onceMl);
            this.saveAllRecords(map);
            return map[today];
        },
        setToday: function (cups) {
            var map = this.allRecords();
            var today = Time.formatDate();
            var settings = this.getSettings();
            var onceMl = settings.onceVolume || 250;
            map[today] = { cups: cups, ml: cups * onceMl };
            this.saveAllRecords(map);
            return map[today];
        },
        // 最近 n 天
        getRecent: function (n) {
            var map = this.allRecords();
            var days = n || 7;
            var result = [];
            for (var i = days - 1; i >= 0; i--) {
                var d = new Date();
                d.setDate(d.getDate() - i);
                var key = Time.formatDate(d);
                result.push({
                    date: key,
                    day: d.getDate(),
                    cups: (map[key] && map[key].cups) || 0,
                    ml: (map[key] && map[key].ml) || 0
                });
            }
            return result;
        },

        // 提醒字卡
        listWordcards: function () {
            var saved = _read(KEYS.WATER_WORDCARDS || 'water_wordcards', null);
            if (saved) return saved;
            return DEFAULT_WATER.wordcards || [];
        },
        saveWordcards: function (list) {
            _write(KEYS.WATER_WORDCARDS || 'water_wordcards', list);
            _notify('water', 'wordcards', list);
        },
        addWordcard: function (text) {
            var list = this.listWordcards();
            list.push(text);
            this.saveWordcards(list);
            return text;
        },
        removeWordcard: function (index) {
            var list = this.listWordcards();
            list.splice(index, 1);
            this.saveWordcards(list);
        }
    };

    /* ============================================================
     * 11. 音乐
     * ============================================================ */
    var Music = {
        listLibrary: function () {
            return _read(KEYS.MUSIC_LIBRARY || 'music_library', []);
        },
        saveLibrary: function (list) {
            _write(KEYS.MUSIC_LIBRARY || 'music_library', list);
            _notify('music', 'library', list);
        },
        add: function (song) {
            var list = this.listLibrary();
            song.id = song.id || Str.uid('song');
            song.addedAt = song.addedAt || Date.now();
            list.unshift(song);
            this.saveLibrary(list);
            return song;
        },
        remove: function (id) {
            var list = this.listLibrary();
            Obj.removeById(list, id);
            this.saveLibrary(list);
        },
        get: function (id) {
            return Obj.findById(this.listLibrary(), id);
        },

        listPlaylists: function () {
            return _read(KEYS.MUSIC_PLAYLISTS || 'music_playlists', []);
        },
        savePlaylists: function (list) {
            _write(KEYS.MUSIC_PLAYLISTS || 'music_playlists', list);
            _notify('music', 'playlists', list);
        },
        addPlaylist: function (pl) {
            var list = this.listPlaylists();
            pl.id = pl.id || Str.uid('pl');
            pl.songs = pl.songs || [];
            pl.createdAt = pl.createdAt || Date.now();
            list.push(pl);
            this.savePlaylists(list);
            return pl;
        },
        removePlaylist: function (id) {
            var list = this.listPlaylists();
            Obj.removeById(list, id);
            this.savePlaylists(list);
        },
        addSongToPlaylist: function (plId, songId) {
            var list = this.listPlaylists();
            var pl = Obj.findById(list, plId);
            if (pl) {
                pl.songs = pl.songs || [];
                if (pl.songs.indexOf(songId) === -1) pl.songs.push(songId);
                this.savePlaylists(list);
            }
        }
    };

    /* ============================================================
     * 12. 提问
     * ============================================================ */
    var Question = {
        list: function (type) {
            var all = _read(KEYS.QUESTIONS || 'questions', { mine: [], ta: [] });
            if (type) return all[type] || [];
            return all;
        },
        saveAll: function (all) {
            _write(KEYS.QUESTIONS || 'questions', all);
            _notify('question', 'list', all);
        },
        add: function (type, q) {
            var all = this.list();
            if (!all[type]) all[type] = [];
            q.id = q.id || Str.uid('q');
            q.createdAt = q.createdAt || Date.now();
            q.options = q.options || [];
            all[type].unshift(q);
            this.saveAll(all);
            _notify('question', 'add', { type: type, item: q });
            return q;
        },
        get: function (type, id) {
            return Obj.findById(this.list(type), id);
        },
        update: function (type, id, patch) {
            var all = this.list();
            var item = Obj.updateById(all[type] || [], id, patch);
            if (item) this.saveAll(all);
            return item;
        },
        remove: function (type, id) {
            var all = this.list();
            var list = all[type] || [];
            Obj.removeById(list, id);
            this.saveAll(all);
        }
    };

    /* ============================================================
     * 13. 占卜
     * ============================================================ */
    var Divination = {
        list: function () {
            return _read(KEYS.DIVINATION_RECORDS || 'divination_records', []);
        },
        saveAll: function (list) {
            _write(KEYS.DIVINATION_RECORDS || 'divination_records', list);
            _notify('divination', 'list', list);
        },
        add: function (record) {
            var list = this.list();
            record.id = record.id || Str.uid('div');
            record.createdAt = record.createdAt || Date.now();
            list.unshift(record);
            if (list.length > 500) list = list.slice(0, 500);
            this.saveAll(list);
            return record;
        },
        remove: function (id) {
            var list = this.list();
            Obj.removeById(list, id);
            this.saveAll(list);
        },
        clear: function () {
            this.saveAll([]);
        }
    };

    /* ============================================================
     * 14. 纪念日
     * ============================================================ */
    var Anniversary = {
        list: function () {
            return _read(KEYS.ANNIVERSARIES || 'anniversaries', []);
        },
        saveAll: function (list) {
            _write(KEYS.ANNIVERSARIES || 'anniversaries', list);
            _notify('anniversary', 'list', list);
        },
        add: function (a) {
            var list = this.list();
            a.id = a.id || Str.uid('ann');
            a.createdAt = a.createdAt || Date.now();
            list.push(a);
            this.saveAll(list);
            return a;
        },
        update: function (id, patch) {
            var list = this.list();
            var item = Obj.updateById(list, id, patch);
            if (item) this.saveAll(list);
            return item;
        },
        remove: function (id) {
            var list = this.list();
            Obj.removeById(list, id);
            this.saveAll(list);
        }
    };

    /* ============================================================
     * 15. 情绪
     * ============================================================ */
    var Mood = {
        getCurrent: function () {
            return _read('mood_current', {
                mood: DEFAULT_MOOD.current || 'calm',
                intensity: DEFAULT_MOOD.intensity || 50,
                updatedAt: Date.now()
            });
        },
        setCurrent: function (mood, intensity) {
            var data = {
                mood: mood,
                intensity: intensity !== undefined ? intensity : 50,
                updatedAt: Date.now()
            };
            _write('mood_current', data);

            // 同时写历史
            var history = this.listHistory();
            history.push({
                mood: mood,
                intensity: data.intensity,
                time: data.updatedAt
            });
            if (history.length > 200) history = history.slice(-200);
            _write(KEYS.MOOD_HISTORY || 'mood_history', history);

            _notify('mood', 'current', data);
            return data;
        },
        listHistory: function () {
            return _read(KEYS.MOOD_HISTORY || 'mood_history', []);
        },
        clearHistory: function () {
            _write(KEYS.MOOD_HISTORY || 'mood_history', []);
        }
    };

    /* ============================================================
     * 16. 通话记录
     * ============================================================ */
    var Call = {
        list: function () {
            return _read(KEYS.CALL_RECORDS || 'call_records', []);
        },
        saveAll: function (list) {
            _write(KEYS.CALL_RECORDS || 'call_records', list);
            _notify('call', 'list', list);
        },
        add: function (record) {
            var list = this.list();
            record.id = record.id || Str.uid('call');
            record.time = record.time || Date.now();
            list.unshift(record);
            if (list.length > 200) list = list.slice(0, 200);
            this.saveAll(list);
            return record;
        },
        clear: function () {
            this.saveAll([]);
        }
    };

    /* ============================================================
     * 17. 群聊
     * ============================================================ */
    var Group = {
        list: function () {
            return _read(KEYS.GROUP_CHATS || 'group_chats', []);
        },
        saveAll: function (list) {
            _write(KEYS.GROUP_CHATS || 'group_chats', list);
            _notify('group', 'list', list);
        },
        get: function (id) {
            return Obj.findById(this.list(), id);
        },
        add: function (group) {
            var list = this.list();
            group.id = group.id || Str.uid('group');
            group.createdAt = group.createdAt || Date.now();
            group.members = group.members || [];
            list.push(group);
            this.saveAll(list);
            return group;
        },
        update: function (id, patch) {
            var list = this.list();
            var item = Obj.updateById(list, id, patch);
            if (item) this.saveAll(list);
            return item;
        },
        remove: function (id) {
            var list = this.list();
            Obj.removeById(list, id);
            this.saveAll(list);
        }
    };

    /* ============================================================
     * 18. 商城
     * ============================================================ */
    var Shop = {
        // 商品
        listGoods: function (category) {
            var saved = _read(KEYS.SHOP_GOODS || 'shop_goods', null);
            if (!saved) {
                saved = Obj.deepClone(DEFAULT_SHOP_GOODS);
            }
            if (category) return saved[category] || [];
            return saved;
        },
        saveGoods: function (all) {
            _write(KEYS.SHOP_GOODS || 'shop_goods', all);
            _notify('shop', 'goods', all);
        },
        addGoods: function (category, goods) {
            var all = this.listGoods();
            if (!all[category]) all[category] = [];
            goods.id = goods.id || Str.uid('goods');
            goods.createdAt = goods.createdAt || Date.now();
            all[category].unshift(goods);
            this.saveGoods(all);
            return goods;
        },
        removeGoods: function (category, id) {
            var all = this.listGoods();
            var list = all[category] || [];
            Obj.removeById(list, id);
            this.saveGoods(all);
        },

        // 余额
        getBalance: function () {
            var v = Store.get(KEYS.BALANCE || 'balance');
            if (v === null || v === undefined) {
                return (DEFAULT_SHOP && DEFAULT_SHOP.balance) || 520.00;
            }
            return Number(v);
        },
        setBalance: function (v) {
            var n = Number(v) || 0;
            _write(KEYS.BALANCE || 'balance', n);
            _notify('shop', 'balance', n);
            if (CORE.emit) CORE.emit(CONFIG.EVENTS && CONFIG.EVENTS.BALANCE_CHANGE || 'balance:change', n);
            return n;
        },
        addBalance: function (delta) {
            return this.setBalance(this.getBalance() + Number(delta || 0));
        },

        // 购物车
        // 结构：[{ goodsId, category, name, icon, price, count, selected }]
        listCart: function () {
            return _read(KEYS.CART || 'cart', []);
        },
        saveCart: function (list) {
            _write(KEYS.CART || 'cart', list);
            _notify('shop', 'cart', list);
            if (STATE.Cart) {} else {
                STATE.set && STATE.set('cartCount', this.countCart());
            }
        },
        addToCart: function (goods, category) {
            var list = this.listCart();
            var exist = Obj.find(list, function (it) {
                return it.goodsId === goods.id;
            });
            if (exist) {
                exist.count += 1;
            } else {
                list.push({
                    goodsId: goods.id,
                    category: category || 'recommend',
                    name: goods.name,
                    icon: goods.icon || '🎁',
                    price: goods.price,
                    count: 1,
                    selected: true
                });
            }
            this.saveCart(list);
            if (CORE.emit) CORE.emit(CONFIG.EVENTS && CONFIG.EVENTS.CART_CHANGE || 'cart:change', list);
            return list;
        },
        updateCartItem: function (goodsId, patch) {
            var list = this.listCart();
            var item = Obj.find(list, function (it) { return it.goodsId === goodsId; });
            if (item) {
                Obj.assign(item, patch);
                if (item.count <= 0) {
                    list = list.filter(function (it) { return it.goodsId !== goodsId; });
                }
                this.saveCart(list);
            }
            return list;
        },
        removeCartItems: function (goodsIds) {
            var list = this.listCart().filter(function (it) {
                return goodsIds.indexOf(it.goodsId) === -1;
            });
            this.saveCart(list);
            return list;
        },
        clearCart: function () {
            this.saveCart([]);
        },
        countCart: function () {
            return this.listCart().reduce(function (sum, it) {
                return sum + (it.count || 0);
            }, 0);
        },

        // 订单
        // 结构：[{ id, items, total, status, createdAt }]
        // status: 'pending' | 'delivering' | 'done' | 'cancelled'
        listOrders: function (status) {
            var list = _read(KEYS.ORDERS || 'orders', []);
            if (status && status !== 'all') {
                return list.filter(function (o) { return o.status === status; });
            }
            return list;
        },
        saveOrders: function (list) {
            _write(KEYS.ORDERS || 'orders', list);
            _notify('shop', 'orders', list);
        },
        addOrder: function (order) {
            var list = this.listOrders();
            order.id = order.id || Str.uid('order');
            order.createdAt = order.createdAt || Date.now();
            order.status = order.status || 'pending';
            list.unshift(order);
            this.saveOrders(list);
            if (CORE.emit) CORE.emit(CONFIG.EVENTS && CONFIG.EVENTS.ORDER_CREATE || 'order:create', order);
            return order;
        },
        updateOrder: function (id, patch) {
            var list = this.listOrders();
            var item = Obj.updateById(list, id, patch);
            if (item) this.saveOrders(list);
            return item;
        },
        removeOrder: function (id) {
            var list = this.listOrders();
            Obj.removeById(list, id);
            this.saveOrders(list);
        }
    };

    /* ============================================================
     * 19. 备份相关
     * ============================================================ */
    var Backup = {
        getLastTime: function () {
            return Store.get(KEYS.BACKUP_LAST_TIME || 'backup_last_time') || 0;
        },
        setLastTime: function (ts) {
            _write(KEYS.BACKUP_LAST_TIME || 'backup_last_time', ts || Date.now());
        }
    };

    /* ============================================================
     * 20. 全量数据导出 / 导入
     * ============================================================ */
    var All = {
        /**
         * 导出全部数据为一个对象（用于备份）
         */
        exportAll: function () {
            return {
                version: (CONFIG.APP_INFO && CONFIG.APP_INFO.version) || '0.1.0',
                exportedAt: Date.now(),
                user: User.get(),
                characters: Character.list(),
                settings: Settings.get(),
                theme: Theme.get(),
                chatList: Chat.listChats(),
                messages: Chat.allMessages(),
                wordcards: Wordcard.getAll(),
                favorites: Favorite.list(),
                letters: {
                    sent: Letter.listSent(),
                    received: Letter.listReceived(),
                    time: Letter.listTime()
                },
                moments: Moments.list(),
                momentsVisits: Moments.listVisits(),
                momentsBg: Moments.getBg(),
                period: {
                    settings: Period.getSettings(),
                    records: Period.listRecords()
                },
                water: {
                    settings: Water.getSettings(),
                    records: Water.allRecords(),
                    wordcards: Water.listWordcards()
                },
                music: {
                    library: Music.listLibrary(),
                    playlists: Music.listPlaylists()
                },
                questions: Question.list(),
                divination: Divination.list(),
                anniversaries: Anniversary.list(),
                mood: {
                    current: Mood.getCurrent(),
                    history: Mood.listHistory()
                },
                calls: Call.list(),
                groups: Group.list(),
                shop: {
                    goods: Shop.listGoods(),
                    balance: Shop.getBalance(),
                    cart: Shop.listCart(),
                    orders: Shop.listOrders()
                }
            };
        },

        /**
         * 导入数据
         */
        importAll: function (data) {
            if (!data || typeof data !== 'object') return false;

            try {
                if (data.user) User.save(data.user);
                if (data.characters) Character.saveAll(data.characters);
                if (data.settings) Settings.save(data.settings);
                if (data.theme) Theme.save(data.theme);
                if (data.chatList) Chat.saveChats(data.chatList);
                if (data.messages) Chat.saveAllMessages(data.messages);
                if (data.wordcards) Wordcard.saveAll(data.wordcards);
                if (data.favorites) Favorite.saveAll(data.favorites);
                if (data.letters) {
                    if (data.letters.sent) _write(KEYS.LETTERS_SENT || 'letters_sent', data.letters.sent);
                    if (data.letters.received) _write(KEYS.LETTERS_RECEIVED || 'letters_received', data.letters.received);
                    if (data.letters.time) _write(KEYS.LETTERS_TIME || 'letters_time', data.letters.time);
                }
                if (data.moments) Moments.saveAll(data.moments);
                if (data.momentsVisits) _write(KEYS.MOMENTS_VISITS || 'moments_visits', data.momentsVisits);
                if (data.momentsBg !== undefined) Moments.setBg(data.momentsBg);
                if (data.period) {
                    if (data.period.settings) Period.saveSettings(data.period.settings);
                    if (data.period.records) Period.saveRecords(data.period.records);
                }
                if (data.water) {
                    if (data.water.settings) Water.saveSettings(data.water.settings);
                    if (data.water.records) Water.saveAllRecords(data.water.records);
                    if (data.water.wordcards) Water.saveWordcards(data.water.wordcards);
                }
                if (data.music) {
                    if (data.music.library) Music.saveLibrary(data.music.library);
                    if (data.music.playlists) Music.savePlaylists(data.music.playlists);
                }
                if (data.questions) Question.saveAll(data.questions);
                if (data.divination) Divination.saveAll(data.divination);
                if (data.anniversaries) Anniversary.saveAll(data.anniversaries);
                if (data.mood) {
                    if (data.mood.current) _write('mood_current', data.mood.current);
                    if (data.mood.history) _write(KEYS.MOOD_HISTORY || 'mood_history', data.mood.history);
                }
                if (data.calls) Call.saveAll(data.calls);
                if (data.groups) Group.saveAll(data.groups);
                if (data.shop) {
                    if (data.shop.goods) Shop.saveGoods(data.shop.goods);
                    if (data.shop.balance !== undefined) Shop.setBalance(data.shop.balance);
                    if (data.shop.cart) Shop.saveCart(data.shop.cart);
                    if (data.shop.orders) Shop.saveOrders(data.shop.orders);
                }

                _notify('all', 'import', data);
                return true;
            } catch (e) {
                Log.error('[data] 导入失败:', e);
                return false;
            }
        },

        /**
         * 清空全部数据（保留配置）
         */
        clearAll: function () {
            if (Store.clearAll) {
                Store.clearAll();
            }
            _notify('all', 'clear', {});
        },

        /**
         * 统计各模块占用大小（字节）
         */
        stats: function () {
            return {
                chat: Store.sizeOf(KEYS.MESSAGES || 'messages'),
                wordcard: Store.sizeOf(KEYS.WORDCARDS || 'wordcards'),
                favorite: Store.sizeOf(KEYS.FAVORITES || 'favorites'),
                moments: Store.sizeOf(KEYS.MOMENTS || 'moments'),
                letter: Store.sizeOf(KEYS.LETTERS_SENT || 'letters_sent')
                    + Store.sizeOf(KEYS.LETTERS_RECEIVED || 'letters_received')
                    + Store.sizeOf(KEYS.LETTERS_TIME || 'letters_time'),
                anniversary: Store.sizeOf(KEYS.ANNIVERSARIES || 'anniversaries'),
                divination: Store.sizeOf(KEYS.DIVINATION_RECORDS || 'divination_records'),
                music: Store.sizeOf(KEYS.MUSIC_LIBRARY || 'music_library')
                    + Store.sizeOf(KEYS.MUSIC_PLAYLISTS || 'music_playlists'),
                question: Store.sizeOf(KEYS.QUESTIONS || 'questions'),
                period: Store.sizeOf(KEYS.PERIOD_RECORDS || 'period_records')
                    + Store.sizeOf(KEYS.PERIOD_SETTINGS || 'period_settings'),
                water: Store.sizeOf(KEYS.WATER_RECORDS || 'water_records')
                    + Store.sizeOf(KEYS.WATER_SETTINGS || 'water_settings'),
                shop: Store.sizeOf(KEYS.SHOP_GOODS || 'shop_goods')
                    + Store.sizeOf(KEYS.CART || 'cart')
                    + Store.sizeOf(KEYS.ORDERS || 'orders'),
                total: Store.sizeAll()
            };
        }
    };

    /* ============================================================
     * 21. 初始化 & 对外导出
     * ============================================================ */
    function init() {
        Log.log('[data] 初始化完成');
        // 首次进入写入默认商品 & 余额
        if (!Store.get(KEYS.SHOP_GOODS || 'shop_goods')) {
            Shop.saveGoods(Obj.deepClone(DEFAULT_SHOP_GOODS));
        }
        if (Store.get(KEYS.BALANCE || 'balance') === null) {
            Shop.setBalance((DEFAULT_SHOP && DEFAULT_SHOP.balance) || 520);
        }
    }

    var APP_DATA = {
        init: init,

        // 模块
        User: User,
        Character: Character,
        Settings: Settings,
        Theme: Theme,
        Chat: Chat,
        Wordcard: Wordcard,
        Favorite: Favorite,
        Letter: Letter,
        Moments: Moments,
        Period: Period,
        Water: Water,
        Music: Music,
        Question: Question,
        Divination: Divination,
        Anniversary: Anniversary,
        Mood: Mood,
        Call: Call,
        Group: Group,
        Shop: Shop,
        Backup: Backup,
        All: All
    };

    // 挂到全局
    global.APP_DATA = APP_DATA;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_DATA;

})(typeof window !== 'undefined' ? window : this);