/**
 * group-chat.js
 * 群聊模块：创建群 / 多角色聊天 / 群消息渲染
 * 依赖：config / utils / state / core / data / reply-library / mood
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 群聊是多个梦角在同一个会话里。
 * 2. 支持创建群、加成员、退群、解散。
 * 3. 用户发一条消息，群里的梦角按概率随机回复。
 * 4. 群消息和单聊消息存在同一个 messages 结构里，用 chatId 区分。
 * 5. 挂到 window.APP_GROUP 上
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
    var Time = UTILS.Time;
    var Num = UTILS.Num;
    var Obj = UTILS.Obj;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};

    function esc(s) {
        return Str.escapeHtml ? Str.escapeHtml(s) : String(s || '');
    }

    /* ============================================================
     * 1. 群组数据结构
     * ============================================================
     * Group = {
     *   id: 'group_xxx',
     *   name: '群聊名称',
     *   members: ['ta', 'ta2', ...],   // 成员 id（角色 id）
     *   ownerId: 'me',                 // 群主
     *   createdAt: 时间戳,
     *   avatar: ''                     // 群头像（可选）
     * }
     * ============================================================ */

    /* ============================================================
     * 2. 群列表
     * ============================================================ */

    /**
     * 获取所有群
     */
    function listGroups() {
        return DATA.Group.list();
    }

    /**
     * 获取某个群
     */
    function getGroup(id) {
        return DATA.Group.get(id);
    }

    /**
     * 获取群成员的角色信息
     */
    function getMembers(group) {
        if (!group) return [];
        return (group.members || []).map(function (id) {
            var char = DATA.Character.get(id);
            if (char) return char;
            // 兜底
            return { id: id, name: id, avatar: '' };
        });
    }

    /**
     * 取群显示名
     */
    function getGroupDisplayName(group) {
        if (!group) return '';
        if (group.name) return group.name;
        var names = getMembers(group).map(function (m) { return m.name; });
        return names.join('、');
    }

    /* ============================================================
     * 3. 创建群
     * ============================================================ */

    /**
     * 创建群聊
     * @param {object} options { name, members }
     * @returns {object} group
     */
    function createGroup(options) {
        options = options || {};

        var members = options.members || [];
        if (members.length === 0) {
            // 默认把主角色加进去
            var first = DATA.Character.list()[0];
            if (first) members = [first.id];
        }

        var group = DATA.Group.add({
            name: options.name || '群聊',
            members: members,
            ownerId: 'me',
            avatar: options.avatar || ''
        });

        // 顺便在聊天列表里加一条
        _ensureChatListItem(group);

        Log.log('[group] 创建群聊:', group.id, group.name);
        if (CORE.emit) CORE.emit('group:created', group);

        return group;
    }

    /**
     * 从聊天信息页的"发起群聊"弹窗创建
     */
    function createFromPopup() {
        var box = document.querySelector('.popup-create-group');
        if (!box) return null;

        var nameInput = box.querySelector('input[type="text"]');
        var name = nameInput ? (nameInput.value || '').trim() : '群聊';

        // 弹窗里已有的成员
        var members = [];
        var memberItems = box.querySelectorAll('.member-item');
        memberItems.forEach(function (el) {
            var id = el.dataset.memberId;
            if (id) members.push(id);
        });

        // 兜底：至少有一个
        if (members.length === 0) {
            var first = DATA.Character.list()[0];
            if (first) members = [first.id];
        }

        return createGroup({ name: name, members: members });
    }

    /* ============================================================
     * 4. 群管理
     * ============================================================ */

    function renameGroup(id, newName) {
        return DATA.Group.update(id, { name: newName });
    }

    function addMember(id, memberId) {
        var group = getGroup(id);
        if (!group) return false;
        group.members = group.members || [];
        if (group.members.indexOf(memberId) > -1) return false;
        group.members.push(memberId);
        DATA.Group.update(id, { members: group.members });
        if (CORE.emit) CORE.emit('group:memberAdd', { id: id, memberId: memberId });
        return true;
    }

    function removeMember(id, memberId) {
        var group = getGroup(id);
        if (!group) return false;
        group.members = (group.members || []).filter(function (m) {
            return m !== memberId;
        });
        DATA.Group.update(id, { members: group.members });
        if (CORE.emit) CORE.emit('group:memberRemove', { id: id, memberId: memberId });
        return true;
    }

    /**
     * 退出 / 解散群
     */
    function dissolveGroup(id) {
        // 清空消息
        DATA.Chat.clearMessages(id);
        // 从聊天列表移除
        var chats = DATA.Chat.listChats().filter(function (c) { return c.id !== id; });
        DATA.Chat.saveChats(chats);
        // 删除群
        DATA.Group.remove(id);
        if (CORE.emit) CORE.emit('group:dissolved', { id: id });
    }

    /* ============================================================
     * 5. 聊天列表整合
     * ============================================================ */

    /**
     * 确保群在聊天列表里有对应项
     */
    function _ensureChatListItem(group) {
        var chats = DATA.Chat.listChats();
        var exist = Obj.findById(chats, group.id);
        if (exist) return exist;

        var item = {
            id: group.id,
            name: getGroupDisplayName(group),
            avatar: group.avatar || '',
            isGroup: true,
            lastMsg: '',
            lastTime: group.createdAt || Date.now(),
            unread: 0,
            pinned: false,
            muted: false
        };
        chats.push(item);
        DATA.Chat.saveChats(chats);
        return item;
    }

    /**
     * 判断某个 chatId 是否是群
     */
    function isGroup(chatId) {
        if (!chatId) return false;
        return !!getGroup(chatId);
    }

    /* ============================================================
     * 6. 发送消息
     * ============================================================ */

    /**
     * 在群里发送消息
     * @param {string} groupId
     * @param {string} text
     */
    function sendMessage(groupId, text) {
        if (!groupId || !text) return false;
        var group = getGroup(groupId);
        if (!group) return false;

        // 存用户消息
        DATA.Chat.addMessage(groupId, {
            from: 'me',
            text: text,
            type: 'text'
        });

        // 触发情绪（用主角色）
        if (MOOD.onUserMessage) {
            MOOD.onUserMessage({ text: text });
        }

        // 安排群成员回复
        _scheduleReplies(group, text);

        return true;
    }

    /**
     * 安排群成员回复
     */
    function _scheduleReplies(group, userText) {
        var members = group.members || [];
        if (members.length === 0) return;

        // 回复人数：随机的 1 ~ 全部
        var replyCount = Num.randInt(1, members.length);
        var repliers = Num.randPickMany(members, replyCount);

        repliers.forEach(function (memberId, i) {
            // 每个成员延迟不同
            var delay = Num.randInt(1, 8) * 1000 + i * 500;

            setTimeout(function () {
                // 如果群已经解散
                if (!getGroup(group.id)) return;

                var char = DATA.Character.get(memberId);
                var name = char ? char.name : memberId;

                var reply = _pickGroupReply(userText);

                DATA.Chat.addMessage(group.id, {
                    from: memberId,
                    fromName: name,
                    text: reply,
                    type: 'text',
                    isGroup: true
                });

                // 如果当前不在这个群，未读 +1 + 通知
                var currentChatId = STATE.get('currentChatId');
                var currentPage = STATE.get('currentPage');

                if (currentPage !== 'chatRoom' || currentChatId !== group.id) {
                    STATE.Unread.add(group.id);
                    ENV.notifyMessage && ENV.notifyMessage(
                        { id: group.id, name: getGroupDisplayName(group) },
                        { text: name + '：' + reply }
                    );
                } else {
                    // 在群里，实时刷新
                    if (CORE.emit) CORE.emit('message:render', { chatId: group.id });
                }
            }, delay);
        });
    }

    /**
     * 选一句群回复
     */
    function _pickGroupReply(userText) {
        var t = (userText || '').toLowerCase();

        // 一部分走日常回复
        var pool;
        if (/想你|想我/.test(t)) pool = REPLY.DAILY_REPLY.missYou;
        else if (/晚安/.test(t)) pool = REPLY.DAILY_REPLY.goodNight;
        else if (/在吗|在么/.test(t)) pool = REPLY.DAILY_REPLY.areYouThere;
        else pool = REPLY.GROUP_REPLY.normal;

        return REPLY.pick ? REPLY.pick(pool) : pool[0];
    }

    /* ============================================================
     * 7. 渲染群消息
     * ============================================================ */

    /**
     * 渲染一条群消息到容器
     * @param {HTMLElement} container
     * @param {object} msg
     */
    function renderMessage(container, msg) {
        if (!container || !msg) return;

        var row = document.createElement('div');

        if (msg.type === 'system') {
            row.className = 'message-row';
            row.innerHTML = '<div style="margin:0 auto;color:#999;font-size:12px">'
                + esc(msg.text) + '</div>';
            container.appendChild(row);
            return;
        }

        var isMe = msg.from === 'me';
        row.className = 'message-row ' + (isMe ? 'message-self' : 'message-other');

        var timeStr = Time.chatTime(msg.time);

        if (isMe) {
            row.innerHTML =
                '<div class="msg-bubble bubble-self">' +
                    '<p class="bubble-text">' + esc(msg.text || '') + '</p>' +
                '</div>' +
                '<div class="avatar avatar-me-small"></div>' +
                '<span class="msg-time">' + timeStr + '</span>';
        } else {
            // 群聊中显示名字
            var nameLine = msg.fromName
                ? '<span class="msg-sender-name" style="font-size:11px;color:#999;display:block;margin-bottom:2px">' + esc(msg.fromName) + '</span>'
                : '';

            row.innerHTML =
                '<div class="avatar avatar-ta-small"></div>' +
                '<div>' +
                    nameLine +
                    '<div class="msg-bubble bubble-other">' +
                        '<p class="bubble-text">' + esc(msg.text || '') + '</p>' +
                    '</div>' +
                '</div>' +
                '<span class="msg-time">' + timeStr + '</span>';
        }

        container.appendChild(row);
    }

    /**
     * 渲染整个群的会话
     * @param {string} groupId
     * @param {HTMLElement} container
     */
    function renderGroupChat(groupId, container) {
        if (!container) return;

        var group = getGroup(groupId);
        if (!group) {
            container.innerHTML = '<p class="empty-tip">群不存在或已解散</p>';
            return;
        }

        var msgs = DATA.Chat.getMessages(groupId);
        container.innerHTML = '';

        if (msgs.length === 0) {
            container.innerHTML = '<div class="empty-chat-tip">'
                + '<span class="icon-heart-line-empty big"></span>'
                + '<p class="empty-chat-text">还没有聊天哦，快来增加感情吧</p>'
                + '</div>';
            return;
        }

        var self = this;
        msgs.forEach(function (m) {
            renderMessage(container, m);
        });
    }

    /* ============================================================
     * 8. 群创建时的欢迎消息
     * ============================================================ */

    /**
     * 群刚建好时，每个成员说一句话
     */
    function _sendWelcomeMessages(group) {
        var members = group.members || [];
        members.forEach(function (memberId, i) {
            setTimeout(function () {
                if (!getGroup(group.id)) return;
                var char = DATA.Character.get(memberId);
                var name = char ? char.name : memberId;

                DATA.Chat.addMessage(group.id, {
                    from: memberId,
                    fromName: name,
                    text: REPLY.pick(REPLY.GROUP_REPLY.created),
                    type: 'text',
                    isGroup: true
                });

                if (CORE.emit) CORE.emit('message:render', { chatId: group.id });
            }, (i + 1) * 800);
        });
    }

    /* ============================================================
     * 9. 群统计
     * ============================================================ */

    /**
     * 群聊成员发送统计
     */
    function getMemberStats(groupId) {
        var msgs = DATA.Chat.getMessages(groupId);
        var map = {};
        msgs.forEach(function (m) {
            if (m.from === 'me') return;
            map[m.from] = (map[m.from] || 0) + 1;
        });
        return map;
    }

    /* ============================================================
     * 10. 初始化
     * ============================================================ */
    function init() {
        // 把已有的群补到聊天列表
        listGroups().forEach(function (g) {
            _ensureChatListItem(g);
        });

        Log.log('[group] 初始化完成，共 ' + listGroups().length + ' 个群');
    }

    /* ============================================================
     * 11. 对外导出
     * ============================================================ */
    var APP_GROUP = {
        init: init,

        // 群列表
        listGroups: listGroups,
        getGroup: getGroup,
        getMembers: getMembers,
        getGroupDisplayName: getGroupDisplayName,
        isGroup: isGroup,

        // 创建 / 管理
        createGroup: createGroup,
        createFromPopup: createFromPopup,
        renameGroup: renameGroup,
        addMember: addMember,
        removeMember: removeMember,
        dissolveGroup: dissolveGroup,

        // 消息
        sendMessage: sendMessage,
        renderMessage: renderMessage,
        renderGroupChat: renderGroupChat,

        // 统计
        getMemberStats: getMemberStats,

        // 内部方法（方便调试）
        _sendWelcomeMessages: _sendWelcomeMessages
    };

    global.APP_GROUP = APP_GROUP;

})(typeof window !== 'undefined' ? window : this);