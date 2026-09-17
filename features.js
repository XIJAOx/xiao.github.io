/**
 * features.js （完整版 v3）
 * 功能模块集：所有业务逻辑与渲染
 * 依赖：config / utils / state / core / data / reply / mood / envelope / backup / audio / chart / tarot
 * 被依赖：listeners.js / main.js
 *
 * v3 改动：
 * 1. Chat.renderList 里加事件委托：点击聊天列表项设置 currentChatId
 * 2. Question.answer 末尾加 question-engine 联动
 * 3. Moments.publish 末尾加 moments-visits 联动
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
    var BACKUP = global.APP_BACKUP || {};
    var AUDIO = global.APP_AUDIO || {};
    var CHART = global.APP_CHART || {};
    var TAROT = global.APP_TAROT || {};

    var Dom = UTILS.Dom;
    var Str = UTILS.Str;
    var Time = UTILS.Time;
    var Num = UTILS.Num;
    var Obj = UTILS.Obj;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function $(s, p) { return (p || document).querySelector(s); }
    function $$(s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); }
    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s == null ? '' : s); }
    function uid(p) { return Str.uid ? Str.uid(p) : 'id_' + Date.now(); }

    /* ============================================================
     * 0. 通用：动态弹窗工具
     * ============================================================ */
    function openModal(opt) {
        opt = opt || {};

        var mask = document.createElement('div');
        mask.className = 'app-dynamic-modal';
        mask.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:rgba(0,0,0,0.45)', 'z-index:99997',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:20px', 'opacity:0', 'transition:opacity 0.2s'
        ].join(';');

        var box = document.createElement('div');
        box.className = 'app-dynamic-modal-box';
        box.style.cssText = [
            'background:#fff', 'border-radius:20px', 'padding:22px',
            'width:100%', 'max-width:400px', 'max-height:85vh',
            'overflow-y:auto', 'box-shadow:0 8px 32px rgba(0,0,0,0.2)'
        ].join(';');

        if (opt.title) {
            var h = document.createElement('h3');
            h.textContent = opt.title;
            h.style.cssText = 'font-size:17px;font-weight:600;margin:0 0 18px;text-align:center';
            box.appendChild(h);
        }

        var inputs = {};
        (opt.fields || []).forEach(function (f) {
            var wrap = document.createElement('div');
            wrap.style.cssText = 'margin-bottom:14px';

            if (f.label) {
                var label = document.createElement('label');
                label.textContent = f.label;
                label.style.cssText = 'display:block;font-size:13px;color:#777;margin-bottom:6px';
                wrap.appendChild(label);
            }

            var el;
            if (f.type === 'textarea') {
                el = document.createElement('textarea');
                el.value = f.value || '';
                el.placeholder = f.placeholder || '';
                el.style.cssText = 'width:100%;min-height:90px;border:1px solid #e5e5e5;border-radius:12px;padding:12px;font-size:14px;outline:none;resize:none;box-sizing:border-box';
            } else if (f.type === 'select') {
                el = document.createElement('select');
                el.style.cssText = 'width:100%;border:1px solid #e5e5e5;border-radius:12px;padding:12px;font-size:14px;outline:none;background:#fff;box-sizing:border-box';
                (f.options || []).forEach(function (o) {
                    var op = document.createElement('option');
                    op.value = o.value !== undefined ? o.value : o;
                    op.textContent = o.label !== undefined ? o.label : o;
                    if (f.value !== undefined && op.value === String(f.value)) op.selected = true;
                    el.appendChild(op);
                });
            } else if (f.type === 'color') {
                el = document.createElement('input');
                el.type = 'color';
                el.value = f.value || '#000000';
                el.style.cssText = 'width:100%;height:44px;border:1px solid #e5e5e5;border-radius:12px;cursor:pointer;box-sizing:border-box';
            } else {
                el = document.createElement('input');
                el.type = f.type || 'text';
                el.value = f.value !== undefined ? f.value : '';
                el.placeholder = f.placeholder || '';
                el.style.cssText = 'width:100%;border:1px solid #e5e5e5;border-radius:12px;padding:12px;font-size:14px;outline:none;box-sizing:border-box';
            }

            el.dataset.key = f.key;
            inputs[f.key] = el;
            wrap.appendChild(el);
            box.appendChild(wrap);
        });

        if (opt.buttons && opt.buttons.length > 0) {
            var row = document.createElement('div');
            row.style.cssText = 'display:grid;grid-template-columns:repeat(' + opt.buttons.length + ',1fr);gap:10px;margin-top:20px';

            opt.buttons.forEach(function (b) {
                var btn = document.createElement('button');
                btn.textContent = b.text;
                btn.style.cssText = b.primary
                    ? 'padding:12px;border:none;border-radius:14px;background:#000;color:#fff;font-size:15px;cursor:pointer'
                    : 'padding:12px;border:none;border-radius:14px;background:#f4f4f4;color:#333;font-size:15px;cursor:pointer';

                btn.addEventListener('click', function () {
                    var values = {};
                    Object.keys(inputs).forEach(function (k) {
                        values[k] = inputs[k].value;
                    });
                    var shouldClose = b.close !== false;
                    if (b.onClick) {
                        var r = b.onClick(values, box, inputs);
                        if (r === false) shouldClose = false;
                    }
                    if (shouldClose) _closeDynamic(mask, box);
                });
                row.appendChild(btn);
            });
            box.appendChild(row);
        }

        mask.appendChild(box);
        document.body.appendChild(mask);

        requestAnimationFrame(function () { mask.style.opacity = '1'; });

        mask.addEventListener('click', function (e) {
            if (e.target === mask) _closeDynamic(mask, box);
        });

        if (opt.onOpen) opt.onOpen(box, inputs);

        var firstInput = box.querySelector('input,textarea,select');
        if (firstInput && opt.autoFocus !== false) {
            setTimeout(function () { firstInput.focus(); }, 100);
        }

        return mask;
    }

    function _closeDynamic(mask, box) {
        if (!mask || !mask.parentNode) return;
        mask.style.opacity = '0';
        setTimeout(function () {
            if (mask.parentNode) mask.parentNode.removeChild(mask);
        }, 200);
    }

    function confirmDialog(text, onOk) {
        return openModal({
            title: '提示',
            fields: [
                { key: 'tip', label: '', type: 'textarea', value: text }
            ],
            buttons: [
                { text: '取消' },
                { text: '确定', primary: true, onClick: function () { onOk && onOk(); } }
            ],
            onOpen: function (box) {
                var ta = box.querySelector('textarea');
                if (ta) {
                    ta.disabled = true;
                    ta.style.background = '#f8f8f8';
                    ta.style.color = '#333';
                }
            }
        });
    }

    /* ============================================================
     * 1. 首页 Home
     * ============================================================ */
    var Home = {
        init: function () {
            this.renderCheckin();
            this.renderDailyLove();
            this.renderMemo();
        },
        onEnter: function () { this.renderCheckin(); this.renderMemo(); },

        renderDailyLove: function () {
            var el = $('.card-daily-love .card-content');
            if (!el) return;
            var list = (REPLY.DAILY_REPLY && REPLY.DAILY_REPLY.general) || ['和你在一起，每天都是好天气。'];
            el.textContent = REPLY.pick ? REPLY.pick(list) : list[0];
        },

        renderMemo: function () {
            var els = $$('.card-daily-memo .card-placeholder, .card-daily-memo .card-content, .memo-preview-card p');
            var memo = DATA.Settings.getOne('todayMemo') || '';
            els.forEach(function (el) {
                if (memo) {
                    el.textContent = memo;
                    if (el.classList.contains('card-placeholder')) el.classList.remove('card-placeholder');
                } else {
                    el.textContent = '点这里记一句话';
                    if (!el.classList.contains('card-placeholder') && el.parentNode.classList.contains('card-daily-memo')) {
                        el.classList.add('card-placeholder');
                    }
                }
            });
        },

        editMemo: function () {
            var cur = DATA.Settings.getOne('todayMemo') || '';
            openModal({
                title: '今日备忘',
                fields: [
                    { key: 'memo', label: '写一句话', type: 'textarea', value: cur, placeholder: '今天想记点什么…' }
                ],
                buttons: [
                    { text: '取消' },
                    { text: '保存', primary: true, onClick: function (v) {
                        DATA.Settings.setOne('todayMemo', (v.memo || '').trim());
                        Home.renderMemo();
                        ENV.tip && ENV.tip('已保存');
                    }}
                ]
            });
        },

        renderCheckin: function () {
            var streak = DATA.Settings.getOne('checkin.streak') || 0;
            var lastDate = DATA.Settings.getOne('checkin.lastDate') || '';
            var today = Time.formatDate();
            var done = lastDate === today;

            $$('.checkin-count').forEach(function (el) {
                el.textContent = '连续打卡 ' + streak + ' 天';
            });
            $$('.btn-checkin').forEach(function (btn) {
                btn.textContent = done ? '已打卡' : '打卡';
                btn.disabled = done;
                btn.style.opacity = done ? '0.5' : '';
            });
        },

        checkin: function () {
            var today = Time.formatDate();
            var lastDate = DATA.Settings.getOne('checkin.lastDate') || '';
            if (lastDate === today) return;

            var streak = DATA.Settings.getOne('checkin.streak') || 0;
            var yesterday = Time.formatDate(new Date(Date.now() - 86400000));
            if (lastDate !== yesterday) streak = 0;
            streak += 1;

            DATA.Settings.setOne('checkin.streak', streak);
            DATA.Settings.setOne('checkin.lastDate', today);
            this.renderCheckin();

            if (MOOD.onCheckin) MOOD.onCheckin(streak);

            var tpl;
            if (streak === 1) tpl = REPLY.pick(REPLY.CHECKIN_REPLY.first);
            else if (streak % 7 === 0) tpl = REPLY.pick(REPLY.CHECKIN_REPLY.milestone).replace('{n}', streak);
            else tpl = REPLY.pick(REPLY.CHECKIN_REPLY.streak).replace('{n}', streak);

            ENV.notify({ title: '打卡成功', body: tpl, icon: '✅', timeout: 2500 });

            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.addMessage(chatId, { from: 'ta', text: tpl, type: 'text' });
        }
    };

    /* ============================================================
     * 2. 聊天 Chat
     * ============================================================ */
    var Chat = {
        init: function () { this.renderList(); },
        onEnterList: function () { this.renderList(); },
        onEnterRoom: function () { this.renderRoom(); this.markRead(); this.updateSendButton(); },

        renderList: function () {
            var container = $('.chat-list-container');
            if (!container) return;

            // 【v3 修复】绑一次事件委托：点击项 → 设置 currentChatId
            if (!container._boundChatList) {
                container.addEventListener('click', function (e) {
                    var item = e.target.closest('.chat-list-item');
                    if (item && item.dataset.chatId) {
                        STATE.set('currentChatId', item.dataset.chatId);
                    }
                });
                container._boundChatList = true;
            }

            var chats = DATA.Chat.listChats();
            if (chats.length === 0) {
                container.innerHTML = '<p class="empty-tip">还没有聊天</p>';
                return;
            }
            chats = chats.slice().sort(function (a, b) {
                return (b.lastTime || 0) - (a.lastTime || 0);
            });

            container.innerHTML = chats.map(function (c) {
                var unread = STATE.Unread ? STATE.Unread.get(c.id) : 0;
                var unreadBadge = unread > 0
                    ? '<span style="background:#ff4466;color:#fff;font-size:11px;border-radius:10px;padding:1px 7px;margin-left:6px">' + unread + '</span>'
                    : '';
                return '<div class="chat-list-item" data-target-page="chatRoom" data-chat-id="' + c.id + '">' +
                    '<div class="avatar avatar-ta-small"></div>' +
                    '<div class="chat-item-info">' +
                        '<p class="chat-item-name">' + esc(c.name || 'TA') + unreadBadge + '</p>' +
                        '<p class="chat-item-last-msg">' + esc(c.lastMsg || '暂无消息') + '</p>' +
                    '</div>' +
                    '<span class="chat-item-time">' + (c.lastTime ? Time.chatTime(c.lastTime) : '') + '</span>' +
                '</div>';
            }).join('');
        },

        renderRoom: function () {
            var list = $('.message-list');
            var empty = $('.empty-chat-tip');
            var main = $('.chat-message-container');
            if (!list) return;

            var chatId = STATE.get('currentChatId') || 'ta';
            var msgs = DATA.Chat.getMessages(chatId);

            var char = DATA.Character.get(chatId);
            if (char) {
                $$('.chat-header-name').forEach(function (el) { el.textContent = char.name || 'TA'; });
            }

            if (msgs.length === 0) {
                list.style.display = 'none';
                if (empty) empty.style.display = 'flex';
                return;
            }
            list.style.display = 'block';
            if (empty) empty.style.display = 'none';

            var self = this;
            list.innerHTML = '';
            msgs.forEach(function (m) {
                list.appendChild(self._buildMessageEl(m));
            });

            if (main) main.scrollTop = main.scrollHeight;
        },

        _buildMessageEl: function (m) {
            var row = document.createElement('div');

            if (m.type === 'call') {
                row.className = 'message-row message-call-record';
                row.innerHTML = '<div class="msg-bubble bubble-call"><p class="bubble-text">' + esc(m.text || '') + '</p></div>';
                return row;
            }
            if (m.type === 'system') {
                row.className = 'message-row';
                row.innerHTML = '<div style="margin:0 auto;color:#999;font-size:12px">' + esc(m.text) + '</div>';
                return row;
            }

            var isMe = m.from === 'me';
            row.className = 'message-row ' + (isMe ? 'message-self' : 'message-other');
            var t = Time.chatTime(m.time);

            if (isMe) {
                row.innerHTML =
                    '<div class="msg-bubble bubble-self"><p class="bubble-text">' + esc(m.text || '') + '</p></div>' +
                    '<div class="avatar avatar-me-small"></div>' +
                    '<span class="msg-time">' + t + '</span>';
            } else {
                var nameLine = m.isGroup && m.fromName
                    ? '<span style="font-size:11px;color:#999;display:block;margin-bottom:2px">' + esc(m.fromName) + '</span>'
                    : '';
                row.innerHTML =
                    '<div class="avatar avatar-ta-small"></div>' +
                    '<div>' + nameLine + '<div class="msg-bubble bubble-other"><p class="bubble-text">' + esc(m.text || '') + '</p></div></div>' +
                    '<span class="msg-time">' + t + '</span>';
            }
            return row;
        },

        send: function () {
            var input = $('.msg-input');
            if (!input) return;
            var text = (input.value || '').trim();
            if (!text) return;

            var chatId = STATE.get('currentChatId') || 'ta';

            if (global.APP_GROUP && global.APP_GROUP.isGroup(chatId)) {
                global.APP_GROUP.sendMessage(chatId, text);
                input.value = '';
                this.renderRoom();
                return;
            }

            DATA.Chat.addMessage(chatId, { from: 'me', text: text, type: 'text' });
            input.value = '';
            this.renderRoom();

            if (MOOD.onUserMessage) MOOD.onUserMessage({ text: text });

            this.taReply(chatId, text);
        },

        taReply: function (chatId, userText) {
            var settings = DATA.Settings.getOne('reply') || {};
            var min = settings.minDelay || 1;
            var max = settings.maxDelay || 10;
            var minCount = settings.minCount || 1;
            var maxCount = settings.maxCount || 3;

            if (settings.readNoReply && Num.chance(0.5)) return;

            var delay = Num.randInt(min, max) * 1000;
            var count = Num.randInt(minCount, maxCount);
            var self = this;

            setTimeout(function () {
                var texts = self._pickReplyTexts(userText, count);
                texts.forEach(function (t, i) {
                    setTimeout(function () {
                        DATA.Chat.addMessage(chatId, { from: 'ta', text: t, type: 'text' });

                        if (STATE.get('currentPage') === 'chatRoom' && STATE.get('currentChatId') === chatId) {
                            self.renderRoom();
                        } else {
                            ENV.notifyMessage && ENV.notifyMessage({ id: chatId, name: 'TA' }, { text: t });
                            STATE.Unread.add(chatId);
                            self.renderList();
                        }
                    }, i * 800);
                });
            }, delay);
        },

        _pickReplyTexts: function (userText, count) {
            var t = (userText || '').toLowerCase();
            var pool;

            if (/想你|想我/.test(t)) pool = REPLY.DAILY_REPLY.missYou;
            else if (/爱你|喜欢你/.test(t)) pool = REPLY.DAILY_REPLY.loveYou;
            else if (/晚安|睡了/.test(t)) pool = REPLY.DAILY_REPLY.goodNight;
            else if (/早安|^早$/.test(t)) pool = REPLY.DAILY_REPLY.goodMorning;
            else if (/在吗|在么|在不在/.test(t)) pool = REPLY.DAILY_REPLY.areYouThere;
            else if (/对不起|抱歉/.test(t)) pool = REPLY.DAILY_REPLY.sorry;
            else if (/谢谢|感谢/.test(t)) pool = REPLY.DAILY_REPLY.thanks;
            else if (/生气|讨厌/.test(t)) pool = REPLY.DAILY_REPLY.angry;
            else if (/难过|伤心|不开心/.test(t)) pool = REPLY.DAILY_REPLY.sad;
            else if (/开心|高兴|哈哈/.test(t)) pool = REPLY.DAILY_REPLY.happy;
            else pool = REPLY.DAILY_REPLY.general;

            var settings = DATA.Settings.getOne('reply') || {};
            if (settings.joinWordcard && Num.chance(0.5)) {
                var cards = DATA.Wordcard.getByType('main');
                if (cards.length > 0) {
                    var card = REPLY.pick(cards);
                    pool = pool.concat([card.text || card]);
                }
            }

            return REPLY.pickMany(pool, count);
        },

        markRead: function () {
            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.markRead(chatId);
            STATE.Unread.clear(chatId);
        },

         // 【新增】根据设置显示/隐藏发送按钮
        updateSendButton: function () {
            var mode = DATA.Settings.getOne('chat.sendMode') || 'both';
            var btn = $('.btn-send-msg');
            if (!btn) return;

            if (mode === 'enter') {
                // 只用回车发 → 隐藏按钮
                btn.classList.remove('show');
                btn.style.display = 'none';
            } else {
                // both 或 button → 显示按钮
                btn.classList.add('show');
                btn.style.display = '';
            }
        },

        openEmojiPanel: function () {
            var emojis = (REPLY.WORDCARD && REPLY.WORDCARD.emoji) || ['😊', '😢', '😠', '❤️'];
            var kaomoji = (REPLY.WORDCARD && REPLY.WORDCARD.kaomoji) || ['(＾▽＾)'];

            var mask = document.createElement('div');
            mask.style.cssText = 'position:fixed;bottom:70px;left:0;width:100%;z-index:9990;padding:0 16px;pointer-events:none';

            var box = document.createElement('div');
            box.style.cssText = [
                'pointer-events:auto',
                'background:#fff', 'border-radius:16px', 'padding:14px',
                'box-shadow:0 4px 20px rgba(0,0,0,0.15)',
                'max-height:280px', 'overflow-y:auto'
            ].join(';');

            box.innerHTML = '<p style="font-size:12px;color:#999;margin:0 0 10px">Emoji</p>'
                + '<div style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;margin-bottom:16px">'
                + emojis.map(function (e) {
                    return '<span data-emoji="' + e + '" style="font-size:22px;text-align:center;cursor:pointer;padding:4px;border-radius:8px">' + e + '</span>';
                }).join('')
                + '</div>'
                + '<p style="font-size:12px;color:#999;margin:0 0 10px">颜文字</p>'
                + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">'
                + kaomoji.map(function (k) {
                    return '<span data-emoji="' + esc(k) + '" style="font-size:13px;text-align:center;cursor:pointer;padding:6px;background:#f8f8f8;border-radius:8px">' + esc(k) + '</span>';
                }).join('')
                + '</div>';

            mask.appendChild(box);
            document.body.appendChild(mask);

            box.addEventListener('click', function (e) {
                var emoji = e.target.getAttribute && e.target.getAttribute('data-emoji');
                if (emoji) {
                    var input = $('.msg-input');
                    if (input) {
                        input.value = (input.value || '') + emoji;
                        input.focus();
                    }
                    document.body.removeChild(mask);
                }
            });

            setTimeout(function () {
                document.addEventListener('click', function closePanel(ev) {
                    if (!mask.contains(ev.target) && !ev.target.closest('.btn-emoji')) {
                        if (mask.parentNode) mask.parentNode.removeChild(mask);
                        document.removeEventListener('click', closePanel);
                    }
                });
            }, 100);
        },

        openMoreMenu: function () {
            openModal({
                title: '更多',
                fields: [],
                buttons: [
                    { text: '📷 图片', onClick: function () { ENV.tip && ENV.tip('图片功能开发中'); } },
                    { text: '🎁 礼物', onClick: function () { ENV.tip && ENV.tip('礼物功能开发中'); } }
                ]
            });
        }
    };

        /* ============================================================
     * 2.5 角色资料 Character（【新增】）
     * ============================================================ */
    var Character = {
        // 打开发送方式弹窗时回填
        open: function () {
            var chatId = STATE.get('currentChatId') || 'ta';
            var char = DATA.Character.get(chatId);
            if (!char) {
                // 兜底
                char = { id: chatId, name: 'TA', avatar: '', remark: '' };
            }

            // 打开弹窗
            CORE.openPopup && CORE.openPopup('characterProfile');

            // 回填
            setTimeout(function () {
                var box = $('.popup-character-profile');
                if (!box) return;

                var nameInput = box.querySelector('.character-name-input');
                var remarkInput = box.querySelector('.character-remark-input');
                var avatarPreview = box.querySelector('.character-avatar-preview');

                if (nameInput) nameInput.value = char.name || '';
                if (remarkInput) remarkInput.value = char.remark || '';
                if (avatarPreview && char.avatar) {
                    avatarPreview.style.backgroundImage = 'url(' + char.avatar + ')';
                    avatarPreview.style.backgroundSize = 'cover';
                    avatarPreview.style.backgroundPosition = 'center';
                }
            }, 100);
        },

        // 保存资料
        save: function () {
            var box = $('.popup-character-profile');
            if (!box) return;

            var chatId = STATE.get('currentChatId') || 'ta';
            var nameInput = box.querySelector('.character-name-input');
            var remarkInput = box.querySelector('.character-remark-input');
            var avatarPreview = box.querySelector('.character-avatar-preview');

            var patch = {
                name: (nameInput && nameInput.value || '').trim() || 'TA',
                remark: (remarkInput && remarkInput.value || '').trim()
            };

            // 头像从预览元素的 background-image 取
            if (avatarPreview) {
                var bg = avatarPreview.style.backgroundImage;
                var m = bg && bg.match(/url\(["']?(.+?)["']?\)/);
                if (m) patch.avatar = m[1];
            }

            DATA.Character.update(chatId, patch);

            // 同步聊天列表
            DATA.Chat.updateChat(chatId, { name: patch.name });

            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');

            // 刷新界面
            Chat.renderList && Chat.renderList();
            Chat.renderRoom && Chat.renderRoom();
        },

        // 上传头像
        uploadAvatar: function () {
            var IMG = global.APP_IMG;
            if (!IMG || !IMG.pickAndSquare) {
                ENV.tip && ENV.tip('图片模块未加载');
                return;
            }

            IMG.pickAndSquare({ size: 200, quality: 0.9, circle: false }).then(function (dataUrl) {
                var box = $('.popup-character-profile');
                if (!box) return;
                var preview = box.querySelector('.character-avatar-preview');
                if (preview) {
                    preview.style.backgroundImage = 'url(' + dataUrl + ')';
                    preview.style.backgroundSize = 'cover';
                    preview.style.backgroundPosition = 'center';
                }
                ENV.tip && ENV.tip('头像已选择，点保存生效');
            }).catch(function (err) {
                if (err && err.message === '未选择文件') return;
                ENV.tip && ENV.tip('上传失败');
            });
        }
    };

    /* ============================================================
     * 3. 信件 Letter
     * ============================================================ */
    var Letter = {
        _currentTab: 'send',
        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            this._renderTab('.tab-send', DATA.Letter.listSent(), 'sent');
            this._renderTab('.tab-receive', DATA.Letter.listReceived(), 'received');
            this._renderTab('.tab-time', DATA.Letter.listTime(), 'time');
        },

        _renderTab: function (sel, list, type) {
            var el = $(sel);
            if (!el) return;

            if (list.length === 0) {
                return;
            }

            el.innerHTML = list.map(function (l) {
                return '<div class="letter-item" data-id="' + l.id + '" data-type="' + type + '" style="background:#f8f8f8;border-radius:14px;padding:16px;margin-bottom:12px;cursor:pointer">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                        '<h4 style="font-size:15px;font-weight:600;margin:0">' + esc(l.title || '无题') + '</h4>' +
                        '<span style="font-size:12px;color:#999">' + Time.fromNow(l.createdAt) + '</span>' +
                    '</div>' +
                    '<p style="font-size:13px;color:#666;line-height:1.5;margin:0">' + esc(Str.truncate(l.content || '', 60)) + '</p>' +
                '</div>';
            }).join('');
        },

        write: function () {
            openModal({
                title: '提笔写信',
                fields: [
                    { key: 'title', label: '标题', type: 'text', value: '给 TA 的信', placeholder: '写个标题…' },
                    { key: 'content', label: '正文', type: 'textarea', placeholder: '想对 TA 说些什么…' }
                ],
                buttons: [
                    { text: '取消' },
                    { text: '寄出', primary: true, onClick: function (v) {
                        var content = (v.content || '').trim();
                        if (!content) { ENV.tip && ENV.tip('正文不能为空'); return false; }
                        Letter._doSendLetter(v.title || '无题', content);
                    }}
                ]
            });
        },

        _doSendLetter: function (title, content) {
            DATA.Letter.addSent({ title: title, content: content });

            if (MOOD.onLetterSent) MOOD.onLetterSent();

            this.render();
            ENV.tip && ENV.tip('信已寄出');

            var prob = DATA.Settings.getOne('letter.taWriteProbability') || 0.65;
            if (Num.chance(prob)) {
                var self = this;
                var waitTime = Num.randInt(
                    DATA.Settings.getOne('letter.minWriteTime') || 5,
                    DATA.Settings.getOne('letter.maxWriteTime') || 30
                );
                setTimeout(function () {
                    var text = REPLY.pick(REPLY.LETTER_REPLY.replyStart) + '，'
                        + REPLY.pick(REPLY.DAILY_REPLY.missYou) + '。'
                        + REPLY.pick(REPLY.LETTER_REPLY.replyEnd);
                    DATA.Letter.addReceived({
                        title: '给你的回信',
                        content: text
                    });
                    if (MOOD.onLetterReceived) MOOD.onLetterReceived();
                    ENV.notifyLetter && ENV.notifyLetter({ id: uid('l'), title: '收到一封回信' });
                    self.render();
                }, waitTime * 1000);
            }
        },

        openLetter: function (id, type) {
            var list = type === 'sent' ? DATA.Letter.listSent()
                : type === 'received' ? DATA.Letter.listReceived()
                : DATA.Letter.listTime();
            var letter = Obj.findById(list, id);
            if (!letter) return;

            openModal({
                title: letter.title || '无题',
                fields: [
                    { key: 'content', label: Time.formatFull(letter.createdAt), type: 'textarea', value: letter.content || '' }
                ],
                buttons: [
                    { text: '删除', onClick: function () {
                        confirmDialog('确定删除这封信吗？', function () {
                            DATA.Letter.remove(type, id);
                            Letter.render();
                            ENV.tip && ENV.tip('已删除');
                        });
                        return false;
                    }},
                    { text: '关闭', primary: true }
                ],
                onOpen: function (box) {
                    var ta = box.querySelector('textarea');
                    if (ta) {
                        ta.disabled = true;
                        ta.style.background = '#fff';
                        ta.style.color = '#333';
                        ta.style.border = 'none';
                        ta.style.minHeight = '180px';
                    }
                }
            });
        }
    };

    /* ============================================================
     * 4. 朋友圈 Moments
     * ============================================================ */
    var Moments = {
        init: function () { this.render(); this.renderBg(); },
        onEnter: function () { this.render(); this.renderBg(); },

        renderBg: function () {
            var el = $('#momentsBgChange');
            if (!el) return;
            var bg = DATA.Moments.getBg();
            if (bg) {
                if (bg.indexOf('http') === 0 || bg.indexOf('data:') === 0) {
                    el.style.backgroundImage = 'url(' + bg + ')';
                    el.style.backgroundSize = 'cover';
                    el.style.backgroundPosition = 'center';
                } else {
                    el.style.background = bg;
                }
            }
        },

        render: function () {
            var container = $('.moments-list-container');
            if (!container) return;

            var list = DATA.Moments.list();
            if (list.length === 0) {
                container.innerHTML = '<div class="empty-tip">还没有动态</div>';
                return;
            }

            var self = this;
            container.innerHTML = list.map(function (m) {
                var likesHtml = (m.likes || []).length > 0
                    ? '<div style="font-size:13px;color:#888;margin-top:8px">❤️ ' + (m.likes || []).length + ' 人点赞</div>'
                    : '';
                var commentsHtml = (m.comments || []).length > 0
                    ? '<div style="background:#f8f8f8;border-radius:8px;padding:8px;margin-top:8px">'
                        + (m.comments || []).map(function (c) {
                            return '<div style="font-size:13px;margin:2px 0"><b style="color:#666">' + esc(c.from === 'me' ? '我' : 'TA') + '：</b>' + esc(c.text) + '</div>';
                        }).join('')
                      + '</div>'
                    : '';

                return '<div class="moment-card" data-id="' + m.id + '" style="padding:16px 0;border-bottom:1px solid #f2f2f2">' +
                    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
                        '<div class="avatar avatar-' + (m.authorName === 'TA' ? 'ta' : 'me') + '-small"></div>' +
                        '<span style="font-size:14px;font-weight:500">' + esc(m.authorName || '我') + '</span>' +
                        '<span style="font-size:12px;color:#999;margin-left:auto">' + Time.fromNow(m.createdAt) + '</span>' +
                    '</div>' +
                    '<p style="font-size:14px;line-height:1.5;margin:0 0 8px">' + esc(m.text || '') + '</p>' +
                    '<div style="display:flex;gap:20px;font-size:13px;color:#666;margin-top:8px">' +
                        '<span class="moment-like" data-id="' + m.id + '" style="cursor:pointer">' + ((m.likes || []).indexOf('me') > -1 ? '❤️ 已赞' : '🤍 点赞') + '</span>' +
                        '<span class="moment-comment" data-id="' + m.id + '" style="cursor:pointer">💬 评论</span>' +
                    '</div>' +
                    likesHtml + commentsHtml +
                '</div>';
            }).join('');
        },

        publish: function () {
            var input = $('.moment-input');
            if (!input) return;
            var text = (input.value || '').trim();
            if (!text) { ENV.tip && ENV.tip('写点什么再发吧'); return; }

            DATA.Moments.add({ text: text, authorName: '我' });
            input.value = '';
            CORE.closePopup && CORE.closePopup();

            this.render();
            ENV.tip && ENV.tip('已发布');

            var self = this;
            if (Num.chance(0.7)) {
                setTimeout(function () {
                    var post = DATA.Moments.list()[0];
                    if (!post) return;
                    var comment = REPLY.pick(REPLY.MOMENTS_REPLY.comment);
                    DATA.Moments.comment(post.id, { from: 'ta', text: comment });
                    if (MOOD.onMomentLiked) MOOD.onMomentLiked();
                    ENV.tip && ENV.tip('TA 评论了你的朋友圈');
                    self.render();
                }, Num.randInt(3, 10) * 1000);
            }

            // 【v3 修复】30% 概率梦角立刻来看
            if (global.APP_MOMENTS_VISITS && Num.chance(0.3)) {
                setTimeout(function () {
                    global.APP_MOMENTS_VISITS.taVisit();
                }, Num.randInt(3, 10) * 1000);
            }
        },

        toggleLike: function (postId) {
            var post = DATA.Moments.get(postId);
            if (!post) return;
            post.likes = post.likes || [];
            var idx = post.likes.indexOf('me');
            if (idx > -1) {
                DATA.Moments.unlike(postId, 'me');
            } else {
                DATA.Moments.like(postId, 'me');
                if (MOOD.onMomentLiked) MOOD.onMomentLiked();
            }
            this.render();
        },

        addComment: function (postId) {
            openModal({
                title: '评论',
                fields: [
                    { key: 'text', label: '', type: 'textarea', placeholder: '写点什么…' }
                ],
                buttons: [
                    { text: '取消' },
                    { text: '发布', primary: true, onClick: function (v) {
                        var text = (v.text || '').trim();
                        if (!text) return false;
                        DATA.Moments.comment(postId, { from: 'me', text: text });
                        Moments.render();
                        ENV.tip && ENV.tip('评论成功');

                        if (Num.chance(0.6)) {
                            setTimeout(function () {
                                DATA.Moments.comment(postId, {
                                    from: 'ta',
                                    text: REPLY.pick(REPLY.MOMENTS_REPLY.comment)
                                });
                                Moments.render();
                            }, Num.randInt(3, 8) * 1000);
                        }
                    }}
                ]
            });
        },

        changeBg: function () {
            openModal({
                title: '更换背景',
                fields: [
                    { key: 'type', label: '选择方式', type: 'select', options: [
                        { value: 'color', label: '纯色背景' },
                        { value: 'upload', label: '上传图片' }
                    ]}
                ],
                buttons: [
                    { text: '取消' },
                    { text: '确定', primary: true, onClick: function (v) {
                        if (v.type === 'upload') {
                            var IMG = global.APP_IMG;
                            if (IMG && IMG.handleMomentsBgUpload) {
                                IMG.handleMomentsBgUpload();
                            }
                        } else {
                            var colors = ['#fce4ec', '#e2f8e9', '#fff4cc', '#e0edff', '#ede2ff', '#f1f1f1', '#e8f5e9'];
                            DATA.Moments.setBg(Num.randPick(colors));
                            Moments.renderBg();
                            ENV.tip && ENV.tip('已更换');
                        }
                    }}
                ]
            });
        },

        taPost: function () {
            var prob = DATA.Settings.getOne('moments.taPostProbability');
            if (!Num.chance(prob === undefined ? 1 : prob)) return;
            var text = REPLY.pick(REPLY.MOMENTS_REPLY.post);
            DATA.Moments.add({ text: text, authorName: 'TA' });
            this.render();
            ENV.notifyMoments && ENV.notifyMoments({ id: uid('m'), text: text });
        }
    };

    /* ============================================================
     * 5. 经期 Period
     * ============================================================ */
    var Period = {
        _currentMonth: new Date(),
        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            this.renderCalendar(this._currentMonth);
            this.renderHistory();
            this.renderStats();
        },

        renderCalendar: function (date) {
            var grid = $('.calendar-grid');
            var monthEl = $('.calendar-month');
            if (!grid) return;

            var y = date.getFullYear();
            var m = date.getMonth() + 1;
            if (monthEl) monthEl.textContent = y + ' 年 ' + m + ' 月';

            var firstDay = Time.firstDayOfMonth(y, m);
            var days = Time.daysInMonth(y, m);
            var today = Time.formatDate();

            var records = DATA.Period.listRecords();
            var recordDates = {};
            records.forEach(function (r) { recordDates[r.date] = r; });

            var predictDates = {};
            var settings = DATA.Period.getSettings();
            var cycle = settings.cycleLength || 28;
            if (records.length > 0) {
                var lastStart = records[0].date;
                var predict = new Date(lastStart);
                predict.setDate(predict.getDate() + cycle);
                for (var i = -1; i <= 4; i++) {
                    var pd = new Date(predict);
                    pd.setDate(pd.getDate() + i);
                    predictDates[Time.formatDate(pd)] = true;
                }
            }

            var html = '<div class="calendar-week">日</div><div class="calendar-week">一</div><div class="calendar-week">二</div><div class="calendar-week">三</div><div class="calendar-week">四</div><div class="calendar-week">五</div><div class="calendar-week">六</div>';

            for (var i = 0; i < firstDay; i++) {
                html += '<div class="calendar-day"></div>';
            }

            for (var d = 1; d <= days; d++) {
                var dateStr = y + '-' + Time.pad(m) + '-' + Time.pad(d);
                var isToday = dateStr === today;
                var isRecord = !!recordDates[dateStr];
                var isPredict = !!predictDates[dateStr];
                var cls = 'calendar-day';
                if (isToday) cls += ' active';
                if (isRecord) cls += ' period-record';
                else if (isPredict) cls += ' period-predict';

                var style = '';
                if (isRecord) style = 'background:#ff6b81;color:#fff;';
                else if (isPredict) style = 'background:#ffe0e6;color:#d84b80;';

                html += '<div class="' + cls + '" data-date="' + dateStr + '" style="' + style + '">' + d + '</div>';
            }

            grid.innerHTML = html;
        },

        renderHistory: function () {
            var card = $('.period-history-card');
            if (!card) return;
            var records = DATA.Period.listRecords();
            var list = card.querySelector('.period-history-list');

            if (records.length === 0) {
                if (list) list.remove();
                var tip = card.querySelector('.empty-tip');
                if (!tip) {
                    var p = document.createElement('p');
                    p.className = 'empty-tip';
                    p.textContent = '还没有记录，标记本次经期开始后会显示在这里';
                    card.appendChild(p);
                }
                return;
            }

            var tip = card.querySelector('.empty-tip');
            if (tip) tip.remove();

            var html = records.slice(0, 20).map(function (r) {
                return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f2f2f2;font-size:14px">' +
                    '<span>' + esc(r.date) + '</span>' +
                    '<span style="color:#999">' + esc(r.type || '经期') + '</span>' +
                '</div>';
            }).join('');

            if (!list) {
                list = document.createElement('div');
                list.className = 'period-history-list';
                card.appendChild(list);
            }
            list.innerHTML = html;
        },

        renderStats: function () {
            var card = $('.period-stat-card');
            if (!card) return;
            var records = DATA.Period.listRecords();
            var body = card.querySelector('.period-stat-body');
            if (!body) {
                body = document.createElement('div');
                body.className = 'period-stat-body';
                card.appendChild(body);
            }

            if (records.length < 2) {
                body.innerHTML = '<p style="color:#888;font-size:13px;margin:8px 0 0">继续记录几次经期后，这里会有周期洞察。</p>';
                return;
            }

            var intervals = [];
            for (var i = 0; i < records.length - 1; i++) {
                var d1 = new Date(records[i].date);
                var d2 = new Date(records[i + 1].date);
                var diff = Math.abs((d1 - d2) / 86400000);
                if (diff > 15 && diff < 60) intervals.push(diff);
            }
            var avg = intervals.length > 0 ? Math.round(intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length) : 0;

            body.innerHTML =
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">' +
                    '<div style="background:#fff;border-radius:12px;padding:12px;text-align:center">' +
                        '<p style="font-size:12px;color:#999;margin:0 0 4px">平均周期</p>' +
                        '<p style="font-size:22px;font-weight:600;margin:0">' + (avg || '—') + '<span style="font-size:13px;color:#999"> 天</span></p>' +
                    '</div>' +
                    '<div style="background:#fff;border-radius:12px;padding:12px;text-align:center">' +
                        '<p style="font-size:12px;color:#999;margin:0 0 4px">记录次数</p>' +
                        '<p style="font-size:22px;font-weight:600;margin:0">' + records.length + '<span style="font-size:13px;color:#999"> 次</span></p>' +
                    '</div>' +
                '</div>';
        },

        markStart: function () {
            var today = Time.formatDate();
            var exist = DATA.Period.listRecords().filter(function (r) { return r.date === today; })[0];
            if (exist) { ENV.tip && ENV.tip('今天已记录过'); return; }

            DATA.Period.addRecord({ date: today, type: '经期开始' });
            this.render();
            ENV.tip && ENV.tip('已记录');
            if (MOOD.set) MOOD.set('calm', 55, { source: 'period' });

            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.addMessage(chatId, {
                from: 'ta',
                text: REPLY.pick(REPLY.PERIOD_REPLY.record),
                type: 'text'
            });
        },

        recordToday: function () {
            var today = Time.formatDate();
            var exist = DATA.Period.listRecords().filter(function (r) { return r.date === today; })[0];
            if (exist) { ENV.tip && ENV.tip('今天已记录过'); return; }
            DATA.Period.addRecord({ date: today, type: '经期' });
            this.render();
            ENV.tip && ENV.tip('已记录');
        },

        prevMonth: function () {
            this._currentMonth = new Date(this._currentMonth);
            this._currentMonth.setMonth(this._currentMonth.getMonth() - 1);
            this.renderCalendar(this._currentMonth);
        },
        nextMonth: function () {
            this._currentMonth = new Date(this._currentMonth);
            this._currentMonth.setMonth(this._currentMonth.getMonth() + 1);
            this.renderCalendar(this._currentMonth);
        },

        openDayDetail: function (dateStr) {
            var current = DATA.Period.getSymptom(dateStr) || {};
            var symptomList = ['腹痛', '腰酸', '头痛', '情绪波动', '疲劳', '乳房胀痛', '食欲变化', '失眠'];

            var html = symptomList.map(function (s) {
                var checked = current[s] ? 'checked' : '';
                return '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px">' +
                    '<input type="checkbox" data-symptom="' + s + '" ' + checked + '>' + s +
                '</label>';
            }).join('');

            openModal({
                title: dateStr + ' 症状记录',
                fields: [{ key: 'note', label: '备注', type: 'textarea', value: current.note || '', placeholder: '其他想记的…' }],
                buttons: [
                    { text: '取消' },
                    { text: '保存', primary: true, onClick: function (v, box) {
                        var symptoms = { note: v.note || '' };
                        box.querySelectorAll('input[data-symptom]').forEach(function (cb) {
                            if (cb.checked) symptoms[cb.getAttribute('data-symptom')] = true;
                        });
                        DATA.Period.setSymptom(dateStr, symptoms);
                        ENV.tip && ENV.tip('已保存');
                    }}
                ],
                onOpen: function (box) {
                    var ta = box.querySelector('textarea');
                    if (ta && ta.parentNode) {
                        var wrap = document.createElement('div');
                        wrap.innerHTML = html;
                        ta.parentNode.parentNode.insertBefore(wrap, ta.parentNode);
                    }
                }
            });
        },

        openMonthReport: function () {
            var y = this._currentMonth.getFullYear();
            var m = this._currentMonth.getMonth() + 1;
            var prefix = y + '-' + Time.pad(m);
            var records = DATA.Period.listRecords().filter(function (r) {
                return r.date.indexOf(prefix) === 0;
            });

            var symptoms = DATA.Period.getSettings().symptoms || {};
            var symptomCount = {};
            Object.keys(symptoms).forEach(function (date) {
                if (date.indexOf(prefix) !== 0) return;
                Object.keys(symptoms[date]).forEach(function (k) {
                    if (k === 'note') return;
                    symptomCount[k] = (symptomCount[k] || 0) + 1;
                });
            });

            openModal({
                title: y + ' 年 ' + m + ' 月报告',
                fields: [
                    { key: 'content', type: 'textarea', value: '', label: '' }
                ],
                buttons: [{ text: '关闭', primary: true }],
                onOpen: function (box) {
                    var ta = box.querySelector('textarea');
                    ta.style.display = 'none';
                    var div = document.createElement('div');

                    var topHtml = '<div style="background:#f8f8f8;border-radius:14px;padding:16px;margin-bottom:14px">' +
                            '<p style="font-size:13px;color:#999;margin:0 0 6px">本月经期天数</p>' +
                            '<p style="font-size:28px;font-weight:600;margin:0">' + records.length + '<span style="font-size:14px;color:#999"> 天</span></p>' +
                        '</div>';

                    var chartHtml = '';
                    if (Object.keys(symptomCount).length > 0) {
                        chartHtml = '<div style="background:#f8f8f8;border-radius:14px;padding:16px">' +
                            '<p style="font-size:13px;color:#999;margin:0 0 10px">症状统计</p>' +
                            '<canvas id="periodSymptomChart" style="width:100%;height:160px"></canvas>' +
                        '</div>';
                    } else {
                        chartHtml = '<div style="background:#f8f8f8;border-radius:14px;padding:16px;text-align:center;color:#999;font-size:13px">本月没有症状记录</div>';
                    }

                    div.innerHTML = topHtml + chartHtml;
                    ta.parentNode.appendChild(div);

                    if (Object.keys(symptomCount).length > 0 && CHART.doughnut) {
                        setTimeout(function () {
                            var canvas = document.getElementById('periodSymptomChart');
                            if (!canvas) return;
                            var data = Object.keys(symptomCount).map(function (k, i) {
                                return {
                                    label: k,
                                    value: symptomCount[k],
                                    color: (CHART.COLORS && CHART.COLORS[i % CHART.COLORS.length]) || '#4299e1'
                                };
                            });
                            CHART.doughnut(canvas, {
                                data: data,
                                centerText: String(data.reduce(function (s, d) { return s + d.value; }, 0)),
                                centerSubText: '次',
                                showLegend: true
                            });
                        }, 100);
                    }
                }
            });
                    // 【新增】保存经期提醒设置
        saveNotifySettings: function () {
            var box = $('.popup-period-notify');
            if (!box) return;
            var checks = $$('input[type="checkbox"]', box);
            var input = box.querySelector('input[type="number"]');
            var s = DATA.Settings.getOne('period') || {};
            if (checks[0]) s.notifyEnabled = checks[0].checked;
            if (input) s.notifyAheadDays = Number(input.value) || 2;
            if (checks[1]) s.notifyEndEnabled = checks[1].checked;
            DATA.Settings.setOne('period', s);
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
        },

        // 【新增】打开发送方式弹窗时回填提醒设置
        fillNotifySettings: function () {
            var box = $('.popup-period-notify');
            if (!box) return;
            var s = DATA.Settings.getOne('period') || {};
            var checks = $$('input[type="checkbox"]', box);
            var input = box.querySelector('input[type="number"]');
            if (checks[0]) checks[0].checked = s.notifyEnabled !== false;
            if (input) input.value = s.notifyAheadDays || 2;
            if (checks[1]) checks[1].checked = !!s.notifyEndEnabled;
        },
        // 【新增】保存经期周期设置
        savePeriodSettings: function () {
            var box = $('.popup-period-setting');
            if (!box) return;
            var inputs = $$('input[type="number"]', box);
            var s = DATA.Period.getSettings();
            if (inputs[0]) s.cycleLength = Number(inputs[0].value) || 28;
            if (inputs[1]) s.periodLength = Number(inputs[1].value) || 5;
            if (inputs[2]) s.ovulationLength = Number(inputs[2].value) || 5;
            DATA.Period.saveSettings(s);
            CORE.closePopup && CORE.closePopup();
            Period.render && Period.render();
            ENV.tip && ENV.tip('已保存');
        },

        // 【新增】打开发送方式弹窗时回填周期设置
        fillPeriodSettings: function () {
            var box = $('.popup-period-setting');
            if (!box) return;
            var s = DATA.Period.getSettings();
            var inputs = $$('input[type="number"]', box);
            if (inputs[0]) inputs[0].value = s.cycleLength || 28;
            if (inputs[1]) inputs[1].value = s.periodLength || 5;
            if (inputs[2]) inputs[2].value = s.ovulationLength || 5;
        }
    };
        }
    };

    /* ============================================================
     * 6. 消息记录 MessageRecord
     * ============================================================ */
    var MessageRecord = {
        init: function () {},
        onEnter: function () { this.render(); },

        render: function () {
            var chatId = STATE.get('currentChatId') || 'ta';
            var msgs = DATA.Chat.getMessages(chatId);

            var meCount = msgs.filter(function (m) { return m.from === 'me'; }).length;
            var taCount = msgs.filter(function (m) { return m.from !== 'me'; }).length;

            var nums = $$('.count-number');
            if (nums[0]) nums[0].textContent = meCount;
            if (nums[1]) nums[1].textContent = taCount;

            this._renderWords(msgs, 'me', 0);
            this._renderWords(msgs, 'ta', 1);
            this._renderRecent7(msgs);
        },

        _renderWords: function (msgs, from, cardIndex) {
            var cards = $$('.word-cloud-card');
            var card = cards[cardIndex];
            if (!card) return;

            var froms = msgs.filter(function (m) {
                return from === 'me' ? m.from === 'me' : m.from !== 'me';
            });

            if (froms.length === 0) return;

            var map = {};
            froms.forEach(function (m) {
                var text = (m.text || '').replace(/[，。！？\s,.!?]/g, '');
                for (var i = 0; i < text.length - 1; i++) {
                    var w = text.slice(i, i + 2);
                    if (w.length === 2) map[w] = (map[w] || 0) + 1;
                }
            });

            var top = Object.keys(map)
                .map(function (k) { return { word: k, n: map[k] }; })
                .sort(function (a, b) { return b.n - a.n; })
                .slice(0, 5);

            if (top.length === 0) return;

            var tip = card.querySelector('.empty-tip');
            if (tip) tip.remove();

            var list = card.querySelector('.word-list');
            if (!list) {
                list = document.createElement('div');
                list.className = 'word-list';
                card.appendChild(list);
            }
            list.innerHTML = top.map(function (t) {
                return '<span style="display:inline-block;background:#f0f0f0;border-radius:8px;padding:4px 10px;margin:4px;font-size:13px">' + esc(t.word) + ' × ' + t.n + '</span>';
            }).join('');
        },

        _renderRecent7: function (msgs) {
            var card = $('.recent-7-card');
            if (!card) return;

            var days = [];
            var map = {};
            for (var i = 6; i >= 0; i--) {
                var d = new Date();
                d.setDate(d.getDate() - i);
                var key = Time.formatDate(d);
                map[key] = { me: 0, ta: 0, day: d.getDate(), key: key };
                days.push(key);
            }
            msgs.forEach(function (m) {
                var k = Time.formatDate(m.time);
                if (map[k]) {
                    if (m.from === 'me') map[k].me++;
                    else map[k].ta++;
                }
            });

            var tip = card.querySelector('.empty-tip');
            if (tip) tip.remove();

            var chart = card.querySelector('.recent-chart');
            if (!chart) {
                chart = document.createElement('div');
                chart.className = 'recent-chart';
                chart.style.cssText = 'padding:8px 0';
                chart.innerHTML = '<canvas id="recent7Chart" style="width:100%;height:140px"></canvas>';
                card.appendChild(chart);
            }

            if (CHART.bar) {
                var canvas = document.getElementById('recent7Chart');
                if (!canvas) return;

                var data = days.map(function (k) {
                    return {
                        label: String(map[k].day),
                        value: map[k].me + map[k].ta
                    };
                });

                setTimeout(function () {
                    CHART.bar(canvas, {
                        data: data,
                        color: '#000',
                        highlight: '#ff4466',
                        highlightIndex: 6,
                        showValue: true,
                        showGrid: true
                    });
                }, 50);
            }
        }
    };

    /* ============================================================
     * 7. 占卜 Divination
     * ============================================================ */
    var Divination = {
        _type: 'tarot',
        _count: 1,

        init: function () {},
        selectType: function (type) { this._type = type; },
        selectCount: function (n) { this._count = n; },

        start: function () {
            var q = $('.ask-input');
            var question = q ? (q.value || '').trim() : '';
            if (!question) { ENV.tip && ENV.tip('先写下你的问题'); return; }

            ENV.tip && ENV.tip('正在洗牌…');

            var self = this;
            setTimeout(function () {
                var cards;
                if (TAROT.draw) {
                    cards = TAROT.draw(self._type, self._count);
                } else {
                    cards = [{ name: '愚者', symbol: '🃏', reversed: false, meaning: '新的开始' }];
                }

                DATA.Divination.add({
                    type: self._type,
                    question: question,
                    count: self._count,
                    cards: cards
                });

                var html = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;padding:10px 0">'
                    + cards.map(function (c) {
                        var isLarge = cards.length === 1;
                        var w = isLarge ? '150px' : (cards.length <= 3 ? '110px' : '80px');
                        var h = isLarge ? '220px' : (cards.length <= 3 ? '170px' : '120px');
                        var emoji = isLarge ? '32px' : '22px';
                        var nameSize = isLarge ? '15px' : '12px';

                        return '<div class="tarot-result-card" style="width:' + w + ';height:' + h + ';border-radius:12px;background:linear-gradient(135deg,' + (c.color || '#41346b') + ',rgba(0,0,0,0.3));color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.2)">' +
                            '<span style="font-size:' + emoji + ';margin-bottom:8px">' + (c.symbol || '🔮') + '</span>' +
                            '<span style="font-size:' + nameSize + ';font-weight:600;line-height:1.3">' + esc(c.name) + '</span>' +
                            '<span style="font-size:10px;opacity:0.8;margin-top:6px">' + (c.reversed ? '逆位' : '正位') + '</span>' +
                        '</div>';
                    }).join('')
                    + '</div>';

                openModal({
                    title: '占卜结果',
                    fields: [{ key: 'result', type: 'textarea', value: '', label: '' }],
                    buttons: [{ text: '收下结果', primary: true }],
                    onOpen: function (box) {
                        var ta = box.querySelector('textarea');
                        ta.style.display = 'none';
                        var div = document.createElement('div');

                        var meaningsHtml = cards.map(function (c) {
                            return '<div style="margin-bottom:10px;padding:10px;background:#f8f8f8;border-radius:10px">' +
                                '<p style="font-size:13px;font-weight:600;margin:0 0 4px">' + esc(c.name) + ' <span style="font-size:11px;color:#999;font-weight:400">' + (c.reversed ? '逆位' : '正位') + '</span></p>' +
                                '<p style="font-size:12px;color:#666;margin:0;line-height:1.5">' + esc(c.meaning || '') + '</p>' +
                            '</div>';
                        }).join('');

                        div.innerHTML =
                            '<p style="font-size:13px;color:#999;text-align:center;margin:0 0 12px">' + esc(question) + '</p>'
                            + html
                            + '<div style="margin-top:16px">'
                            + '<p style="font-size:13px;font-weight:600;margin:0 0 8px">牌义解读</p>'
                            + meaningsHtml
                            + '</div>';
                        ta.parentNode.appendChild(div);
                    }
                });

                if (MOOD.set) MOOD.set('calm', 60, { source: 'divination' });
            }, 800);
        }
    };

    /* ============================================================
     * 8. 收藏 Favorite
     * ============================================================ */
    var Favorite = {
        _type: 'mine',
        _multi: false,
        _selected: [],

        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            var container = $('.favorite-list-container');
            if (!container) return;
            var list = DATA.Favorite.list(this._type);
            if (list.length === 0) {
                container.innerHTML = '<p class="empty-tip">还没有收藏</p>';
                return;
            }

            container.innerHTML = list.map(function (f) {
                var selected = Favorite._selected.indexOf(f.id) > -1;
                var check = Favorite._multi
                    ? '<div style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (selected ? '#333' : '#ddd') + ';background:' + (selected ? '#333' : '#fff') + ';margin-right:10px;flex-shrink:0"></div>'
                    : '';
                return '<div class="favorite-item" data-id="' + f.id + '" style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #f2f2f2;cursor:pointer">' +
                    check +
                    '<div style="flex:1">' +
                        '<p style="font-size:14px;margin:0 0 4px">' + esc(f.text || '') + '</p>' +
                        '<p style="font-size:12px;color:#999;margin:0">' + Time.fromNow(f.createdAt) + '</p>' +
                    '</div>' +
                '</div>';
            }).join('');
        },

        toggleMulti: function () {
            this._multi = !this._multi;
            this._selected = [];
            var footer = $('.multi-select-footer');
            if (footer) footer.classList.toggle('active', this._multi);
            var btn = $('.btn-multi-select');
            if (btn) btn.textContent = this._multi ? '取消' : '多选';
            this.render();
        },

        toggleSelect: function (id) {
            var i = this._selected.indexOf(id);
            if (i > -1) this._selected.splice(i, 1);
            else this._selected.push(id);
            this.render();
        },

        deleteSelected: function () {
            if (this._selected.length === 0) { ENV.tip && ENV.tip('没有选中'); return; }
            var self = this;
            confirmDialog('确定删除选中的 ' + this._selected.length + ' 项吗？', function () {
                DATA.Favorite.removeMany(self._type, self._selected);
                self._selected = [];
                self.render();
                ENV.tip && ENV.tip('已删除');
            });
        }
    };

    /* ============================================================
     * 9. 音乐 Music
     * ============================================================ */
    var Music = {
        _tab: 'library',
        _multi: false,           // 【新增】是否多选模式
        _selected: [],           // 【新增】选中的歌曲 id

        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            this._renderPlaylists();
            this._renderMusicList();
        },

        _renderPlaylists: function () {
            var el = $('.playlist-list');
            if (!el) return;
            var list = DATA.Music.listPlaylists();
            if (list.length === 0) {
                el.innerHTML = '<p class="empty-tip">暂无歌单</p>';
                return;
            }
            el.innerHTML = list.map(function (p) {
                return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f2f2f2">' +
                    '<div style="width:40px;height:40px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center">🎵</div>' +
                    '<div style="flex:1"><p style="font-size:14px;margin:0">' + esc(p.name) + '</p>' +
                    '<p style="font-size:12px;color:#999;margin:2px 0 0">' + (p.songs || []).length + ' 首</p></div>' +
                '</div>';
            }).join('');
        },

             _renderMusicList: function () {
            var container = $('.music-list-container');
            if (!container) return;

            var list = DATA.Music.listLibrary();
            if (list.length === 0) {
                container.innerHTML = '<p class="empty-tip">还没有音乐</p>';
                return;
            }

            var self = this;

            container.innerHTML = list.map(function (s, i) {
                // 【新增】多选模式下：显示勾选框，隐藏播放和删除
                var checkbox = self._multi
                    ? '<div class="music-check" style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (self._selected.indexOf(s.id) > -1 ? '#000' : '#ddd') + ';background:' + (self._selected.indexOf(s.id) > -1 ? '#000' : '#fff') + ';color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + (self._selected.indexOf(s.id) > -1 ? '✓' : '') + '</div>'
                    : '';

                var playBtn = self._multi
                    ? ''
                    : '<button class="music-play-btn" data-index="' + i + '" style="border:none;background:#000;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer">▶</button>';

                var delBtn = self._multi
                    ? ''
                    : '<button class="music-del-btn" data-id="' + s.id + '" style="border:none;background:transparent;color:#999;font-size:18px;cursor:pointer;padding:0 6px">×</button>';

                return '<div class="music-item" data-id="' + s.id + '" data-index="' + i + '" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f2f2f2;cursor:pointer">' +
                    checkbox +
                    '<div style="width:44px;height:44px;background:#f0f0f0;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px">🎵</div>' +
                    '<div style="flex:1">' +
                        '<p style="font-size:15px;margin:0 0 2px">' + esc(s.title || '未知歌曲') + '</p>' +
                        '<p style="font-size:12px;color:#999;margin:0">' + esc(s.author || '') + '</p>' +
                    '</div>' +
                    playBtn +
                    delBtn +
                '</div>';
            }).join('');

            // 【新增】多选模式下渲染底部操作栏
            self._renderMultiBar();
        },

        // 【新增】渲染底部操作栏
        _renderMultiBar: function () {
            var old = $('.music-multi-bar');
            if (old) old.parentNode.removeChild(old);

            if (!this._multi) return;

            var bar = document.createElement('div');
            bar.className = 'music-multi-bar';
            bar.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:1px solid #eee;padding:12px 16px;display:flex;gap:12px;z-index:900';

            bar.innerHTML =
                '<button class="music-multi-all" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:14px;background:#fff;font-size:15px;cursor:pointer">全选</button>' +
                '<button class="music-multi-del" style="flex:1;padding:12px;border:none;border-radius:14px;background:#ff4466;color:#fff;font-size:15px;cursor:pointer">删除选中（' + this._selected.length + '）</button>' +
                '<button class="music-multi-cancel" style="flex:1;padding:12px;border:1px solid #ddd;border-radius:14px;background:#fff;font-size:15px;cursor:pointer">取消</button>';

            document.body.appendChild(bar);
        },

        // 【新增】切换多选模式
        toggleMulti: function () {
            this._multi = !this._multi;
            this._selected = [];
            this.render();
            var btn = $('.btn-batch-manage');
            if (btn) btn.textContent = this._multi ? '完成' : '批量管理';
            if (ENV.tip) ENV.tip(this._multi ? '已进入批量管理' : '已退出');
        },

        // 【新增】选中/取消某首歌
        toggleSelectSong: function (id) {
            var i = this._selected.indexOf(id);
            if (i > -1) this._selected.splice(i, 1);
            else this._selected.push(id);
            this.render();
        },

        // 【新增】全选
        selectAllSongs: function () {
            var list = DATA.Music.listLibrary();
            if (this._selected.length === list.length) {
                this._selected = [];
            } else {
                this._selected = list.map(function (s) { return s.id; });
            }
            this.render();
        },

        // 【新增】删除选中
        deleteSelectedSongs: function () {
            if (this._selected.length === 0) {
                if (ENV.tip) ENV.tip('没有选中');
                return;
            }
            var self = this;
            var n = this._selected.length;
            var go = function () {
                self._selected.forEach(function (id) {
                    DATA.Music.remove(id);
                });
                self._selected = [];
                self._multi = false;
                self.render();
                var btn = $('.btn-batch-manage');
                if (btn) btn.textContent = '批量管理';
                if (ENV.tip) ENV.tip('已删除 ' + n + ' 首');
            };
            if (typeof confirmDialog === 'function') {
                confirmDialog('确定删除选中的 ' + n + ' 首歌吗？', go);
            } else {
                if (confirm('确定删除选中的 ' + n + ' 首歌吗？')) go();
            }
        },

        add: function () {
            var input = $('.music-link-input');
            var link = input ? (input.value || '').trim() : '';
            if (!link) { ENV.tip && ENV.tip('粘贴歌曲链接'); return; }

            var title = '新歌 ' + (DATA.Music.listLibrary().length + 1);
            var author = '未知';

            DATA.Music.add({
                title: title,
                author: author,
                url: link,
                link: link
            });

            if (input) input.value = '';
            CORE.closePopup && CORE.closePopup();
            this.render();
            ENV.tip && ENV.tip('已添加');
        },

        play: function (index) {
            if (!AUDIO.playFromLibrary) { ENV.tip && ENV.tip('播放器未加载'); return; }
            var ok = AUDIO.playFromLibrary(null, index);
            if (ok) {
                var song = AUDIO.getCurrent();
                ENV.tip && ENV.tip('正在播放：' + (song ? song.title : ''));
            } else {
                ENV.tip && ENV.tip('这首歌没有可播放的链接');
            }
        },

        remove: function (id) {
            var self = this;
            confirmDialog('确定删除这首歌吗？', function () {
                DATA.Music.remove(id);
                self.render();
                ENV.tip && ENV.tip('已删除');
            });
        },

        openAddDialog: function () {
            CORE.openPopup && CORE.openPopup('addMusic');
        },

        openPlaylistDialog: function () {
            CORE.openPopup && CORE.openPopup('managePlaylist');
        },

        createPlaylist: function () {
            openModal({
                title: '新建歌单',
                fields: [{ key: 'name', label: '歌单名称', type: 'text', placeholder: '如：深夜单曲循环' }],
                buttons: [
                    { text: '取消' },
                    { text: '创建', primary: true, onClick: function (v) {
                        if (!v.name) return false;
                        DATA.Music.addPlaylist({ name: v.name.trim() });
                        Music._renderPlaylists();
                        ENV.tip && ENV.tip('已创建');
                    }}
                ]
            });
        },

        tryInvite: function () {
            var prob = DATA.Settings.getOne('music.listenTogetherProbability') || 0.15;
            if (!Num.chance(prob)) return;
            CORE.openPopup && CORE.openPopup('listenTogether');
        },

        acceptInvite: function () {
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('一起听歌中…');
            if (MOOD.onListenTogether) MOOD.onListenTogether();
            if (AUDIO.playFromLibrary) AUDIO.playFromLibrary(null, 0);
        }
    };

    /* ============================================================
     * 10. 提问 Question
     * ============================================================ */
    var Question = {
        _type: 'mine',
        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            var container = $('.question-list-container');
            if (!container) return;
            var list = DATA.Question.list(this._type);
            if (list.length === 0) {
                container.innerHTML = '<p class="empty-tip">还没有提问</p>';
                return;
            }

            container.innerHTML = list.map(function (q) {
                var optionsHtml = (q.options || []).map(function (o, i) {
                    var selected = q.answer && q.answer.indexOf(o.text) > -1;
                    return '<div class="q-option" data-qid="' + q.id + '" data-opt="' + esc(o.text) + '" style="padding:10px 12px;border:1px solid ' + (selected ? '#333' : '#e5e5e5') + ';border-radius:10px;margin-bottom:8px;cursor:pointer;background:' + (selected ? '#f5f5f5' : '#fff') + ';font-size:14px">' + esc(o.text) + (selected ? ' ✓' : '') + '</div>';
                }).join('');

                var answerHtml = q.answer
                    ? '<div style="margin-top:10px;font-size:13px;color:#666;background:#f8f8f8;padding:10px;border-radius:8px">回答：' + esc(q.answer.join('、')) + '</div>'
                    : '';

                return '<div style="padding:14px 0;border-bottom:1px solid #f2f2f2">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:6px">' +
                        '<p style="font-size:15px;font-weight:500;margin:0">' + esc(q.content || '') + '</p>' +
                        '<span style="font-size:11px;color:#999">' + (q.type === 'multi' ? '多选' : '单选') + '</span>' +
                    '</div>' +
                    '<div style="font-size:12px;color:#999;margin-bottom:10px">' + Time.fromNow(q.createdAt) + '</div>' +
                    '<div class="q-options">' + optionsHtml + '</div>' +
                    answerHtml +
                '</div>';
            }).join('');
        },

        addOption: function () {
            var list = $('.question-option-list');
            if (!list) return;
            var n = list.children.length + 1;
            var div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = '<input type="text" placeholder="选项' + n + '">';
            list.appendChild(div);
        },

        submit: function () {
            var contentEl = $('.question-content-input');
            var content = contentEl ? (contentEl.value || '').trim() : '';
            if (!content) { ENV.tip && ENV.tip('输入问题内容'); return; }

            var typeEl = document.querySelector('input[name="questionType"]:checked');
            var type = typeEl ? typeEl.value : 'single';

            var options = $$('.question-option-list .option-item input').map(function (i) {
                return { text: (i.value || '').trim() };
            }).filter(function (o) { return o.text; });

            if (options.length < 2) { ENV.tip && ENV.tip('至少 2 个选项'); return; }

            DATA.Question.add(this._type, {
                content: content,
                type: type,
                options: options
            });

            if (contentEl) contentEl.value = '';
            CORE.closePopup && CORE.closePopup();
            this.render();
            ENV.tip && ENV.tip('已提交');

            if (this._type === 'mine') {
                var self = this;
                setTimeout(function () {
                    var list = DATA.Question.list('mine');
                    var q = list[0];
                    if (!q) return;
                    var answer = Num.randPickMany(q.options, 1).map(function (o) { return o.text; });
                    DATA.Question.update('mine', q.id, { answer: answer });
                    self.render();
                    ENV.notify({ title: 'TA 回答了', body: answer[0], icon: '💬', timeout: 3000 });
                }, Num.randInt(3, 8) * 1000);
            }
        },

        answer: function (qid, optText) {
            var q = DATA.Question.get(this._type, qid);
            if (!q) return;

            var answer = q.answer || [];
            if (q.type === 'multi') {
                var i = answer.indexOf(optText);
                if (i > -1) answer.splice(i, 1);
                else answer.push(optText);
            } else {
                answer = [optText];
            }
            DATA.Question.update(this._type, qid, { answer: answer });
            this.render();

            // 【v3 修复】通知 TA 引擎（TA 会对答案说话）
            if (global.APP_QUESTION_ENGINE && this._type === 'ta') {
                global.APP_QUESTION_ENGINE.onUserAnswer(qid, optText);
                setTimeout(function () {
                    global.APP_QUESTION_ENGINE.maybeAskAnother();
                }, 5000);
            }
        }
    };

    /* ============================================================
     * 11. 喝水 Water
     * ============================================================ */
    var Water = {
        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        render: function () {
            var today = DATA.Water.getToday();
            var settings = DATA.Water.getSettings();

            $$('.water-count-number, .water-num-big').forEach(function (el) { el.textContent = today.cups; });
            $$('.water-count-desc').forEach(function (el) {
                el.textContent = today.cups + ' 杯 · ' + today.ml + ' ml / '
                    + settings.dailyGoalCups + ' 杯 · ' + (settings.dailyGoalCups * settings.cupVolume) + ' ml';
            });

            $$('.water-progress-fill, .water-progress-bg').forEach(function (fill) {
                var p = Num.percent(today.cups, settings.dailyGoalCups);
                if (fill.classList.contains('water-progress-fill')) {
                    fill.style.width = p + '%';
                }
            });

            this.renderWeek();

            var wordcard = $('.water-word-card-preview');
            if (wordcard) {
                var cards = DATA.Water.listWordcards();
                var cur = cards[Num.randInt(0, cards.length - 1)] || '别忘了喝水';
                wordcard.textContent = '"' + cur + '"';
            }
        },

        renderWeek: function () {
            var row = $('.water-week-bar-row, .water-week-chart');
            if (!row) return;
            var recent = DATA.Water.getRecent(7);
            var max = Math.max.apply(null, recent.map(function (d) { return d.cups; }).concat([1]));

            row.innerHTML = recent.map(function (d) {
                var h = Math.max(8, (d.cups / max) * 50);
                var isToday = d.date === Time.formatDate();
                return '<div class="week-day-item' + (isToday ? ' active' : '') + '" style="text-align:center;flex:1">' +
                    '<p style="font-size:12px;color:#999;margin:0 0 4px">' + d.day + '</p>' +
                    '<div style="width:14px;height:' + h + 'px;background:' + (isToday ? '#4299e1' : '#ddd') + ';border-radius:4px;margin:0 auto"></div>' +
                    '<p style="font-size:11px;color:#999;margin:4px 0 0">' + d.cups + '</p>' +
                '</div>';
            }).join('');
        },

        addCup: function () {
            DATA.Water.addCup(1);
            this.render();
            var today = DATA.Water.getToday();
            var goal = DATA.Water.getSettings().dailyGoalCups;
            if (today.cups === goal) {
                if (MOOD.onWaterGoalReached) MOOD.onWaterGoalReached();
                ENV.notify({ title: '喝水目标达成', body: REPLY.pick(REPLY.WATER_REPLY.goalReached), icon: '🎉', timeout: 3000 });
            }
        },
        minusCup: function () { DATA.Water.addCup(-1); this.render(); },

        sendToChat: function () {
            var today = DATA.Water.getToday();
            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.addMessage(chatId, {
                from: 'me',
                text: '今天喝了 ' + today.cups + ' 杯水',
                type: 'text'
            });
            ENV.tip && ENV.tip('已发到聊天');
        },

        taRemind: function () {
            var text = REPLY.pick(REPLY.WATER_REPLY.remind);
            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.addMessage(chatId, { from: 'ta', text: text, type: 'text' });
            if (MOOD.onWaterRemind) MOOD.onWaterRemind();
            ENV.tip && ENV.tip('TA 提醒你喝水了');
        },

        setGoal: function () {
            var inputs = $$('.popup-set-water-goal input');
            var cups = Number(inputs[0] && inputs[0].value) || 8;
            var vol = Number(inputs[1] && inputs[1].value) || 250;
            var s = DATA.Water.getSettings();
            s.dailyGoalCups = cups;
            s.cupVolume = vol;
            DATA.Water.saveSettings(s);
            CORE.closePopup && CORE.closePopup();
            this.render();
            ENV.tip && ENV.tip('已保存');
        }
    };

    /* ============================================================
     * 12. 设置 Setting
     * ============================================================ */
    var Setting = {
       // 【新增】把当前设置回填到弹窗的 radio 上
       fillChatSendRadio: function () {
            var box = $('.popup-chat-send-setting');
            if (!box) return;
            var mode = DATA.Settings.getOne('chat.sendMode') || 'both';
            var radios = box.querySelectorAll('input[name="chatSendMode"]');
            radios.forEach(function (r) {
              r.checked = (r.value === mode);
      });
 },
        init: function () {},

        saveReply: function () {
            var box = $('.popup-reply-setting');
            if (!box) return;
            var inputs = $$('input[type="number"]', box);
            var checks = $$('input[type="checkbox"]', box);
            var s = DATA.Settings.getOne('reply') || {};
            if (inputs[0]) s.minDelay = Number(inputs[0].value) || 1;
            if (inputs[1]) s.maxDelay = Number(inputs[1].value) || 10;
            if (inputs[2]) s.minCount = Number(inputs[2].value) || 1;
            if (inputs[3]) s.maxCount = Number(inputs[3].value) || 3;
            if (checks[0]) s.joinWordcard = checks[0].checked;
            if (checks[1]) s.readNoReply = checks[1].checked;
            if (checks[2]) s.taProactive = checks[2].checked;
            DATA.Settings.setOne('reply', s);
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
        },

        saveMoments: function () {
            var box = $('.popup-moments-setting');
            if (!box) return;
            var inputs = $$('input[type="number"]', box);
            var checks = $$('input[type="checkbox"]', box);
            var s = DATA.Settings.getOne('moments') || {};
            if (inputs[0]) s.minPostTime = Number(inputs[0].value) || 30;
            if (inputs[1]) s.maxPostTime = Number(inputs[1].value) || 120;
            if (inputs[2]) s.minWordcard = Number(inputs[2].value) || 1;
            if (inputs[3]) s.maxWordcard = Number(inputs[3].value) || 3;
            if (checks[0]) s.visibleToAll = checks[0].checked;
            if (checks[1]) s.allowMutualSee = checks[1].checked;
            DATA.Settings.setOne('moments', s);
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
        },

        setDarkMode: function (mode) {
            DATA.Settings.setOne('darkMode', mode);
            DATA.Theme.patch({ mode: mode });
            var TE = global.APP_THEME_EDITOR;
            if (TE && TE.setDarkMode) TE.setDarkMode(mode);
            ENV.tip && ENV.tip('已切换');
        },

         // 【新增】保存发送方式
        saveChatSend: function () {
            var box = $('.popup-chat-send-setting');
            if (!box) return;
            var checked = box.querySelector('input[name="chatSendMode"]:checked');
            if (!checked) return;
            var mode = checked.value;
            if (['both', 'enter', 'button'].indexOf(mode) === -1) mode = 'both';
            DATA.Settings.setOne('chat.sendMode', mode);
            CORE.closePopup && CORE.closePopup();

            // 立即刷新发送按钮显隐
            APP_FEATURES.Chat && APP_FEATURES.Chat.updateSendButton();

            var names = { both: '回车和按钮都可以发送', enter: '只用回车发送', button: '只用按钮发送' };
            ENV.tip && ENV.tip('已切换为：' + (names[mode] || mode));
        },
        // 【新增】打开发送方式弹窗时回填选中状态
        fillChatSendRadio: function () {
            var box = $('.popup-chat-send-setting');
            if (!box) return;
            var mode = DATA.Settings.getOne('chat.sendMode') || 'both';
            var radios = box.querySelectorAll('input[name="chatSendMode"]');
            radios.forEach(function (r) {
                r.checked = (r.value === mode);
            });
        },

        toggleNotify: function (checked) {
            if (checked) {
                if (ENV.requestPermission) {
                    ENV.requestPermission().then(function (p) {
                        if (p !== 'granted') ENV.tip && ENV.tip('未授权，无法发系统通知');
                    });
                }
            }
            DATA.Settings.setOne('notify.enabled', checked);
        },

        renderStorage: function () {
            var stats = DATA.All.stats();
            var rows = $$('.popup-storage-setting .storage-row');
            var keys = ['chat', 'wordcard', 'favorite', 'moments', 'letter', 'anniversary', 'divination', 'music', 'question', 'period', 'water', 'shop'];
            rows.forEach(function (row, i) {
                var k = keys[i];
                if (!k) return;
                var num = row.querySelector('span:last-child');
                if (num) num.textContent = formatBytes(stats[k] || 0);
            });
        }
    };

    function formatBytes(n) {
        if (!n) return '0 B';
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(2) + ' MB';
    }

    /* ============================================================
     * 13. 商城 Shop
     * ============================================================ */
    var Shop = {
        _search: '',
        init: function () { this.render(); },
        onEnter: function () { this.render(); this.renderBalance(); },

        renderBalance: function () {
            var v = DATA.Shop.getBalance();
            $$('.balance-input').forEach(function (i) { i.value = v.toFixed(2); });
        },

        render: function () {
            this._renderGrid('.tab-recommend .shop-goods-grid', DATA.Shop.listGoods('recommend'), 'recommend');
            this._renderGrid('.tab-takeaway .shop-goods-grid', DATA.Shop.listGoods('takeaway'), 'takeaway');

            // 购物车角标
            var cartNav = document.querySelector('.shop-nav-item[data-target-page="cartPage"]');
            if (cartNav) {
                var count = DATA.Shop.countCart();
                var badge = cartNav.querySelector('.cart-badge');
                if (!badge && count > 0) {
                    badge = document.createElement('span');
                    badge.className = 'cart-badge';
                    badge.style.cssText = 'position:absolute;top:4px;right:calc(50% - 18px);background:#ff4466;color:#fff;font-size:10px;border-radius:10px;padding:1px 5px;min-width:14px;text-align:center';
                    cartNav.style.position = 'relative';
                    cartNav.appendChild(badge);
                }
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? '' : 'none';
                }
            }
        },

        _renderGrid: function (sel, list, category) {
            var grid = $(sel);
            if (!grid) return;

            if (this._search) {
                var kw = this._search;
                list = list.filter(function (g) {
                    return (g.name || '').indexOf(kw) > -1
                        || (g.desc || '').indexOf(kw) > -1;
                });
            }

            if (list.length === 0) {
                grid.innerHTML = '<p class="empty-tip" style="grid-column:1/-1">没有找到商品</p>';
                return;
            }

            grid.innerHTML = list.map(function (g) {
                return '<div class="goods-item" data-id="' + g.id + '">' +
                    '<div class="goods-img-box">' + (g.icon || '🎁') + '</div>' +
                    '<h3 class="goods-name">' + esc(g.name) + '</h3>' +
                    '<p class="goods-desc">' + esc(g.desc || '') + '</p>' +
                    '<div class="goods-tag-row">' + (g.tags || []).map(function (t) {
                        return '<span class="goods-tag">' + esc(t) + '</span>';
                    }).join('') + '</div>' +
                    '<div class="goods-bottom-row">' +
                        '<span class="goods-price">¥' + g.price + '</span>' +
                        '<button class="btn-add-cart" data-id="' + g.id + '" data-category="' + category + '">+</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        },

        search: function (keyword) {
            this._search = (keyword || '').trim();
            this.render();
        },

        addToCart: function (goodsId, category) {
            var goods = Obj.findById(DATA.Shop.listGoods(category), goodsId);
            if (!goods) return;
            DATA.Shop.addToCart(goods, category);
            ENV.tip && ENV.tip('已加入购物车');
            if (MOOD.onCartAdd) MOOD.onCartAdd();
            this.render();
        },

        wishGoods: function () {
            var box = $('.popup-wish-goods');
            if (!box) return;
            var name = (box.querySelector('.wish-name-input').value || '').trim();
            if (!name) { ENV.tip && ENV.tip('输入商品名称'); return; }
            var price = Number(box.querySelector('.wish-price-input').value) || 0;
            var category = box.querySelector('.wish-category-select').value;
            var tagsStr = box.querySelector('.wish-tag-input').value || '';
            var icon = box.querySelector('.wish-emoji-input').value || '🎁';
            var desc = box.querySelector('.wish-desc-input').value || '';

            DATA.Shop.addGoods(category, {
                name: name,
                price: price,
                tags: tagsStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
                icon: icon,
                desc: desc
            });

            box.querySelector('.wish-name-input').value = '';
            box.querySelector('.wish-price-input').value = '0.00';
            box.querySelector('.wish-tag-input').value = '';
            box.querySelector('.wish-emoji-input').value = '';
            box.querySelector('.wish-desc-input').value = '';

            CORE.closePopup && CORE.closePopup();
            this.render();
            ENV.tip && ENV.tip('许愿成功');
        }
    };

    /* ============================================================
     * 14. 购物车 Cart
     * ============================================================ */
    var Cart = {
        init: function () { this.render(); },
        onEnter: function () { this.render(); this.renderBalance(); },

        renderBalance: function () {
            var v = DATA.Shop.getBalance();
            $$('.balance-input').forEach(function (i) { i.value = v.toFixed(2); });
        },

        render: function () {
            var wrap = $('.cart-list-wrap');
            var empty = $('.cart-empty-wrap');
            if (!wrap) return;

            var list = DATA.Shop.listCart();
            if (list.length === 0) {
                if (empty) empty.style.display = 'flex';
                wrap.innerHTML = '';
                this.updateTotal();
                return;
            }
            if (empty) empty.style.display = 'none';

            wrap.innerHTML = list.map(function (it) {
                return '<div class="cart-item-card" data-id="' + it.goodsId + '">' +
                    '<input type="checkbox" class="cart-checkbox" ' + (it.selected ? 'checked' : '') + '>' +
                    '<div class="cart-item-icon">' + (it.icon || '🎁') + '</div>' +
                    '<div class="cart-item-info">' +
                        '<p class="cart-item-name">' + esc(it.name) + '</p>' +
                        '<p class="cart-item-price">¥' + it.price + '</p>' +
                    '</div>' +
                    '<div class="cart-amount-wrap">' +
                        '<button class="cart-minus" data-id="' + it.goodsId + '">-</button>' +
                        '<span>' + it.count + '</span>' +
                        '<button class="cart-plus" data-id="' + it.goodsId + '">+</button>' +
                    '</div>' +
                '</div>';
            }).join('');

            this.updateTotal();
        },

        updateTotal: function () {
            var list = DATA.Shop.listCart();
            var total = list.filter(function (it) { return it.selected; })
                .reduce(function (s, it) { return s + it.price * it.count; }, 0);
            $$('.cart-total-price').forEach(function (el) { el.textContent = total.toFixed(2); });
        },

        changeCount: function (goodsId, delta) {
            var it = Obj.find(DATA.Shop.listCart(), function (i) { return i.goodsId === goodsId; });
            if (!it) return;
            DATA.Shop.updateCartItem(goodsId, { count: it.count + delta });
            this.render();
        },

        toggleSelect: function (goodsId, selected) {
            DATA.Shop.updateCartItem(goodsId, { selected: selected });
            this.updateTotal();
        },

        selectAll: function (selected) {
            var list = DATA.Shop.listCart();
            list.forEach(function (it) { it.selected = selected; });
            DATA.Shop.saveCart(list);
            this.render();
        },

        deleteSelected: function () {
            var list = DATA.Shop.listCart();
            var ids = list.filter(function (it) { return it.selected; }).map(function (it) { return it.goodsId; });
            if (ids.length === 0) { ENV.tip && ENV.tip('没有选中商品'); return; }
            DATA.Shop.removeCartItems(ids);
            this.render();
            ENV.tip && ENV.tip('已删除');
        },

        settle: function () {
            var list = DATA.Shop.listCart();
            var selected = list.filter(function (it) { return it.selected; });
            if (selected.length === 0) { ENV.tip && ENV.tip('没有选中商品'); return; }

            var total = selected.reduce(function (s, it) { return s + it.price * it.count; }, 0);
            var balance = DATA.Shop.getBalance();
            if (balance < total) { ENV.tip && ENV.tip('余额不足'); return; }

            DATA.Shop.setBalance(balance - total);
            DATA.Shop.addOrder({ items: selected, total: total, status: 'pending' });
            DATA.Shop.removeCartItems(selected.map(function (it) { return it.goodsId; }));

            if (MOOD.onOrderPlaced) MOOD.onOrderPlaced();

            this.render();
            this.renderBalance();
            Shop.renderBalance();
            Shop.render();

            ENV.notify({ title: '下单成功', body: '已下单，等待送达', icon: '📦', timeout: 3000 });

            var chatId = STATE.get('currentChatId') || 'ta';
            DATA.Chat.addMessage(chatId, {
                from: 'ta',
                text: REPLY.pick(REPLY.SHOP_REPLY.orderPlaced),
                type: 'text'
            });

            setTimeout(function () {
                var orders = DATA.Shop.listOrders();
                if (orders[0]) {
                    DATA.Shop.updateOrder(orders[0].id, { status: 'done' });
                    ENV.notify({ title: '订单已送达', body: REPLY.pick(REPLY.SHOP_REPLY.delivered), icon: '✅', timeout: 3000 });
                    DATA.Chat.addMessage(chatId, {
                        from: 'ta',
                        text: REPLY.pick(REPLY.SHOP_REPLY.delivered),
                        type: 'text'
                    });
                }
            }, 8000);
        }
    };

    /* ============================================================
     * 15. 订单 Order
     * ============================================================ */
    var Order = {
        _tab: 'all',
        init: function () { this.render(); },
        onEnter: function () { this.render(); },

        setTab: function (tab) { this._tab = tab; this.render(); },

        render: function () {
            var wrap = $('.order-list-wrap');
            var empty = $('.order-empty-wrap');
            if (!wrap) return;

            var list = DATA.Shop.listOrders(this._tab);
            if (list.length === 0) {
                if (empty) empty.style.display = 'flex';
                wrap.innerHTML = '';
                return;
            }
            if (empty) empty.style.display = 'none';

            wrap.innerHTML = list.map(function (o) {
                var itemsHtml = (o.items || []).map(function (it) {
                    return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">' +
                        '<div style="width:44px;height:44px;background:#f7f7f7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px">' + (it.icon || '🎁') + '</div>' +
                        '<div style="flex:1">' +
                            '<p style="font-size:14px;margin:0 0 2px">' + esc(it.name) + '</p>' +
                            '<p style="font-size:12px;color:#999;margin:0">× ' + it.count + '</p>' +
                        '</div>' +
                    '</div>';
                }).join('');

                return '<div class="order-item-card" data-id="' + o.id + '">' +
                    '<div style="display:flex;justify-content:space-between;margin-bottom:10px">' +
                        '<span style="color:#ff7b9c;font-weight:500">' + statusText(o.status) + '</span>' +
                        '<span style="font-size:12px;color:#999">' + Time.formatFull(o.createdAt) + '</span>' +
                    '</div>' +
                    itemsHtml +
                    '<div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px solid #f3f3f3">' +
                        '<span>合计</span><span style="color:#ff4466;font-weight:600">¥' + o.total + '</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        }
    };

    function statusText(s) {
        return { pending: '待送达', delivering: '配送中', done: '已完成', cancelled: '已取消' }[s] || s;
    }

    /* ============================================================
     * 16. 纪念日 Anniversary
     * ============================================================ */
    var Anniversary = {
        init: function () { this.render(); },

        add: function () {
            openModal({
                title: '添加纪念日',
                fields: [
                    { key: 'name', label: '名称', type: 'text', placeholder: '如：我们的第一天' },
                    { key: 'date', label: '日期', type: 'date', value: Time.formatDate() }
                ],
                buttons: [
                    { text: '取消' },
                    { text: '添加', primary: true, onClick: function (v) {
                        if (!v.name || !v.date) { ENV.tip && ENV.tip('请填写完整'); return false; }
                        DATA.Anniversary.add({ name: v.name.trim(), date: v.date });
                        Anniversary.render();
                        ENV.tip && ENV.tip('已添加');
                    }}
                ]
            });
        },

        render: function () {
            var box = $('.popup-anniversary .anniversary-empty');
            if (!box) return;
            var list = DATA.Anniversary.list();
            if (list.length === 0) {
                box.innerHTML = '<p class="empty-text">还没有纪念日</p>';
                return;
            }

            var today = new Date(Time.formatDate());
            box.innerHTML = list.map(function (a) {
                var target = new Date(a.date);
                var days = Math.round((target - today) / 86400000);
                var tag = days > 0 ? '还有 ' + days + ' 天' : (days === 0 ? '🎉 就是今天' : '已过 ' + Math.abs(days) + ' 天');
                return '<div class="ann-item" style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f2f2f2">' +
                    '<span style="font-size:14px">' + esc(a.name) + '</span>' +
                    '<span style="font-size:13px;color:#999">' + a.date + ' · ' + tag + '</span>' +
                '</div>';
            }).join('');
        }
    };

    /* ============================================================
     * 17. 初始化
     * ============================================================ */
    function initAll() {
        Object.keys(APP_FEATURES).forEach(function (k) {
            var f = APP_FEATURES[k];
            if (f && typeof f.init === 'function') {
                try { f.init(); } catch (e) { Log.error('[features] ' + k + '.init 出错:', e); }
            }
        });
    }

    /* ============================================================
     * 18. 对外导出
     * ============================================================ */
    var APP_FEATURES = {
        Home: Home,
        Chat: Chat,
        Character: Character,        // 【新增】
        Letter: Letter,
        Moments: Moments,
        Period: Period,
        MessageRecord: MessageRecord,
        Divination: Divination,
        Favorite: Favorite,
        Music: Music,
        Question: Question,
        Water: Water,
        Setting: Setting,
        Shop: Shop,
        Cart: Cart,
        Order: Order,
        Anniversary: Anniversary,

        initAll: initAll,

        openModal: openModal,
        confirmDialog: confirmDialog
    };

    global.APP_FEATURES = APP_FEATURES;

})(typeof window !== 'undefined' ? window : this);