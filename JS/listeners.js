/**
 * listeners.js （v3 完整版）
 * 事件监听：把所有 HTML 按钮接上逻辑
 * 依赖：全部模块
 * 被依赖：main.js
 *
 * v3 修复：
 * 1. 聊天列表项点击 → 设置 currentChatId（在 features.Chat.renderList 里处理）
 * 2. 朋友圈 🔔 → APP_MOMENTS_VISITS.open()
 * 3. 商城「> 全部」→ APP_MALL_ALL.open()
 * 4. .btn-add-member → APP_MEMBER_PICKER.pickForCreateGroup()
 * 5. .balance-input 改成 input 事件委托（不再 once）
 * 6. .period-preview-card 点击 → 跳经期页
 * 7. 顶部补充引用：IMG / MOMENTS_VISITS / MALL_ALL / MEMBER_PICKER / STICKER / WORDCARD_LIB / QUESTION_ENGINE
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
    var FEATURES = global.APP_FEATURES || {};
    var CALL = global.APP_CALL || {};
    var GROUP = global.APP_GROUP || {};
    var THEME = global.APP_THEME_EDITOR || {};
    var ONBOARDING = global.APP_ONBOARDING || {};
    var GAME = global.APP_GAME || {};
    var IMG = global.APP_IMG || {};
    var MOMENTS_VISITS = global.APP_MOMENTS_VISITS || {};
    var MALL_ALL = global.APP_MALL_ALL || {};
    var MEMBER_PICKER = global.APP_MEMBER_PICKER || {};
    var STICKER = global.APP_STICKER || {};
    var WORDCARD_LIB = global.APP_WORDCARD_LIB || {};
    var QUESTION_ENGINE = global.APP_QUESTION_ENGINE || {};

    var Dom = UTILS.Dom;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var _bound = false;

    function $(sel, parent) {
        return (parent || document).querySelector(sel);
    }
    function $$(sel, parent) {
        return Array.prototype.slice.call((parent || document).querySelectorAll(sel));
    }

    /* ============================================================
     * 1. 全局顶部栏
     * ============================================================ */
    function bindGlobalHeader(e) {
        var t = e.target;

        if (t.closest('.btn-close-app')) {
            if (confirm('确定要退出吗？')) {
                window.close();
                CORE.showPage && CORE.showPage('homeFirst');
            }
            return true;
        }

        if (t.closest('.btn-share-app')) {
            if (navigator.share) {
                navigator.share({ title: '梦角', text: '来看看我的梦角' }).catch(function () {});
            } else {
                try {
                    var url = location.href;
                    var ta = document.createElement('textarea');
                    ta.value = url;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    ENV.tip && ENV.tip('链接已复制');
                } catch (err) {
                    ENV.tip && ENV.tip('分享失败');
                }
            }
            return true;
        }

        return false;
    }

    /* ============================================================
     * 2. 首页 Home
     * ============================================================ */
    function bindHome(e) {
        var t = e.target;

        if (t.closest('.btn-checkin')) {
            FEATURES.Home && FEATURES.Home.checkin();
            return true;
        }
        if (t.closest('.card-daily-memo')) {
            FEATURES.Home && FEATURES.Home.editMemo();
            return true;
        }
        if (t.closest('.card-daily-love')) {
            FEATURES.Home && FEATURES.Home.renderDailyLove();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 3. 聊天列表
     * ============================================================ */
    function bindChatListInput(e) {
        var t = e.target;
        if (!t.classList || !t.classList.contains('chat-search')) return;

        var keyword = (t.value || '').trim();
        var items = $$('.chat-list-container .chat-list-item');
        items.forEach(function (item) {
            var nameEl = item.querySelector('.chat-item-name');
            var name = nameEl ? nameEl.textContent : '';
            var match = !keyword || name.indexOf(keyword) > -1;
            item.style.display = match ? '' : 'none';
        });
    }

    /* ============================================================
     * 4. 聊天室
     * ============================================================ */
    function bindChatRoom(e) {
        var t = e.target;

            if (t.closest('.btn-send-msg')) {
            var mode = DATA.Settings.getOne('chat.sendMode') || 'both';
            if (mode === 'enter') {
                // 只用回车发，按钮无反应
                return true;
            }
            FEATURES.Chat && FEATURES.Chat.send();
            return true;
        }

        if (t.closest('.btn-emoji')) {
            FEATURES.Chat && FEATURES.Chat.openEmojiPanel();
            return true;
        }

        if (t.closest('.btn-add-more')) {
            FEATURES.Chat && FEATURES.Chat.openMoreMenu();
            return true;
        }

        if (t.closest('.btn-call-out')) {
            var chatId = STATE.get('currentChatId') || 'ta';
            var char = DATA.Character.get(chatId) || { id: chatId, name: 'TA' };
            CALL.callOut && CALL.callOut({ id: char.id, name: char.name });
            return true;
        }

        if (t.closest('.btn-chat-more')) {
            CORE.showPage && CORE.showPage('chatInfo');
            return true;
        }

        return false;
    }

       fun

        var mode = DATA.Settings.getOne('chat.sendMode') || 'both';
        if (mode === 'button') {
            // 只用按钮发，回车不响应
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            FEATURES.Chat && FEATURES.Chat.send();
        }
    }
    /* ============================================================
     * 5. 通话
     * ============================================================ */
    function bindCall(e) {
        var t = e.target;

        if (t.closest('.btn-hangup-call')) {
            CALL.hangup && CALL.hangup();
            return true;
        }
        if (t.closest('.btn-hangup-float')) {
            CALL.hangup && CALL.hangup();
            return true;
        }
        if (t.closest('.btn-reject-call')) {
            CALL.rejectCall && CALL.rejectCall();
            return true;
        }
        if (t.closest('.btn-accept-call')) {
            CALL.acceptCall && CALL.acceptCall();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 6. 聊天信息
     * ============================================================ */
       function bindChatInfo(e) {
        var t = e.target;

        // 【新增】点角色资料行 → 打开资料编辑
        if (t.closest('.info-row-user')) {
            FEATURES.Character && FEATURES.Character.open();
            return true;
        }

        // 【新增】资料弹窗 - 上传头像
        if (t.closest('.btn-upload-avatar')) {
            FEATURES.Character && FEATURES.Character.uploadAvatar();
            return true;
        }

        // 【新增】资料弹窗 - 保存
        if (t.closest('.popup-character-profile .btn-popup-save')) {
            FEATURES.Character && FEATURES.Character.save();
            return true;
        }

        // 【新增】资料弹窗 - 关闭
        if (t.closest('.popup-character-profile .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        var switchRow = t.closest('.switch-row');
        if (switchRow && !t.closest('.setting-switch-row')) {
            var toggle = switchRow.querySelector('.switch-toggle');
            if (toggle) {
                toggle.classList.toggle('on');
                var label = switchRow.querySelector('span');
                var labelText = label ? label.textContent : '';
                ENV.tip && ENV.tip(labelText + (toggle.classList.contains('on') ? ' 已开启' : ' 已关闭'));
            }
            return true;
        }

        return false;
    }

    /* ============================================================
     * 7. 通用弹窗按钮
     * ============================================================ */
    function bindPopups(e) {
        var t = e.target;

        // -------- 创建群聊 --------
        if (t.closest('.btn-add-member')) {
            // 【v3 修复】调 pickForCreateGroup 把选中成员加到列表
            if (MEMBER_PICKER.pickForCreateGroup) {
                MEMBER_PICKER.pickForCreateGroup();
            } else if (MEMBER_PICKER.open) {
                MEMBER_PICKER.open();
            } else {
                ENV.tip && ENV.tip('选成员功能未加载');
            }
            return true;
        }
        if (t.closest('.popup-create-group .btn-popup-confirm')) {
            // 从弹窗收集成员
            if (MEMBER_PICKER.collectCreateGroupMembers) {
                var ids = MEMBER_PICKER.collectCreateGroupMembers();
                // 把成员写进 name 字段以外的成员列表
                var box = $('.popup-create-group');
                var nameInput = box && box.querySelector('input[type="text"]');
                var name = nameInput ? (nameInput.value || '').trim() : '群聊';
                if (ids.length === 0) {
                    var first = DATA.Character.list()[0];
                    if (first) ids = [first.id];
                }
                var group = GROUP.createGroup({ name: name, members: ids });
            } else if (GROUP.createFromPopup) {
                GROUP.createFromPopup();
            }
            CORE.closePopup && CORE.closePopup('createGroup');
            ENV.tip && ENV.tip('群聊已创建');
            return true;
        }

        // -------- 聊天数据弹窗 --------
        var chatDataBtn = t.closest('.popup-chat-data .popup-option-btn');
        if (chatDataBtn) {
            var text = chatDataBtn.textContent || '';
            if (text.indexOf('导出') > -1) {
                BACKUP.exportToFile && BACKUP.exportToFile();
            } else if (text.indexOf('导入') > -1) {
                BACKUP.pickAndImport && BACKUP.pickAndImport().then(function () {
                    ENV.tip && ENV.tip('导入成功');
                    location.reload();
                }).catch(function (err) {
                    ENV.tip && ENV.tip('导入失败：' + err.message);
                });
            } else if (text.indexOf('删除') > -1) {
                if (confirm('确定删除所有聊天记录吗？删除后无法恢复')) {
                    DATA.Chat.clearAllMessages();
                    ENV.tip && ENV.tip('已删除');
                }
            } else {
                CORE.closePopup && CORE.closePopup();
            }
            return true;
        }

        // -------- 时间戳 / 已读 --------
        var selectRow = t.closest('.popup-read-time-setting .select-row');
        if (selectRow) {
            var sp = selectRow.querySelector('span');
            var key = sp && sp.textContent.indexOf('时间') > -1 ? 'showTimestamp' : 'showReadStatus';
            var s = DATA.Settings.getOne('chat') || {};
            s[key] = !s[key];
            DATA.Settings.setOne('chat', s);
            THEME.setReadTime && THEME.setReadTime();
            ENV.tip && ENV.tip((s[key] ? '已开启' : '已关闭'));
            return true;
        }
        if (t.closest('.popup-read-time-setting .btn-popup-confirm')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // -------- 头像设置 --------
        var shapeBtn = t.closest('.popup-avatar-setting .shape-btn');
        if (shapeBtn) {
            $$('.popup-avatar-setting .shape-btn').forEach(function (b) { b.classList.remove('active'); });
            shapeBtn.classList.add('active');
            return true;
        }
        if (t.closest('.popup-avatar-setting .btn-popup-confirm')) {
            THEME.saveFromAvatarPopup && THEME.saveFromAvatarPopup();
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
            return true;
        }

        // -------- 文字设置 --------
        if (t.closest('.popup-text-setting .btn-upload-css')) {
            _pickCSSFile('.popup-text-setting textarea');
            return true;
        }
        if (t.closest('.popup-text-setting .btn-popup-confirm')) {
            THEME.saveFromTextPopup && THEME.saveFromTextPopup();
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
            return true;
        }

        // -------- 气泡设置 --------
        var colorBlock = t.closest('.popup-bubble-setting .color-block');
        if (colorBlock) {
            $$('.popup-bubble-setting .color-block').forEach(function (b) { b.classList.remove('active'); });
            colorBlock.classList.add('active');
            return true;
        }
        if (t.closest('.popup-bubble-setting .btn-upload-css')) {
            _pickCSSFile('.popup-bubble-setting textarea');
            return true;
        }
        if (t.closest('.popup-bubble-setting .btn-popup-confirm')) {
            THEME.saveFromBubblePopup && THEME.saveFromBubblePopup();
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
            return true;
        }

        // -------- 聊天背景 --------
        var bgBlock = t.closest('.popup-bg-setting .color-block');
        if (bgBlock) {
            $$('.popup-bg-setting .color-block').forEach(function (b) { b.classList.remove('active'); });
            bgBlock.classList.add('active');
            var bgColor = getComputedStyle(bgBlock).backgroundColor;
            if (THEME.setChatBg) {
                THEME.setChatBg({ chatBg: THEME.rgbToHex ? THEME.rgbToHex(bgColor) : bgColor });
            }
            return true;
        }
        if (t.closest('.popup-bg-setting .btn-popup-confirm')) {
            if (IMG.handleChatBgUpload) {
                IMG.handleChatBgUpload();
            }
            return true;
        }

        // -------- 纪念日 --------
        if (t.closest('.btn-add-anniversary')) {
            FEATURES.Anniversary && FEATURES.Anniversary.add();
            return true;
        }

        // -------- 音乐弹窗 --------
        if (t.closest('.popup-add-music .btn-popup-confirm')) {
            FEATURES.Music && FEATURES.Music.add();
            return true;
        }
        if (t.closest('.popup-listen-together .btn-listen-accept')) {
            FEATURES.Music && FEATURES.Music.acceptInvite();
            return true;
        }
        if (t.closest('.popup-listen-together .btn-listen-later')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // -------- 提问弹窗 --------
        if (t.closest('.btn-add-option')) {
            FEATURES.Question && FEATURES.Question.addOption();
            return true;
        }
        if (t.closest('.popup-new-question .btn-popup-confirm')) {
            FEATURES.Question && FEATURES.Question.submit();
            return true;
        }

        // -------- 喝水弹窗 --------
        if (t.closest('.popup-set-water-goal .btn-popup-confirm')) {
            FEATURES.Water && FEATURES.Water.setGoal();
            return true;
        }
        if (t.closest('.popup-set-once-volume .btn-popup-confirm')) {
            var input = $('.popup-set-once-volume input');
            var v = Number(input && input.value) || 250;
            var s2 = DATA.Water.getSettings();
            s2.onceVolume = v;
            DATA.Water.saveSettings(s2);
            CORE.closePopup && CORE.closePopup();
            ENV.tip && ENV.tip('已保存');
            return true;
        }
        if (t.closest('.popup-add-water-wordcard .btn-popup-confirm')) {
            var wInput = $('.popup-add-water-wordcard input');
            var w = wInput && wInput.value.trim();
            if (w) {
                DATA.Water.addWordcard(w);
                CORE.closePopup && CORE.closePopup();
                ENV.tip && ENV.tip('已添加');
            }
            return true;
        }

        // -------- 许愿弹窗上传图标 --------
        if (t.closest('.btn-upload-icon')) {
            if (IMG.handleWishIconUpload) {
                IMG.handleWishIconUpload();
            } else {
                ENV.tip && ENV.tip('图片功能未就绪');
            }
            return true;
        }

        // -------- 商城许愿弹窗 --------
        if (t.closest('.popup-wish-goods .btn-wish-submit')) {
            FEATURES.Shop && FEATURES.Shop.wishGoods();
            return true;
        }
        if (t.closest('.popup-wish-goods .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // -------- 朋友圈发布弹窗 --------
        if (t.closest('.popup-publish-moment .btn-popup-confirm')) {
            FEATURES.Moments && FEATURES.Moments.publish();
            return true;
        }
        if (t.closest('.popup-publish-moment .btn-popup-cancel')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        return false;
    }

    function _pickCSSFile(targetTextarea) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.css,text/css';
        input.onchange = function () {
            var file = input.files[0];
            if (!file) return;
            THEME.loadCSSFromFile(file).then(function (css) {
                var ta = $(targetTextarea);
                if (ta) ta.value = css;
                ENV.tip && ENV.tip('已加载 CSS 文件');
            }).catch(function () {
                ENV.tip && ENV.tip('加载失败');
            });
        };
        input.click();
    }

    /* ============================================================
     * 8. 信件
     * ============================================================ */
    function bindLetter(e) {
        var t = e.target;

        var tabBtn = t.closest('.letter-tab-btn');
        if (tabBtn) {
            $$('.letter-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            var idx = $$('.letter-tab-btn').indexOf(tabBtn);
            var contents = $$('.letter-tab-content');
            contents.forEach(function (c) { c.classList.remove('active'); });
            if (contents[idx]) contents[idx].classList.add('active');
            return true;
        }

        if (t.closest('.btn-write-letter')) {
            FEATURES.Letter && FEATURES.Letter.write();
            return true;
        }

        if (t.closest('.btn-close-letter-tab')) {
            CORE.showPage && CORE.showPage('homeFirst');
            return true;
        }

        var letterItem = t.closest('.letter-item');
        if (letterItem && letterItem.dataset.id) {
            FEATURES.Letter && FEATURES.Letter.openLetter(letterItem.dataset.id, letterItem.dataset.type);
            return true;
        }

        return false;
    }

    /* ============================================================
     * 9. 朋友圈
     * ============================================================ */
    function bindMoments(e) {
        var t = e.target;

        if (t.closest('.btn-moments-publish')) {
            CORE.openPopup && CORE.openPopup('publishMoment');
            return true;
        }

        // 【v3 修复】朋友圈 🔔 → 用 MOMENTS_VISITS.open（会 openPopup + render）
        if (t.closest('.btn-moments-visit')) {
            if (MOMENTS_VISITS.open) {
                MOMENTS_VISITS.open();
            } else {
                CORE.openPopup && CORE.openPopup('momentsVisit');
            }
            return true;
        }

        if (t.closest('#momentsBgChange')) {
            FEATURES.Moments && FEATURES.Moments.changeBg();
            return true;
        }

        var likeBtn = t.closest('.moment-like');
        if (likeBtn && likeBtn.dataset.id) {
            FEATURES.Moments && FEATURES.Moments.toggleLike(likeBtn.dataset.id);
            return true;
        }

        var commentBtn = t.closest('.moment-comment');
        if (commentBtn && commentBtn.dataset.id) {
            FEATURES.Moments && FEATURES.Moments.addComment(commentBtn.dataset.id);
            return true;
        }

        return false;
    }

    /* ============================================================
     * 10. 经期
     * ============================================================ */
    function bindPeriod(e) {
        var t = e.target;

        var tabBtn = t.closest('.period-tab-btn');
        if (tabBtn) {
            $$('.period-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            return true;
        }

        if (t.closest('.btn-mark-period-start')) {
            FEATURES.Period && FEATURES.Period.markStart();
            return true;
        }
        if (t.closest('.btn-record-today')) {
            FEATURES.Period && FEATURES.Period.recordToday();
            return true;
        }
        if (t.closest('.btn-cal-prev')) {
            FEATURES.Period && FEATURES.Period.prevMonth();
            return true;
        }
        if (t.closest('.btn-cal-next')) {
            FEATURES.Period && FEATURES.Period.nextMonth();
            return true;
        }

        var day = t.closest('.calendar-day');
        if (day && day.dataset.date) {
            FEATURES.Period && FEATURES.Period.openDayDetail(day.dataset.date);
            return true;
        }

        // 【修改】经期提醒
        if (t.closest('.btn-period-notify')) {
            CORE.openPopup && CORE.openPopup('periodNotify');
            setTimeout(function () {
                FEATURES.Period && FEATURES.Period.fillNotifySettings();
            }, 100);
            return true;
        }

        // 【修改】经期设置
        if (t.closest('.btn-period-setting')) {
            CORE.openPopup && CORE.openPopup('periodSetting');
            setTimeout(function () {
                FEATURES.Period && FEATURES.Period.fillPeriodSettings();
            }, 100);
            return true;
        }

        // 【新增】经期提醒 - 保存
        if (t.closest('.popup-period-notify .btn-popup-save')) {
            FEATURES.Period && FEATURES.Period.saveNotifySettings();
            return true;
        }
        if (t.closest('.popup-period-notify .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 【新增】经期设置 - 保存
        if (t.closest('.popup-period-setting .btn-popup-save')) {
            FEATURES.Period && FEATURES.Period.savePeriodSettings();
            return true;
        }
        if (t.closest('.popup-period-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }
        if (t.closest('.btn-month-report')) {
            FEATURES.Period && FEATURES.Period.openMonthReport();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 11. 占卜
     * ============================================================ */
    function bindDivination(e) {
        var t = e.target;

        var card = t.closest('.divination-card');
        if (card) {
            $$('.divination-card').forEach(function (c) { c.classList.remove('active'); });
            card.classList.add('active');
            var idx = $$('.divination-card').indexOf(card);
            FEATURES.Divination && FEATURES.Divination.selectType(idx === 0 ? 'tarot' : 'lenormand');
            return true;
        }

        var countBtn = t.closest('.card-count-btn');
        if (countBtn) {
            $$('.card-count-btn').forEach(function (b) { b.classList.remove('active'); });
            countBtn.classList.add('active');
            var n = parseInt(countBtn.textContent) || 1;
            FEATURES.Divination && FEATURES.Divination.selectCount(n);
            return true;
        }

        if (t.closest('.btn-start-divination')) {
            FEATURES.Divination && FEATURES.Divination.start();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 12. 收藏
     * ============================================================ */
    function bindFavorite(e) {
        var t = e.target;

        var tabBtn = t.closest('.favorite-tab-btn');
        if (tabBtn) {
            $$('.favorite-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            var idx = $$('.favorite-tab-btn').indexOf(tabBtn);
            FEATURES.Favorite && (FEATURES.Favorite._type = idx === 0 ? 'mine' : 'ta');
            FEATURES.Favorite && FEATURES.Favorite.render();
            return true;
        }

        if (t.closest('.btn-multi-select')) {
            FEATURES.Favorite && FEATURES.Favorite.toggleMulti();
            return true;
        }
        if (t.closest('.btn-delete-selected')) {
            FEATURES.Favorite && FEATURES.Favorite.deleteSelected();
            return true;
        }
        if (t.closest('.btn-cancel-multi')) {
            FEATURES.Favorite && FEATURES.Favorite.toggleMulti();
            return true;
        }

        var item = t.closest('.favorite-item');
        if (item && FEATURES.Favorite && FEATURES.Favorite._multi) {
            var id = item.dataset.id;
            if (id) FEATURES.Favorite.toggleSelect(id);
            return true;
        }

        return false;
    }

    /* ============================================================
     * 13. 音乐
     * ============================================================ */
    function bindMusic(e) {
        var t = e.target;

        if (t.closest('.btn-add-music')) {
            CORE.openPopup && CORE.openPopup('addMusic');
            return true;
        }
        if (t.closest('.btn-manage-playlist')) {
            CORE.openPopup && CORE.openPopup('managePlaylist');
            return true;
        }
        // 【修改】批量管理
        if (t.closest('.btn-batch-manage')) {
            FEATURES.Music && FEATURES.Music.toggleMulti();
            return true;
        }
        if (t.closest('.btn-new-playlist')) {
            FEATURES.Music && FEATURES.Music.createPlaylist();
            return true;
        }

        var playBtn = t.closest('.music-play-btn');
        if (playBtn) {
            var i = Number(playBtn.dataset.index) || 0;
            FEATURES.Music && FEATURES.Music.play(i);
            return true;
        }

        var delBtn = t.closest('.music-del-btn');
        if (delBtn && delBtn.dataset.id) {
            FEATURES.Music && FEATURES.Music.remove(delBtn.dataset.id);
            return true;
        }

                // 【新增】多选模式下点歌曲项切换选中
        var musicItem = t.closest('.music-item');
        if (musicItem && FEATURES.Music && FEATURES.Music._multi && musicItem.dataset.id) {
            FEATURES.Music.toggleSelectSong(musicItem.dataset.id);
            return true;
        }

        // 【新增】批量管理 - 全选
        if (t.closest('.music-multi-all')) {
            FEATURES.Music && FEATURES.Music.selectAllSongs();
            return true;
        }

        // 【新增】批量管理 - 删除选中
        if (t.closest('.music-multi-del')) {
            FEATURES.Music && FEATURES.Music.deleteSelectedSongs();
            return true;
        }

        // 【新增】批量管理 - 取消
        if (t.closest('.music-multi-cancel')) {
            FEATURES.Music && FEATURES.Music.toggleMulti();
            return true;
        }

        var tabBtn = t.closest('.music-tab-btn');
        if (tabBtn) {
            $$('.music-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            return true;
        }

        return false;
    }

    /* ============================================================
     * 14. 提问
     * ============================================================ */
    function bindQuestion(e) {
        var t = e.target;

        if (t.closest('.btn-add-question')) {
            CORE.openPopup && CORE.openPopup('newQuestion');
            return true;
        }

        var tabBtn = t.closest('.question-tab-btn');
        if (tabBtn) {
            $$('.question-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            var idx = $$('.question-tab-btn').indexOf(tabBtn);
            FEATURES.Question && (FEATURES.Question._type = idx === 0 ? 'mine' : 'ta');
            FEATURES.Question && FEATURES.Question.render();
            return true;
        }

        var opt = t.closest('.q-option');
        if (opt && opt.dataset.qid && opt.dataset.opt) {
            FEATURES.Question && FEATURES.Question.answer(opt.dataset.qid, opt.dataset.opt);
            return true;
        }

        return false;
    }

    /* ============================================================
     * 15. 喝水
     * ============================================================ */
    function bindWater(e) {
        var t = e.target;

        if (t.closest('.btn-water-plus')) {
            FEATURES.Water && FEATURES.Water.addCup();
            return true;
        }
        if (t.closest('.btn-water-minus')) {
            FEATURES.Water && FEATURES.Water.minusCup();
            return true;
        }
        if (t.closest('.btn-send-to-chat')) {
            FEATURES.Water && FEATURES.Water.sendToChat();
            return true;
        }
        if (t.closest('.btn-ta-remind')) {
            FEATURES.Water && FEATURES.Water.taRemind();
            return true;
        }
        if (t.closest('.btn-set-water-goal')) {
            CORE.openPopup && CORE.openPopup('setWaterGoal');
            return true;
        }
        if (t.closest('.btn-set-once-volume')) {
            CORE.openPopup && CORE.openPopup('setOnceVolume');
            return true;
        }
        if (t.closest('.btn-add-water-wordcard')) {
            CORE.openPopup && CORE.openPopup('addWaterWordcard');
            return true;
        }

        return false;
    }

    /* ============================================================
     * 16. 设置
     * ============================================================ */
    function bindSetting(e) {
        var t = e.target;

        // 字卡库 tab
        var wcTab = t.closest('.wordcard-tab-btn');
        if (wcTab) {
            var typeMap = {
                '主字卡': 'main',
                '颜文字': 'kaomoji',
                'Emoji': 'emoji',
                '表情库': 'sticker',
                '语音': 'voice'
            };
            var type = typeMap[wcTab.textContent.trim()] || 'main';
            if (WORDCARD_LIB.switchType) {
                WORDCARD_LIB.switchType(type);
            } else {
                $$('.wordcard-tab-btn').forEach(function (b) { b.classList.remove('active'); });
                wcTab.classList.add('active');
            }
            return true;
        }

        // 字卡库工具按钮
        if (t.closest('.wordcard-tool-btn')) {
            var btn = t.closest('.wordcard-tool-btn');
            var label = btn.textContent || '';
            var LIB = WORDCARD_LIB;
            if (!LIB) { ENV.tip && ENV.tip('字卡库未加载'); return true; }

            if (label.indexOf('🔍') > -1) {
                var popup = $('.popup-wordcard-lib');
                var existing = popup && popup.querySelector('.wc-search-input');
                if (existing) {
                    existing.parentNode.removeChild(existing);
                } else {
                    var input = document.createElement('input');
                    input.className = 'wc-search-input';
                    input.type = 'text';
                    input.placeholder = '搜索字卡';
                    input.style.cssText = 'width:100%;border:1px solid #eee;border-radius:10px;padding:8px 12px;font-size:14px;outline:none;box-sizing:border-box;margin-bottom:10px;background:#f8f8f8';
                    input.addEventListener('input', function () { LIB.search(input.value); });
                    var listEl = popup.querySelector('.wordcard-list');
                    listEl.parentNode.insertBefore(input, listEl);
                    input.focus();
                }
            } else if (label.indexOf('📁') > -1) {
                LIB.toggleMulti();
            } else if (label.indexOf('⬜') > -1) {
                LIB.selectAll();
            } else if (label.indexOf('⬇') > -1) {
                LIB.exportAll();
            } else if (label.indexOf('⬆') > -1) {
                LIB.importFromFile();
            }
            return true;
        }

        // 新增字卡
        if (t.closest('.btn-add-wordcard')) {
            if (WORDCARD_LIB.openAdd) {
                WORDCARD_LIB.openAdd();
            } else if (FEATURES.openModal) {
                FEATURES.openModal({
                    title: '新增字卡',
                    fields: [{ key: 'text', label: '内容', type: 'text', placeholder: '输入字卡内容' }],
                    buttons: [
                        { text: '取消' },
                        { text: '添加', primary: true, onClick: function (v) {
                            if (!v.text) return false;
                            DATA.Wordcard.add('main', { text: v.text.trim() });
                            ENV.tip && ENV.tip('已添加');
                        }}
                    ]
                });
            }
            return true;
        }

        // 回复设置
        if (t.closest('.popup-reply-setting .btn-popup-save')) {
            FEATURES.Setting && FEATURES.Setting.saveReply();
            return true;
        }
        if (t.closest('.popup-reply-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 朋友圈设置
        if (t.closest('.popup-moments-setting .btn-popup-save')) {
            FEATURES.Setting && FEATURES.Setting.saveMoments();
            return true;
        }
        if (t.closest('.popup-moments-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 信件设置
        if (t.closest('.popup-letter-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 深色模式
        var radio = t.closest('.popup-dark-mode .radio-row');
        if (radio) {
            var input = radio.querySelector('input[type="radio"]');
            if (input) {
                input.checked = true;
                THEME.saveFromDarkPopup && THEME.saveFromDarkPopup();
            }
            return true;
        }
        if (t.closest('.popup-dark-mode .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 【新增】发送方式设置
        if (t.closest('.popup-chat-send-setting .btn-popup-save')) {
            FEATURES.Setting && FEATURES.Setting.saveChatSend();
            return true;
        }
        if (t.closest('.popup-chat-send-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 后台通知测试
        if (t.closest('.btn-test-notify')) {
            ENV.testNotify && ENV.testNotify();
            return true;
        }
        if (t.closest('.popup-notify-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        // 通用开关
        var switchRow = t.closest('.setting-switch-row');
        if (switchRow) {
            var toggle = switchRow.querySelector('.switch-toggle');
            if (toggle && toggle.tagName !== 'INPUT') {
                toggle.classList.toggle('on');
            }
            var label2 = switchRow.querySelector('label');
            if (label2 && label2.textContent.indexOf('后台通知') > -1) {
                var checked = toggle && (toggle.classList.contains('on') || toggle.checked);
                FEATURES.Setting && FEATURES.Setting.toggleNotify(checked);
            }
            return true;
        }

        // 数据弹窗
        var dataBtn = t.closest('.popup-data-setting .popup-option-btn');
        if (dataBtn) {
            var dt = dataBtn.textContent || '';
            if (dt.indexOf('导入') > -1) {
                BACKUP.pickAndImport && BACKUP.pickAndImport().then(function () {
                    ENV.tip && ENV.tip('导入成功');
                    location.reload();
                }).catch(function (err) {
                    ENV.tip && ENV.tip('导入失败：' + err.message);
                });
            } else if (dt.indexOf('导出') > -1) {
                BACKUP.exportToFile && BACKUP.exportToFile();
            } else if (dt.indexOf('清除') > -1) {
                if (confirm('确定清除所有数据吗？此操作不可恢复')) {
                    DATA.All.clearAll();
                    ENV.tip && ENV.tip('已清除');
                    location.reload();
                }
            }
            return true;
        }
        if (t.closest('.popup-data-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        if (t.closest('.popup-storage-setting .btn-popup-close')) {
            CORE.closePopup && CORE.closePopup();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 17. 商城
     * ============================================================ */
    function bindShop(e) {
        var t = e.target;

        // 搜索
        if (t.classList && t.classList.contains('shop-search-input')) {
            return false;
        }

        if (t.closest('.btn-wish-product')) {
            CORE.openPopup && CORE.openPopup('wishGoods');
            return true;
        }

        var shopTab = t.closest('.shop-tab-btn');
        if (shopTab) {
            $$('.shop-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            shopTab.classList.add('active');
            var tab = shopTab.dataset.shopTab;
            $$('.shop-tab-content').forEach(function (c) { c.classList.remove('active'); });
            var content = document.querySelector('.shop-tab-content.tab-' + tab);
            if (content) content.classList.add('active');
            return true;
        }

        // 【v3 修复】商城「> 全部」→ MALL_ALL.open()
        if (t.closest('.btn-shop-all')) {
            if (MALL_ALL.open) {
                MALL_ALL.open();
            } else {
                ENV.tip && ENV.tip('全部商品未加载');
            }
            return true;
        }

        var addBtn = t.closest('.btn-add-cart');
        if (addBtn) {
            var id = addBtn.dataset.id;
            var category = addBtn.dataset.category || 'recommend';
            if (id) FEATURES.Shop && FEATURES.Shop.addToCart(id, category);
            return true;
        }

        if (t.closest('.btn-add-spec')) {
            var specWrap = $('.spec-wrap');
            if (specWrap) {
                var specInput = document.createElement('input');
                specInput.type = 'text';
                specInput.placeholder = '规格';
                specInput.style.cssText = 'margin-top:6px;width:100%';
                specWrap.appendChild(specInput);
            }
            return true;
        }

        var nav = t.closest('.shop-nav-item');
        if (nav) {
            var page = nav.dataset.targetPage;
            if (page) {
                CORE.showPage && CORE.showPage(page);
                $$('.shop-nav-item').forEach(function (n) { n.classList.remove('active'); });
                nav.classList.add('active');
            }
            return true;
        }

        return false;
    }

    function bindShopInput(e) {
        var t = e.target;
        if (t.classList && t.classList.contains('shop-search-input')) {
            FEATURES.Shop && FEATURES.Shop.search(t.value);
        }
    }

    /* ============================================================
     * 17.1 余额输入框（v3 修复）
     *      用 input 事件委托，不再 once
     * ============================================================ */
    function bindBalanceInput(e) {
        var t = e.target;
        if (!t.classList || !t.classList.contains('balance-input')) return;

        var v = Number(t.value);
        if (isNaN(v)) return;
        DATA.Shop.setBalance(v);
    }

    /* ============================================================
     * 18. 购物车
     * ============================================================ */
    function bindCart(e) {
        var t = e.target;

        if (t.classList && t.classList.contains('cart-checkbox-all')) {
            FEATURES.Cart && FEATURES.Cart.selectAll(t.checked);
            return true;
        }

        if (t.classList && t.classList.contains('cart-checkbox')) {
            var card = t.closest('.cart-item-card');
            var id = card && card.dataset.id;
            if (id) FEATURES.Cart && FEATURES.Cart.toggleSelect(id, t.checked);
            return true;
        }

        var minus = t.closest('.cart-minus');
        if (minus) {
            FEATURES.Cart && FEATURES.Cart.changeCount(minus.dataset.id, -1);
            return true;
        }
        var plus = t.closest('.cart-plus');
        if (plus) {
            FEATURES.Cart && FEATURES.Cart.changeCount(plus.dataset.id, 1);
            return true;
        }

        if (t.closest('.btn-cart-delete')) {
            if (confirm('确定删除选中的商品吗？')) {
                FEATURES.Cart && FEATURES.Cart.deleteSelected();
            }
            return true;
        }

        if (t.closest('.btn-cart-settle')) {
            FEATURES.Cart && FEATURES.Cart.settle();
            return true;
        }

        return false;
    }

    /* ============================================================
     * 19. 订单
     * ============================================================ */
    function bindOrder(e) {
        var t = e.target;

        var tabBtn = t.closest('.order-tab-btn');
        if (tabBtn) {
            $$('.order-tab-btn').forEach(function (b) { b.classList.remove('active'); });
            tabBtn.classList.add('active');
            var text = tabBtn.textContent || '';
            var map = { '全部': 'all', '待送达': 'pending', '已完成': 'done', '已取消': 'cancelled' };
            var status = map[text.trim()] || 'all';
            FEATURES.Order && FEATURES.Order.setTab(status);
            return true;
        }

        return false;
    }

    /* ============================================================
     * 20. 首页第二页
     * ============================================================ */
    function bindHomeSecond(e) {
        var t = e.target;

        // 播放器
        if (t.closest('.btn-player-play')) {
            var A = global.APP_AUDIO;
            if (A && A.toggle) A.toggle();
            return true;
        }
        if (t.closest('.btn-player-prev')) {
            var A2 = global.APP_AUDIO;
            if (A2 && A2.prev) A2.prev();
            return true;
        }
        if (t.closest('.btn-player-next')) {
            var A3 = global.APP_AUDIO;
            if (A3 && A3.next) A3.next();
            return true;
        }

        // 【v3 修复】经期预览卡 → 跳经期页
        if (t.closest('.period-preview-card')) {
            CORE.showPage && CORE.showPage('periodPage');
            return true;
        }

        // 备忘
        if (t.closest('.memo-preview-card')) {
            FEATURES.Home && FEATURES.Home.editMemo();
            return true;
        }

        // 心情
        if (t.closest('.mood-preview-card')) {
            _openMoodPicker();
            return true;
        }

        return false;
    }

    function _openMoodPicker() {
        var moods = MOOD.listMoods ? MOOD.listMoods() : null;
        if (!moods) {
            ENV.tip && ENV.tip('情绪系统未加载');
            return;
        }

        var html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:10px 0">'
            + Object.keys(moods).map(function (k) {
                var m = moods[k];
                return '<div class="mood-pick-item" data-mood="' + k + '" style="text-align:center;padding:14px 6px;border-radius:12px;background:#f8f8f8;cursor:pointer">'
                    + '<div style="font-size:32px;margin-bottom:6px">' + (m.emoji || '😊') + '</div>'
                    + '<div style="font-size:13px;color:#333">' + esc(m.name || k) + '</div>'
                    + '</div>';
            }).join('')
            + '</div>';

        FEATURES.openModal && FEATURES.openModal({
            title: '今天的心情',
            fields: [{ key: 'm', type: 'textarea', value: '', label: '' }],
            buttons: [{ text: '关闭', primary: true }],
            onOpen: function (box) {
                var ta = box.querySelector('textarea');
                ta.style.display = 'none';
                var div = document.createElement('div');
                div.innerHTML = html;
                ta.parentNode.appendChild(div);

                div.addEventListener('click', function (e) {
                    var item = e.target.closest('.mood-pick-item');
                    if (!item) return;
                    var mood = item.getAttribute('data-mood');
                    if (MOOD.set) MOOD.set(mood, 75, { source: 'userPick' });
                    var info = MOOD.getMoodInfo && MOOD.getMoodInfo(mood);
                    ENV.tip && ENV.tip('今天心情：' + (info ? info.name : mood));
                    var mask = box.closest('.app-dynamic-modal');
                    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
                });
            }
        });
    }

    function esc(s) {
        return UTILS.Str && UTILS.Str.escapeHtml ? UTILS.Str.escapeHtml(s) : String(s || '');
    }

    /* ============================================================
     * 21. 主点击委托
     * ============================================================ */
    function onDocumentClick(e) {
        try {
            if (bindGlobalHeader(e)) return;
            if (bindHome(e)) return;
            if (bindChatRoom(e)) return;
            if (bindCall(e)) return;
            if (bindChatInfo(e)) return;
            if (bindPopups(e)) return;
            if (bindLetter(e)) return;
            if (bindMoments(e)) return;
            if (bindPeriod(e)) return;
            if (bindDivination(e)) return;
            if (bindFavorite(e)) return;
            if (bindMusic(e)) return;
            if (bindQuestion(e)) return;
            if (bindWater(e)) return;
            if (bindSetting(e)) return;
            if (bindShop(e)) return;
            if (bindCart(e)) return;
            if (bindOrder(e)) return;
            if (bindHomeSecond(e)) return;
        } catch (err) {
            Log.error('[listeners] 点击处理出错:', err);
        }
    }

    /* ============================================================
     * 22. 其他全局事件
     * ============================================================ */
    function onDocumentInput(e) {
        bindChatListInput(e);
        bindShopInput(e);
        bindBalanceInput(e);   // 【v3 修复】
    }

    function onDocumentKeydown(e) {
        bindChatRoomKeydown(e);
    }

    function onVisibilityChange() {
        if (!document.hidden) {
            var page = STATE.Page && STATE.Page.current();
            if (page && FEATURES.Chat && page === 'chatRoom') {
                FEATURES.Chat.renderRoom();
            }
        }
    }

    /* ============================================================
     * 23. 绑定 / 解绑
     * ============================================================ */
    function bind() {
        if (_bound) return;
        document.addEventListener('click', onDocumentClick, false);
        document.addEventListener('input', onDocumentInput, false);
        document.addEventListener('keydown', onDocumentKeydown, false);
        document.addEventListener('visibilitychange', onVisibilityChange, false);
        _bound = true;
        Log.log('[listeners] 事件已绑定');
    }

    function unbind() {
        if (!_bound) return;
        document.removeEventListener('click', onDocumentClick, false);
        document.removeEventListener('input', onDocumentInput, false);
        document.removeEventListener('keydown', onDocumentKeydown, false);
        document.removeEventListener('visibilitychange', onVisibilityChange, false);
        _bound = false;
    }

    /* ============================================================
     * 24. 页面进入钩子
     * ============================================================ */
    function bindPageEnterEvents() {
       
        CORE.on('page:change', function (data) {
            var page = data && data.to;
            if (!page) return;

            try {
                switch (page) {
                    case 'homeFirst':    FEATURES.Home && FEATURES.Home.onEnter && FEATURES.Home.onEnter(); break;
                    case 'homeSecond':   FEATURES.Home && FEATURES.Home.renderMemo && FEATURES.Home.renderMemo(); break;
                    case 'chatList':     FEATURES.Chat && FEATURES.Chat.onEnterList && FEATURES.Chat.onEnterList(); break;
                    case 'chatRoom':     FEATURES.Chat && FEATURES.Chat.onEnterRoom && FEATURES.Chat.onEnterRoom(); break;
                    case 'letterPage':   FEATURES.Letter && FEATURES.Letter.onEnter && FEATURES.Letter.onEnter(); break;
                    case 'momentsPage':  FEATURES.Moments && FEATURES.Moments.onEnter && FEATURES.Moments.onEnter(); break;
                    case 'periodPage':   FEATURES.Period && FEATURES.Period.onEnter && FEATURES.Period.onEnter(); break;
                    case 'messageRecordPage': FEATURES.MessageRecord && FEATURES.MessageRecord.onEnter && FEATURES.MessageRecord.onEnter(); break;
                    case 'favoritePage': FEATURES.Favorite && FEATURES.Favorite.onEnter && FEATURES.Favorite.onEnter(); break;
                    case 'musicPage':    FEATURES.Music && FEATURES.Music.onEnter && FEATURES.Music.onEnter(); break;
                    case 'questionPage': FEATURES.Question && FEATURES.Question.onEnter && FEATURES.Question.onEnter(); break;
                    case 'waterPage':    FEATURES.Water && FEATURES.Water.onEnter && FEATURES.Water.onEnter(); break;
                    case 'shopPage':     FEATURES.Shop && FEATURES.Shop.onEnter && FEATURES.Shop.onEnter(); break;
                    case 'cartPage':     FEATURES.Cart && FEATURES.Cart.onEnter && FEATURES.Cart.onEnter(); break;
                    case 'orderPage':    FEATURES.Order && FEATURES.Order.onEnter && FEATURES.Order.onEnter(); break;
                }
            } catch (err) {
                Log.error('[listeners] onEnter 出错:', page, err);
            }
        });

        // 数据变更 → 自动渲染
        CORE.on('data:change', function (data) {
            if (!data) return;
            var page = STATE.Page && STATE.Page.current();
            try {
                if (data.module === 'favorite' && page === 'favoritePage') FEATURES.Favorite && FEATURES.Favorite.render();
                if (data.module === 'shop' && page === 'shopPage') FEATURES.Shop && FEATURES.Shop.render();
                if (data.module === 'shop' && page === 'cartPage') FEATURES.Cart && FEATURES.Cart.render();
                if (data.module === 'shop' && page === 'orderPage') FEATURES.Order && FEATURES.Order.render();
                if (data.module === 'letter') FEATURES.Letter && FEATURES.Letter.render();
                if (data.module === 'moments') FEATURES.Moments && FEATURES.Moments.render();
                if (data.module === 'water') FEATURES.Water && FEATURES.Water.render();
                if (data.module === 'music') FEATURES.Music && FEATURES.Music.render();
                if (data.module === 'question') FEATURES.Question && FEATURES.Question.render();
            } catch (err) {
                Log.error('[listeners] data:change 渲染出错:', err);
            }
        });

        CORE.on('message:render', function (data) {
            if (!data) return;
            var page = STATE.Page && STATE.Page.current();
            if (page === 'chatRoom' && STATE.get('currentChatId') === data.chatId) {
                FEATURES.Chat && FEATURES.Chat.renderRoom();
            }
        });
    }
     // 【新增】打开"发送方式"弹窗时，回填选中状态
        CORE.on('popup:open', function (data) {
           if (data && data.name === 'chatSendSetting') {
               FEATURES.Setting && FEATURES.Setting.fillChatSendRadio();
        }
    });

    /* ============================================================
     * 25. 初始化
     * ============================================================ */
    function init() {
        bind();
        bindPageEnterEvents();
        Log.log('[listeners] 初始化完成');
    }

    /* ============================================================
     * 26. 对外导出
     * ============================================================ */
    var APP_LISTENERS = {
        init: init,
        bind: bind,
        unbind: unbind
    };

    global.APP_LISTENERS = APP_LISTENERS;

})(typeof window !== 'undefined' ? window : this);