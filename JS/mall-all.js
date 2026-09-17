/**
 * mall-all.js
 * 商城增强：全部商品 / 分类 / 搜索 / 排序
 * 依赖：config / utils / data / core / envelope
 * 被依赖：listeners.js / features.js
 *
 * 挂到 window.APP_MALL_ALL 上
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
    var _modalEl = null;
    var _keyword = '';
    var _sort = 'default';        // 'default' | 'price-asc' | 'price-desc' | 'new'
    var _category = 'all';         // 'all' | 'recommend' | 'takeaway'

    /* ============================================================
     * 1. 打开"全部商品"弹窗
     * ============================================================ */
    function open() {
        close();

        var mask = document.createElement('div');
        mask.className = 'app-mall-all';
        mask.style.cssText = [
            'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
            'background:#fff', 'z-index:99995',
            'display:flex', 'flex-direction:column',
            'opacity:0', 'transition:opacity 0.2s'
        ].join(';');

        // 顶部栏
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #f2f2f2;flex-shrink:0';
        header.innerHTML =
            '<span class="mall-close" style="font-size:22px;cursor:pointer;width:36px">←</span>' +
            '<span style="font-size:17px;font-weight:600">全部商品</span>' +
            '<span style="width:36px"></span>';

        // 搜索行
        var searchRow = document.createElement('div');
        searchRow.style.cssText = 'padding:12px 16px;flex-shrink:0';
        searchRow.innerHTML =
            '<input type="text" class="mall-search" placeholder="搜索商品..." ' +
            'style="width:100%;border:1px solid #eee;border-radius:20px;padding:10px 16px;font-size:14px;outline:none;box-sizing:border-box;background:#f8f8f8">';

        // 分类 Tab
        var catRow = document.createElement('div');
        catRow.style.cssText = 'padding:0 16px 10px;display:flex;gap:8px;flex-shrink:0';
        catRow.innerHTML =
            '<button class="mall-cat active" data-cat="all" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#000;color:#fff;font-size:13px;cursor:pointer">全部</button>' +
            '<button class="mall-cat" data-cat="recommend" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#fff;color:#333;font-size:13px;cursor:pointer">推荐</button>' +
            '<button class="mall-cat" data-cat="takeaway" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#fff;color:#333;font-size:13px;cursor:pointer">外卖</button>';

        // 排序行
        var sortRow = document.createElement('div');
        sortRow.style.cssText = 'padding:0 16px 10px;display:flex;gap:8px;flex-shrink:0;overflow-x:auto';
        sortRow.innerHTML =
            '<button class="mall-sort active" data-sort="default" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#000;color:#fff;font-size:12px;cursor:pointer;white-space:nowrap">默认</button>' +
            '<button class="mall-sort" data-sort="price-asc" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#fff;color:#333;font-size:12px;cursor:pointer;white-space:nowrap">价格 ↑</button>' +
            '<button class="mall-sort" data-sort="price-desc" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#fff;color:#333;font-size:12px;cursor:pointer;white-space:nowrap">价格 ↓</button>' +
            '<button class="mall-sort" data-sort="new" style="padding:6px 14px;border-radius:16px;border:1px solid #eee;background:#fff;color:#333;font-size:12px;cursor:pointer;white-space:nowrap">最新</button>';

        // 商品网格容器
        var grid = document.createElement('div');
        grid.className = 'mall-grid';
        grid.style.cssText = 'flex:1;overflow-y:auto;padding:0 16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-content:start';

        mask.appendChild(header);
        mask.appendChild(searchRow);
        mask.appendChild(catRow);
        mask.appendChild(sortRow);
        mask.appendChild(grid);
        document.body.appendChild(mask);
        _modalEl = mask;

        requestAnimationFrame(function () { mask.style.opacity = '1'; });

        // 渲染
        render();

        // 关闭
        header.querySelector('.mall-close').addEventListener('click', close);

        // 搜索
        var search = searchRow.querySelector('.mall-search');
        search.addEventListener('input', function () {
            _keyword = search.value.trim();
            render();
        });

        // 分类
        catRow.addEventListener('click', function (e) {
            var btn = e.target.closest('.mall-cat');
            if (!btn) return;
            _category = btn.dataset.cat;
            catRow.querySelectorAll('.mall-cat').forEach(function (b) {
                b.classList.remove('active');
                b.style.background = '#fff';
                b.style.color = '#333';
            });
            btn.classList.add('active');
            btn.style.background = '#000';
            btn.style.color = '#fff';
            render();
        });

        // 排序
        sortRow.addEventListener('click', function (e) {
            var btn = e.target.closest('.mall-sort');
            if (!btn) return;
            _sort = btn.dataset.sort;
            sortRow.querySelectorAll('.mall-sort').forEach(function (b) {
                b.classList.remove('active');
                b.style.background = '#fff';
                b.style.color = '#333';
            });
            btn.classList.add('active');
            btn.style.background = '#000';
            btn.style.color = '#fff';
            render();
        });

        Log.log('[mall-all] 打开全部商品');
    }

    function close() {
        if (!_modalEl) return;
        var m = _modalEl;
        m.style.opacity = '0';
        setTimeout(function () {
            if (m.parentNode) m.parentNode.removeChild(m);
            if (_modalEl === m) _modalEl = null;
        }, 200);
    }

    /* ============================================================
     * 2. 渲染商品
     * ============================================================ */
    function render() {
        var grid = _modalEl ? _modalEl.querySelector('.mall-grid') : null;
        if (!grid) return;

        var all = DATA.Shop.listGoods();
        var list = [];

        // 分类合并
        if (_category === 'all') {
            list = (all.recommend || []).concat(all.takeaway || []);
        } else {
            list = all[_category] || [];
        }

        // 搜索
        if (_keyword) {
            var kw = _keyword.toLowerCase();
            list = list.filter(function (g) {
                return (g.name || '').toLowerCase().indexOf(kw) > -1
                    || (g.desc || '').toLowerCase().indexOf(kw) > -1
                    || (g.tags || []).some(function (t) { return (t || '').toLowerCase().indexOf(kw) > -1; });
            });
        }

        // 排序
        if (_sort === 'price-asc') {
            list = list.slice().sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
        } else if (_sort === 'price-desc') {
            list = list.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
        } else if (_sort === 'new') {
            list = list.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        }

        if (list.length === 0) {
            grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#999;padding:60px 0">没有找到商品</p>';
            return;
        }

        grid.innerHTML = list.map(function (g) {
            var cat = _category === 'all'
                ? ((all.recommend || []).indexOf(g) > -1 ? 'recommend' : 'takeaway')
                : _category;

            return '<div class="mall-item" style="border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer">' +
                '<div style="height:100px;display:flex;align-items:center;justify-content:center;font-size:42px;background:#fafafa">' + (g.icon || '🎁') + '</div>' +
                '<div style="padding:8px 10px 10px">' +
                    '<h4 style="font-size:14px;font-weight:500;margin:0 0 4px;line-height:1.3">' + esc(g.name) + '</h4>' +
                    '<p style="font-size:11px;color:#888;margin:0 0 6px;line-height:1.4;height:30px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + esc(g.desc || '') + '</p>' +
                    '<div style="display:flex;justify-content:space-between;align-items:center">' +
                        '<span style="color:#ff4466;font-weight:600;font-size:14px">¥' + g.price + '</span>' +
                        '<button class="mall-add" data-id="' + g.id + '" data-cat="' + cat + '" style="width:26px;height:26px;border-radius:50%;border:none;background:#ff7b9c;color:#fff;font-size:16px;cursor:pointer">+</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        // 加购物车
        grid.querySelectorAll('.mall-add').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var id = btn.dataset.id;
                var cat = btn.dataset.cat;
                addToCart(id, cat);
            });
        });

        // 点卡片也加购物车
        grid.querySelectorAll('.mall-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var btn = item.querySelector('.mall-add');
                if (btn) {
                    addToCart(btn.dataset.id, btn.dataset.cat);
                }
            });
        });
    }

    /* ============================================================
     * 3. 加购物车
     * ============================================================ */
    function addToCart(goodsId, category) {
        var goods = null;
        var list = DATA.Shop.listGoods(category);
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === goodsId) { goods = list[i]; break; }
        }
        if (!goods) {
            // 兜底：从全部找
            var all = DATA.Shop.listGoods();
            ['recommend', 'takeaway'].forEach(function (c) {
                if (goods) return;
                var arr = all[c] || [];
                for (var j = 0; j < arr.length; j++) {
                    if (arr[j].id === goodsId) { goods = arr[j]; category = c; break; }
                }
            });
        }
        if (!goods) return;

        DATA.Shop.addToCart(goods, category);
        if (ENV.tip) ENV.tip('已加入购物车');

        // 购物车角标更新
        var badge = document.querySelector('.cart-badge');
        if (badge) {
            var count = DATA.Shop.countCart();
            badge.textContent = count;
            badge.style.display = count > 0 ? '' : 'none';
        }
    }

    /* ============================================================
     * 4. 初始化
     * ============================================================ */
    function init() {
        Log.log('[mall-all] 初始化完成');
    }

    /* ============================================================
     * 5. 对外导出
     * ============================================================ */
    var APP_MALL_ALL = {
        init: init,
        open: open,
        close: close,
        render: render,
        addToCart: addToCart
    };

    global.APP_MALL_ALL = APP_MALL_ALL;

})(typeof window !== 'undefined' ? window : this);