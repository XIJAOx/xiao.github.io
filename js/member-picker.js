/**
 * member-picker.js
 * 群聊选成员弹窗
 * 依赖：config / utils / state / core / data / reply-library
 * 被依赖：listeners.js / group-chat.js
 *
 * 功能：
 * 1. 弹出角色列表，多选
 * 2. 支持搜索
 * 3. 确定后返回选中的 id 数组
 * 4. 也能直接把选中成员渲染进 createGroup 弹窗
 *
 * 挂到 window.APP_MEMBER_PICKER 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};

    var Str = UTILS.Str;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }

    /* ============================================================
     * 内部状态
     * ============================================================ */
    var _maskEl = null;      // 遮罩
    var _selected = [];       // 已选中的角色 id
    var _onDone = null;       // 完成回调
    var _exclude = [];        // 排除的角色 id（已在群里的）
    var _multi = true;        // 是否多选

    /* ============================================================
     * 1. 生成一个默认角色（如果角色表是空的）
     * ============================================================ */
    function _ensureCharacters() {
        var list = DATA.Character.list();
        if (!list || list.length === 0) {
            // 写入一个默认的 TA
            DATA.Character.add({
                id: 'ta',
                name: 'TA',
                avatar: '',
                isDefault: true
            });
            list = DATA.Character.list();
        }
        return list;
    }

    /* ============================================================
     * 2. 创建弹窗 DOM
     * ============================================================ */
    function _buildMask() {
        var mask = document.createElement('div');
        mask.className = 'app-member-picker';
        mask.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:rgba(0,0,0,0.45)', 'z-index:99996',
            'display:flex', 'align-items:flex-end', 'justify-content:center',
            'opacity:0', 'transition:opacity 0.2s'
        ].join(';');

        mask.addEventListener('click', function (e) {
            if (e.target === mask) close();
        });

        return mask;
    }

    function _buildPanel() {
        var panel = document.createElement('div');
        panel.style.cssText = [
            'background:#fff',
            'border-radius:20px 20px 0 0',
            'width:100%',
            'max-width:500px',
            'max-height:80vh',
            'display:flex',
            'flex-direction:column',
            'transform:translateY(100%)',
            'transition:transform 0.28s ease'
        ].join(';');

        // 顶部
        panel.innerHTML =
            '<div style="padding:16px 20px;border-bottom:1px solid #f2f2f2;display:flex;align-items:center;justify-content:space-between">' +
                '<span class="mp-cancel" style="font-size:15px;color:#666;cursor:pointer">取消</span>' +
                '<span style="font-size:16px;font-weight:600">选择成员</span>' +
                '<span class="mp-done" style="font-size:15px;color:#000;font-weight:500;cursor:pointer">确定</span>' +
            '</div>' +
            '<div style="padding:12px 20px">' +
                '<input class="mp-search" type="text" placeholder="搜索名字" ' +
                'style="width:100%;border:1px solid #eee;border-radius:12px;padding:10px 14px;font-size:14px;outline:none;box-sizing:border-box;background:#f8f8f8">' +
            '</div>' +
            '<div class="mp-list" style="flex:1;overflow-y:auto;padding:0 20px 20px"></div>';

        return panel;
    }

    /* ============================================================
     * 3. 渲染角色列表
     * ============================================================ */
    function _renderList(keyword) {
        var listEl = _maskEl.querySelector('.mp-list');
        if (!listEl) return;

        var chars = _ensureCharacters();
        var kw = (keyword || '').trim();

        var filtered = chars.filter(function (c) {
            // 排除列表
            if (_exclude.indexOf(c.id) > -1) return false;
            // 搜索
            if (kw && (c.name || '').indexOf(kw) === -1) return false;
            return true;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0">没有找到成员</p>';
            return;
        }

        listEl.innerHTML = filtered.map(function (c) {
            var checked = _selected.indexOf(c.id) > -1;
            return '<div class="mp-item" data-id="' + c.id + '" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f7f7f7;cursor:pointer">' +
                '<div class="avatar avatar-ta-small" style="' + (c.avatar ? 'background-image:url(' + c.avatar + ');background-size:cover' : '') + '"></div>' +
                '<div style="flex:1">' +
                    '<p style="font-size:15px;margin:0 0 2px">' + esc(c.name || 'TA') + '</p>' +
                '</div>' +
                '<div class="mp-check" style="width:24px;height:24px;border-radius:50%;border:2px solid ' + (checked ? '#000' : '#ddd') + ';background:' + (checked ? '#000' : '#fff') + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px">' + (checked ? '✓' : '') + '</div>' +
            '</div>';
        }).join('');

        // 绑定点击
        listEl.querySelectorAll('.mp-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var id = item.getAttribute('data-id');
                toggleSelect(id);
            });
        });
    }

    /* ============================================================
     * 4. 选中 / 取消
     * ============================================================ */
    function toggleSelect(id) {
        var i = _selected.indexOf(id);
        if (i > -1) {
            _selected.splice(i, 1);
        } else {
            if (!_multi) _selected = [];
            _selected.push(id);
        }
        _renderList(_maskEl.querySelector('.mp-search') ? _maskEl.querySelector('.mp-search').value : '');
    }

    function getSelected() {
        return _selected.slice();
    }

    function setSelected(ids) {
        _selected = (ids || []).slice();
    }

    /* ============================================================
     * 5. 打开 / 关闭
     * ============================================================ */

    /**
     * 打开选成员弹窗
     * @param {object} options
     *   - exclude: 排除的角色 id 数组（比如已在群里的）
     *   - selected: 初始选中的 id 数组
     *   - multi: 是否多选（默认 true）
     *   - onDone: (ids) => void 完成回调
     */
    function open(options) {
        options = options || {};

        if (_maskEl) close();

        _exclude = options.exclude || [];
        _selected = options.selected || [];
        _multi = options.multi !== false;
        _onDone = options.onDone || null;

        _ensureCharacters();

        var mask = _buildMask();
        var panel = _buildPanel();
        mask.appendChild(panel);
        document.body.appendChild(mask);
        _maskEl = mask;

        // 入场动画
        requestAnimationFrame(function () {
            mask.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
        });

        // 渲染列表
        _renderList('');

        // 搜索输入
        var search = panel.querySelector('.mp-search');
        if (search) {
            search.addEventListener('input', function () {
                _renderList(search.value);
            });
        }

        // 取消
        panel.querySelector('.mp-cancel').addEventListener('click', function () {
            close();
        });

        // 确定
        panel.querySelector('.mp-done').addEventListener('click', function () {
            var result = _selected.slice();
            var cb = _onDone;
            close();
            if (cb) cb(result);
        });
    }

    function close() {
        if (!_maskEl) return;
        var mask = _maskEl;
        var panel = mask.firstChild;

        if (panel) panel.style.transform = 'translateY(100%)';
        mask.style.opacity = '0';

        setTimeout(function () {
            if (mask.parentNode) mask.parentNode.removeChild(mask);
            if (_maskEl === mask) _maskEl = null;
        }, 280);
    }

    /* ============================================================
     * 6. 与"发起群聊"弹窗联动
     * ============================================================ */

    /**
     * 在创建群聊弹窗里点"+ 添加群成员"时调用
     * - 打开选人
     * - 把选中的成员渲染进 .member-list
     */
    function pickForCreateGroup() {
        var popup = document.querySelector('.popup-create-group');
        if (!popup) return;

        var memberListEl = popup.querySelector('.member-list');
        if (!memberListEl) return;

        // 已在列表里的 id
        var existing = [];
        memberListEl.querySelectorAll('.member-item').forEach(function (el) {
            var id = el.getAttribute('data-member-id') || el.dataset.memberId;
            if (id) existing.push(id);
        });

        open({
            exclude: existing,
            multi: true,
            onDone: function (ids) {
                if (ids.length === 0) return;
                _appendMembersToCreateGroup(memberListEl, ids);
            }
        });
    }

    /**
     * 把选中的成员加到 .member-list
     */
    function _appendMembersToCreateGroup(memberListEl, ids) {
        var chars = _ensureCharacters();

        ids.forEach(function (id) {
            var c = chars.filter(function (x) { return x.id === id; })[0];
            if (!c) return;

            var el = document.createElement('div');
            el.className = 'member-item';
            el.setAttribute('data-member-id', c.id);
            el.dataset.memberId = c.id;
            el.innerHTML =
                '<div class="avatar avatar-ta-small" style="' + (c.avatar ? 'background-image:url(' + c.avatar + ');background-size:cover' : '') + '"></div>' +
                '<span>' + esc(c.name || 'TA') + '</span>';

            // 点击移除
            el.style.cursor = 'pointer';
            el.addEventListener('click', function () {
                if (confirm('移除成员 ' + (c.name || 'TA') + '？')) {
                    el.remove();
                }
            });

            memberListEl.appendChild(el);
        });

        Log.log('[member-picker] 已添加成员:', ids.join(', '));
    }

    /**
     * 从创建群聊弹窗收集所有成员 id
     */
    function collectCreateGroupMembers() {
        var popup = document.querySelector('.popup-create-group');
        if (!popup) return [];

        var ids = [];
        popup.querySelectorAll('.member-item').forEach(function (el) {
            var id = el.getAttribute('data-member-id') || el.dataset.memberId;
            if (id) ids.push(id);
        });
        return ids;
    }

    /* ============================================================
     * 7. 给已存在的群添加成员
     * ============================================================ */

    /**
     * 给某个群添加成员
     * @param {string} groupId
     * @param {Function} onDone (addedIds) => void
     */
    function pickForAddToGroup(groupId, onDone) {
        var group = DATA.Group.get(groupId);
        if (!group) {
            Log.warn('[member-picker] 找不到群:', groupId);
            return;
        }

        open({
            exclude: group.members || [],
            multi: true,
            onDone: function (ids) {
                if (ids.length === 0) return;
                ids.forEach(function (id) {
                    DATA.Group.update(groupId, {
                        members: (DATA.Group.get(groupId).members || []).concat([id])
                    });
                });
                // 重新读取一遍（避免并发问题）
                var g = DATA.Group.get(groupId);
                if (g) {
                    var newMembers = (g.members || []).concat(ids.filter(function (id) {
                        return (g.members || []).indexOf(id) === -1;
                    }));
                    DATA.Group.update(groupId, { members: newMembers });
                }
                if (onDone) onDone(ids);
                Log.log('[member-picker] 群', groupId, '新增成员:', ids.join(', '));
            }
        });
    }

    /* ============================================================
     * 8. 初始化
     * ============================================================ */
    function init() {
        // 首次进入，把默认 TA 补进聊天信息页的成员列表
        var chars = _ensureCharacters();
        var first = chars[0];

        var infoMemberList = document.querySelector('.popup-create-group .member-list');
        if (infoMemberList && first) {
            var items = infoMemberList.querySelectorAll('.member-item');
            // 如果只有一个且没 data-member-id，就补上
            if (items.length > 0 && !items[0].getAttribute('data-member-id')) {
                items[0].setAttribute('data-member-id', first.id);
                items[0].dataset.memberId = first.id;
            }
        }

        Log.log('[member-picker] 初始化完成，角色数:', chars.length);
    }

    /* ============================================================
     * 9. 对外导出
     * ============================================================ */
    var APP_MEMBER_PICKER = {
        init: init,
        open: open,
        close: close,
        toggleSelect: toggleSelect,
        getSelected: getSelected,
        setSelected: setSelected,

        pickForCreateGroup: pickForCreateGroup,
        pickForAddToGroup: pickForAddToGroup,
        collectCreateGroupMembers: collectCreateGroupMembers
    };

    global.APP_MEMBER_PICKER = APP_MEMBER_PICKER;

})(typeof window !== 'undefined' ? window : this);