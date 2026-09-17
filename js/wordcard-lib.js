/**
 * wordcard-lib.js
 * 字卡库完整功能
 * 依赖：config / utils / data / core / envelope
 * 被依赖：listeners.js
 *
 * 功能：
 * 1. 5 个 Tab 切换不同类型
 * 2. 搜索
 * 3. 全选 / 多选
 * 4. 导出 / 导入 JSON
 * 5. 新增 / 编辑 / 删除
 *
 * 挂到 window.APP_WORDCARD_LIB 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var DATA = global.APP_DATA || {};
    var CORE = global.APP_CORE || {};
    var ENV = global.APP_ENVELOPE || {};

    var Str = UTILS.Str;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    function esc(s) { return Str.escapeHtml ? Str.escapeHtml(s) : String(s || ''); }
    function $(s, p) { return (p || document).querySelector(s); }
    function $$(s, p) { return Array.prototype.slice.call((p || document).querySelectorAll(s)); }

    /* ============================================================
     * 内部状态
     * ============================================================ */
    var _type = 'main';          // 当前 Tab
    var _keyword = '';            // 搜索词
    var _multi = false;           // 多选模式
    var _selected = [];           // 选中的字卡 id

    var TYPE_LABELS = {
        main: '主字卡',
        kaomoji: '颜文字',
        emoji: 'Emoji',
        sticker: '表情库',
        voice: '语音'
    };

    /* ============================================================
     * 1. 弹窗元素获取
     * ============================================================ */
    function _getPopup() {
        return document.querySelector('.popup-wordcard-lib');
    }

    function _getListEl() {
        var popup = _getPopup();
        return popup ? popup.querySelector('.wordcard-list') : null;
    }

    /* ============================================================
     * 2. 渲染列表
     * ============================================================ */
    function render() {
        var listEl = _getListEl();
        if (!listEl) return;

        var list = DATA.Wordcard.getByType(_type);

        // 搜索过滤
        if (_keyword) {
            var kw = _keyword.toLowerCase();
            list = list.filter(function (item) {
                var text = typeof item === 'string' ? item : (item.text || '');
                return text.toLowerCase().indexOf(kw) > -1;
            });
        }

        if (list.length === 0) {
            var emptyText = _keyword
                ? '没有找到匹配的字卡'
                : '列表空空如也<br>暂无内容';
            listEl.innerHTML = '<p class="empty-tip" style="text-align:center;padding:40px 0;color:#999">' + emptyText + '</p>';
            return;
        }

        var isEmoji = _type === 'emoji';
        var isSticker = _type === 'sticker';
        var isVoice = _type === 'voice';

        listEl.innerHTML = list.map(function (item) {
            var id = item.id || item;
            var text = typeof item === 'string' ? item : (item.text || '');
            var checked = _selected.indexOf(id) > -1;
            var check = _multi
                ? '<div class="wc-check" style="width:22px;height:22px;border-radius:50%;border:2px solid ' + (checked ? '#000' : '#ddd') + ';background:' + (checked ? '#000' : '#fff') + ';color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px">' + (checked ? '✓' : '') + '</div>'
                : '';

            // 不同 Tab 显示不同样式
            var contentHtml;
            if (isEmoji) {
                contentHtml = '<span style="font-size:28px">' + esc(text) + '</span>';
            } else if (isSticker) {
                contentHtml = text.indexOf('data:') === 0 || text.indexOf('http') === 0
                    ? '<img src="' + esc(text) + '" style="max-width:60px;max-height:60px;border-radius:8px">'
                    : '<span style="font-size:13px;color:#999">[表情]</span>';
            } else if (isVoice) {
                contentHtml = '<span style="font-size:14px">🎤 ' + esc(text) + '</span>';
            } else {
                contentHtml = '<span style="font-size:14px;line-height:1.4;word-break:break-all">' + esc(text) + '</span>';
            }

            // 【新增】语音类型加播放按钮
            var playBtn = '';
            if (isVoice) {
                playBtn = '<span class="wc-play" data-id="' + id + '" style="color:#4299e1;font-size:16px;cursor:pointer;padding:0 6px;flex-shrink:0">▶</span>';
            }

            var delBtn = !_multi
                ? '<span class="wc-del" data-id="' + id + '" style="color:#999;font-size:18px;cursor:pointer;padding:0 6px;flex-shrink:0">×</span>'
                : '';

            return '<div class="wc-item" data-id="' + id + '" style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #f2f2f2;cursor:pointer">' +
                check +
                '<div style="flex:1;overflow:hidden">' + contentHtml + '</div>' +
                playBtn +
                delBtn +
            '</div>';
        }).join('');

        // 绑定事件
        _bindListEvents(listEl);
    }

    function _bindListEvents(listEl) {
        // 点击项
        listEl.querySelectorAll('.wc-item').forEach(function (item) {
            item.addEventListener('click', function (e) {
                // 【新增】如果点的是播放按钮
                if (e.target.classList && e.target.classList.contains('wc-play')) {
                    e.stopPropagation();
                    var playId = e.target.getAttribute('data-id');
                    var STICKER = global.APP_STICKER;
                    if (STICKER && STICKER.playVoice) {
                        STICKER.playVoice(playId);
                    }
                    return;
                }

                // 如果点的是删除按钮
                if (e.target.classList && e.target.classList.contains('wc-del')) {
                    e.stopPropagation();
                    var id = e.target.getAttribute('data-id');
                    _confirmDelete(id);
                    return;
                }

                // 多选模式：切换选中
                if (_multi) {
                    var id2 = item.getAttribute('data-id');
                    toggleSelect(id2);
                    return;
                }

                // 普通模式：打开编辑
                var id3 = item.getAttribute('data-id');
                _openEdit(id3);
            });
        });
    }

    /* ============================================================
     * 3. Tab 切换
     * ============================================================ */
    function switchType(type) {
        if (!TYPE_LABELS[type]) return;
        _type = type;
        _selected = [];
        _keyword = '';

        // 更新 Tab 样式
        var popup = _getPopup();
        if (popup) {
            var btns = popup.querySelectorAll('.wordcard-tab-btn');
            btns.forEach(function (b) {
                b.classList.remove('active');
                if (b.textContent.trim() === TYPE_LABELS[type]) {
                    b.classList.add('active');
                }
            });

            // 清空搜索框
            var searchInput = popup.querySelector('.wc-search-input');
            if (searchInput) searchInput.value = '';
        }

        render();
    }

    /* ============================================================
     * 4. 搜索
     * ============================================================ */
    function search(keyword) {
        _keyword = (keyword || '').trim();
        render();
    }

    /* ============================================================
     * 5. 多选 / 全选
     * ============================================================ */
    function toggleMulti() {
        _multi = !_multi;
        _selected = [];
        render();
        if (ENV.tip) ENV.tip(_multi ? '多选模式已开启' : '多选模式已关闭');
    }

    function selectAll() {
        if (!_multi) {
            _multi = true;
        }
        var list = DATA.Wordcard.getByType(_type);
        if (_keyword) {
            var kw = _keyword.toLowerCase();
            list = list.filter(function (item) {
                var text = typeof item === 'string' ? item : (item.text || '');
                return text.toLowerCase().indexOf(kw) > -1;
            });
        }
        _selected = list.map(function (item) { return item.id || item; });
        render();
    }

    function toggleSelect(id) {
        var i = _selected.indexOf(id);
        if (i > -1) _selected.splice(i, 1);
        else _selected.push(id);
        render();
    }

    /**
     * 删除选中
     */
    function deleteSelected() {
        if (_selected.length === 0) {
            if (ENV.tip) ENV.tip('没有选中');
            return;
        }
        _confirmDialog('确定删除选中的 ' + _selected.length + ' 项吗？', function () {
            _selected.forEach(function (id) {
                DATA.Wordcard.remove(_type, id);
            });
            _selected = [];
            render();
            if (ENV.tip) ENV.tip('已删除');
        });
    }

    /* ============================================================
     * 6. 新增
     * ============================================================ */
    function openAdd() {
        var fieldLabel = _getFieldLabel();
        _openForm({
            title: '新增' + TYPE_LABELS[_type],
            label: fieldLabel,
            value: '',
            placeholder: _getPlaceholder(),
            isEmoji: _type === 'emoji',
            onSave: function (text) {
                if (!text) {
                    if (ENV.tip) ENV.tip('内容不能为空');
                    return false;
                }
                var item = { text: text };
                DATA.Wordcard.add(_type, item);
                render();
                if (ENV.tip) ENV.tip('已添加');
            }
        });
    }

    /* ============================================================
     * 7. 编辑
     * ============================================================ */
    function _openEdit(id) {
        var list = DATA.Wordcard.getByType(_type);
        var item = null;
        for (var i = 0; i < list.length; i++) {
            if ((list[i].id || list[i]) === id) {
                item = list[i];
                break;
            }
        }
        if (!item) return;

        var text = typeof item === 'string' ? item : (item.text || '');

        _openForm({
            title: '编辑' + TYPE_LABELS[_type],
            label: _getFieldLabel(),
            value: text,
            placeholder: _getPlaceholder(),
            isEmoji: _type === 'emoji',
            onSave: function (newText) {
                if (!newText) {
                    if (ENV.tip) ENV.tip('内容不能为空');
                    return false;
                }
                if (typeof item === 'string') {
                    // 字符串类型：先删再加
                    DATA.Wordcard.remove(_type, id);
                    DATA.Wordcard.add(_type, { text: newText });
                } else {
                    DATA.Wordcard.update(_type, id, { text: newText });
                }
                render();
                if (ENV.tip) ENV.tip('已保存');
            }
        });
    }

    /* ============================================================
     * 8. 删除
     * ============================================================ */
    function _confirmDelete(id) {
        _confirmDialog('确定删除这个字卡吗？', function () {
            DATA.Wordcard.remove(_type, id);
            render();
            if (ENV.tip) ENV.tip('已删除');
        });
    }

    /* ============================================================
     * 9. 导出
     * ============================================================ */
    function exportAll() {
        try {
            var all = DATA.Wordcard.getAll();
            // 只导出当前 Tab 或多类型
            var exportData = {
                version: (CONFIG.APP_INFO && CONFIG.APP_INFO.version) || '0.1.0',
                exportType: 'wordcards',
                exportedAt: Date.now(),
                data: _selected.length > 0
                    ? { [_type]: all[_type].filter(function (item) {
                        return _selected.indexOf(item.id || item) > -1;
                    }) }
                    : all
            };

            var json = JSON.stringify(exportData, null, 2);
            var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '梦角字卡_' + _dateStr() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

            if (ENV.tip) ENV.tip('已导出');
        } catch (e) {
            Log.error('[wordcard] 导出失败:', e);
            if (ENV.tip) ENV.tip('导出失败');
        }
    }

    function _dateStr() {
        var d = new Date();
        return d.getFullYear()
            + String(d.getMonth() + 1).padStart(2, '0')
            + String(d.getDate()).padStart(2, '0');
    }

    /* ============================================================
     * 10. 导入
     * ============================================================ */
    function importFromFile() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = function () {
            var file = input.files[0];
            if (!file) return;

            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var json = JSON.parse(e.target.result);
                    _doImport(json);
                } catch (err) {
                    if (ENV.tip) ENV.tip('文件格式错误');
                }
            };
            reader.readAsText(file, 'utf-8');
        };
        input.click();
    }

    function _doImport(json) {
        if (!json) {
            if (ENV.tip) ENV.tip('文件内容为空');
            return;
        }

        var imported = json.data || json;
        if (typeof imported !== 'object') {
            if (ENV.tip) ENV.tip('格式不正确');
            return;
        }

        var total = 0;
        var all = DATA.Wordcard.getAll();

        // 支持全量导入
        if (imported.main || imported.kaomoji || imported.emoji || imported.sticker || imported.voice) {
            Object.keys(imported).forEach(function (type) {
                if (!all[type]) all[type] = [];
                (imported[type] || []).forEach(function (item) {
                    var text = typeof item === 'string' ? item : (item.text || '');
                    if (!text) return;
                    // 去重
                    var exist = all[type].some(function (x) {
                        var t = typeof x === 'string' ? x : x.text;
                        return t === text;
                    });
                    if (exist) return;
                    all[type].push({
                        id: (item && item.id) || ('wc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
                        text: text,
                        createdAt: Date.now()
                    });
                    total++;
                });
            });
            DATA.Wordcard.saveAll(all);
        }

        render();
        if (ENV.tip) ENV.tip('导入 ' + total + ' 项');
    }

    /* ============================================================
     * 11. 表单弹窗（新增/编辑）
     * ============================================================ */
    function _openForm(options) {
        var mask = document.createElement('div');
        mask.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:rgba(0,0,0,0.45)', 'z-index:99999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:20px', 'opacity:0', 'transition:opacity 0.2s'
        ].join(';');

        var box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:18px', 'padding:20px',
            'width:100%', 'max-width:360px'
        ].join(';');

        var h = document.createElement('h3');
        h.textContent = options.title;
        h.style.cssText = 'font-size:16px;font-weight:600;margin:0 0 14px;text-align:center';

        var label = document.createElement('label');
        label.textContent = options.label;
        label.style.cssText = 'display:block;font-size:13px;color:#777;margin-bottom:6px';

        var input;
        if (options.isEmoji) {
            input = document.createElement('input');
            input.type = 'text';
            input.value = options.value || '';
            input.placeholder = options.placeholder || '';
            input.style.cssText = 'width:100%;border:1px solid #e5e5e5;border-radius:12px;padding:12px;font-size:24px;text-align:center;outline:none;box-sizing:border-box';
        } else {
            input = document.createElement('textarea');
            input.value = options.value || '';
            input.placeholder = options.placeholder || '';
            input.style.cssText = 'width:100%;min-height:80px;border:1px solid #e5e5e5;border-radius:12px;padding:12px;font-size:14px;outline:none;resize:none;box-sizing:border-box';
        }

        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px';

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:12px;border:none;border-radius:12px;background:#f4f4f4;font-size:15px;cursor:pointer';
        cancelBtn.onclick = function () { _closeMask(mask); };

        var saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.style.cssText = 'padding:12px;border:none;border-radius:12px;background:#000;color:#fff;font-size:15px;cursor:pointer';
        saveBtn.onclick = function () {
            var text = input.value.trim();
            if (options.onSave) {
                var r = options.onSave(text);
                if (r === false) return;
            }
            _closeMask(mask);
        };

        row.appendChild(cancelBtn);
        row.appendChild(saveBtn);

              box.appendChild(h);
        box.appendChild(label);
        box.appendChild(input);

        // 【新增】表情库 / 语音 显示上传按钮
        if (_type === 'sticker' || _type === 'voice') {
            var uploadRow = document.createElement('div');
            uploadRow.style.cssText = 'margin-top:10px;display:flex;gap:8px';

            var uploadBtn = document.createElement('button');
            uploadBtn.textContent = _type === 'sticker' ? '📷 上传图片' : '🎤 上传音频';
            uploadBtn.style.cssText = 'flex:1;padding:10px;border:1px dashed #ccc;border-radius:12px;background:#f8f8f8;font-size:13px;cursor:pointer';
            uploadBtn.onclick = function () {
                _closeMask(mask);
                var STICKER = global.APP_STICKER;
                if (!STICKER) return;
                if (_type === 'sticker') {
                    STICKER.uploadSticker && STICKER.uploadSticker();
                } else {
                    STICKER.uploadVoice && STICKER.uploadVoice();
                }
            };

            uploadRow.appendChild(uploadBtn);
            box.appendChild(uploadRow);
        }

        box.appendChild(row);
        mask.appendChild(box);
        document.body.appendChild(mask);

        requestAnimationFrame(function () { mask.style.opacity = '1'; });
        setTimeout(function () { input.focus(); }, 100);

        mask.addEventListener('click', function (e) {
            if (e.target === mask) _closeMask(mask);
        });
    }

    function _closeMask(mask) {
        if (!mask || !mask.parentNode) return;
        mask.style.opacity = '0';
        setTimeout(function () {
            if (mask.parentNode) mask.parentNode.removeChild(mask);
        }, 200);
    }

    function _confirmDialog(text, onOk) {
        var mask = document.createElement('div');
        mask.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:rgba(0,0,0,0.45)', 'z-index:99999',
            'display:flex', 'align-items:center', 'justify-content:center',
            'padding:20px', 'opacity:0', 'transition:opacity 0.2s'
        ].join(';');

        var box = document.createElement('div');
        box.style.cssText = [
            'background:#fff', 'border-radius:18px', 'padding:20px',
            'width:100%', 'max-width:320px', 'text-align:center'
        ].join(';');

        box.innerHTML = '<p style="font-size:15px;margin:0 0 20px;line-height:1.5">' + esc(text) + '</p>';

        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';

        var cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:12px;border:none;border-radius:12px;background:#f4f4f4;font-size:15px;cursor:pointer';
        cancelBtn.onclick = function () { _closeMask(mask); };

        var okBtn = document.createElement('button');
        okBtn.textContent = '确定';
        okBtn.style.cssText = 'padding:12px;border:none;border-radius:12px;background:#000;color:#fff;font-size:15px;cursor:pointer';
        okBtn.onclick = function () {
            _closeMask(mask);
            if (onOk) onOk();
        };

        row.appendChild(cancelBtn);
        row.appendChild(okBtn);
        box.appendChild(row);
        mask.appendChild(box);
        document.body.appendChild(mask);

        requestAnimationFrame(function () { mask.style.opacity = '1'; });
    }

    /* ============================================================
     * 12. 工具：label 和 placeholder
     * ============================================================ */
    function _getFieldLabel() {
        var map = {
            main: '字卡内容',
            kaomoji: '颜文字',
            emoji: 'Emoji',
            sticker: '表情图片地址',
            voice: '语音文字'
        };
        return map[_type] || '内容';
    }

    function _getPlaceholder() {
        var map = {
            main: '如：嗯嗯',
            kaomoji: '如：(＾▽＾)',
            emoji: '如：😊',
            sticker: '粘贴图片链接或上传',
            voice: '如：晚安'
        };
        return map[_type] || '';
    }

    /* ============================================================
     * 13. 初始化
     * ============================================================ */
    function init() {
        // 保证有默认数据
        var all = DATA.Wordcard.getAll();
        if (!all.main || all.main.length === 0) {
            // 首次进入可以给几个示例
            var defaultMain = ['嗯嗯', '好呀', '我懂', '抱抱', '在的'];
            defaultMain.forEach(function (t) {
                DATA.Wordcard.add('main', { text: t });
            });
        }

        Log.log('[wordcard-lib] 初始化完成');
    }

    /**
     * 打开字卡库（在 listeners 里调用）
     */
    function open() {
        // 先切到默认 tab
        _type = 'main';
        _keyword = '';
        _selected = [];
        _multi = false;

        // 打开弹窗
        if (CORE.openPopup) CORE.openPopup('wordcardLib');

        // 渲染
        setTimeout(render, 100);
    }

    /* ============================================================
     * 14. 对外导出
     * ============================================================ */
    var APP_WORDCARD_LIB = {
        init: init,
        open: open,
        render: render,
        switchType: switchType,
        search: search,
        toggleMulti: toggleMulti,
        selectAll: selectAll,
        toggleSelect: toggleSelect,
        deleteSelected: deleteSelected,
        openAdd: openAdd,
        exportAll: exportAll,
        importFromFile: importFromFile
    };

    global.APP_WORDCARD_LIB = APP_WORDCARD_LIB;

})(typeof window !== 'undefined' ? window : this);