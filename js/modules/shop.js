/* ==========================================================================
   梦角 · Dream Corner
   商城模块  js/modules/shop.js
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    formatDate,
    uid, randomInt,
    escapeHtml,
    mjConfirm, mjPrompt, mjAlert
} from '../utils/dom.js';

import { KEYS, get, set } from '../utils/storage.js';

import { bus } from '../utils/event.js';


let _initialized = false;
let _unsubs = [];
let _currentView = 'shop';       // shop / cart / orders
let _currentCategory = 'recommend';
let _currentOrderTab = 'all';
let _searchKeyword = '';
const _cartSelected = new Set();  // 购物车里选中的商品 id


/* ==========================================================================
   入口
   ========================================================================== */

export function initShop() {
    if (_initialized) return;
    _initialized = true;

    ensureShopData();
    bindNav();
    bindTabs();
    bindSearch();
    bindCartBar();
    bindOrderTabs();

    renderAll();

    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-shop') {
                renderAll();
            }
        })
    );
}

export function destroyShop() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    _initialized = false;
}


/* ==========================================================================
   数据
   ========================================================================== */

function ensureShopData() {
    const data = get(KEYS.SHOP);
    if (typeof data.balance !== 'number') data.balance = 520;
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.cart)) data.cart = [];
    if (!Array.isArray(data.orders)) data.orders = [];
    if (!Array.isArray(data.wishlist)) data.wishlist = [];
    set(KEYS.SHOP, data);
    return data;
}

function saveShopData(data) {
    set(KEYS.SHOP, data || ensureShopData());
}


/* ==========================================================================
   渲染：全部
   ========================================================================== */

function renderAll() {
    renderBalance();
    renderProducts();
    renderCart();
    renderOrders();
}


/* ==========================================================================
   余额
   ========================================================================== */

function renderBalance() {
    const data = ensureShopData();
    const el = byId('shop-balance');
    if (el) el.textContent = `¥${data.balance.toFixed(2)}`;
}


/* ==========================================================================
   商品列表
   ========================================================================== */

function renderProducts() {
    const wrap = byId('shop-products');
    if (!wrap) return;

    const data = ensureShopData();
    let list = data.products.filter((p) => p.category === _currentCategory);

    if (_searchKeyword) {
        list = list.filter((p) => (p.name || '').includes(_searchKeyword));
    }

    wrap.innerHTML = '';

    if (!list.length) {
        wrap.innerHTML = '<div class="shop-empty">暂无商品</div>';
        return;
    }

    list.forEach((p) => {
        wrap.appendChild(createProductEl(p));
    });
}

/* ==========================================================================
   商品详情弹窗
   ========================================================================== */

function openProductDialog(productId) {
    const data = ensureShopData();
    const p = data.products.find((x) => x.id === productId);
    if (!p) return;

    const gradient = getProductGradient(p);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal product-dialog">
            <button class="product-dialog-close" data-role="close" aria-label="关闭">✕</button>

            <div class="product-dialog-hero" style="background: ${gradient};">
                <div class="product-dialog-emoji">${escapeHtml(p.emoji || '📦')}</div>
            </div>

            <div class="product-dialog-name">${escapeHtml(p.name)}</div>
            <div class="product-dialog-price">¥${p.price}</div>

            <div class="product-dialog-label">写给 默认 的话</div>
            <textarea class="product-dialog-input" id="product-dialog-msg" rows="3" placeholder="这里是一句话"></textarea>

            <div class="product-dialog-actions">
                <button class="product-dialog-btn secondary" data-role="close">取消</button>
                <button class="product-dialog-btn ghost" data-role="wish">♡ 加入心愿单</button>
                <button class="product-dialog-btn primary" data-role="gift">送给梦角</button>
            </div>

            <div class="product-dialog-note">加入心愿单只是许愿不花钱——默认可能会买下它送你</div>
        </div>
    `;

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-role="close"]')) close();
    });

    // 加入心愿单
    overlay.querySelector('[data-role="wish"]').addEventListener('click', () => {
        const d = ensureShopData();
        if (!Array.isArray(d.wishlist)) d.wishlist = [];
        d.wishlist.push({
            id: uid('wish'),
            productId: p.id,
            name: p.name,
            emoji: p.emoji,
            price: p.price,
            message: overlay.querySelector('#product-dialog-msg').value.trim(),
            ts: Date.now()
        });
        saveShopData(d);
        close();
        toast('已加入心愿单 ♡');
    });

    // 送给梦角
    // 送给梦角
overlay.querySelector('[data-role="gift"]').addEventListener('click', () => {
    const msg = overlay.querySelector('#product-dialog-msg').value.trim();
    close();
    openCharacterPicker(p, msg);
});

    document.body.appendChild(overlay);
}

/**
 * 根据商品名/价格生成一个渐变色
 */
function getProductGradient(p) {
    const colors = [
        ['#ffd3dc', '#ffb3c4'],
        ['#dbe4ff', '#b9c7ff'],
        ['#d3f9d8', '#a9e6b3'],
        ['#ffe3d3', '#ffc4a8'],
        ['#f3e8ff', '#d8c2ff'],
        ['#d0ebff', '#a5d8ff'],
        ['#ffec99', '#ffe066'],
        ['#c5f6ee', '#99e9d6'],
        ['#ffc9c9', '#ffa8a8'],
        ['#eebefa', '#da77f2']
    ];
    // 用商品 id 做一个稳定的 hash
    let hash = 0;
    const s = String(p.id || p.name || '');
    for (let i = 0; i < s.length; i++) {
        hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    }
    const pair = colors[hash % colors.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function createProductEl(p) {
    const card = document.createElement('div');
    card.className = 'shop-product';

    // 图片区
    const img = document.createElement('div');
    img.className = 'shop-product-img';
    img.textContent = p.emoji || '📦';
    card.appendChild(img);

    // 名字
    const name = document.createElement('div');
    name.className = 'shop-product-name';
    name.textContent = p.name || '未命名';
    card.appendChild(name);

    // 描述
    const desc = document.createElement('div');
    desc.className = 'shop-product-desc';
    desc.textContent = p.desc || '';
    card.appendChild(desc);

    // 标签
    if (Array.isArray(p.tags) && p.tags.length) {
        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'shop-product-tags';
        p.tags.forEach((t) => {
            const tag = document.createElement('span');
            tag.className = 'shop-tag';
            tag.textContent = t;
            tagsWrap.appendChild(tag);
        });
        card.appendChild(tagsWrap);
    }

    // 底部：价格 + 加号
    const footer = document.createElement('div');
    footer.className = 'shop-product-footer';

    const price = document.createElement('div');
    price.className = 'shop-product-price';
    price.textContent = `¥${p.price}`;
    footer.appendChild(price);

    const addBtn = document.createElement('button');
    addBtn.className = 'shop-product-add';
    addBtn.textContent = '+';
    addBtn.setAttribute('aria-label', `添加 ${p.name} 到购物车`);
    addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openProductDialog(p.id);
    });
    footer.appendChild(addBtn);

    card.appendChild(footer);

    // 长按删除商品
    let pressTimer = null;
    const start = () => {
        pressTimer = setTimeout(() => {
            mjConfirm(`删除商品「${p.name}」？`, { title: '删除商品' }).then((ok) => {
                if (!ok) return;
                const data = ensureShopData();
                data.products = data.products.filter((x) => x.id !== p.id);
                saveShopData(data);
                renderProducts();
                toast('已删除');
            });
        }, 700);
    };
    const cancel = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
    };
    card.addEventListener('touchstart', start, { passive: true });
    card.addEventListener('touchend', cancel);
    card.addEventListener('touchmove', cancel);
    card.addEventListener('touchcancel', cancel);

    return card;
}


/* ==========================================================================
   购物车
   ========================================================================== */

function addToCart(productId) {
    const data = ensureShopData();
    const existing = data.cart.find((c) => c.productId === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        data.cart.push({ productId, qty: 1 });
    }
    saveShopData(data);
    toast('已加入购物车');
}

function renderCart() {
    const wrap = byId('shop-cart-list');
    if (!wrap) return;

    const data = ensureShopData();
    wrap.innerHTML = '';

    if (!data.cart.length) {
        wrap.innerHTML = '<div class="shop-empty">购物车是空的</div>';
        updateCartTotal();
        return;
    }

    data.cart.forEach((item) => {
        const p = data.products.find((x) => x.id === item.productId);
        if (!p) return;

        const row = document.createElement('div');
        row.className = 'shop-cart-item';

        // 勾选框
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'shop-cart-check';
        check.checked = _cartSelected.has(item.productId);
        check.addEventListener('change', () => {
            if (check.checked) _cartSelected.add(item.productId);
            else _cartSelected.delete(item.productId);
            updateCartTotal();
        });
        row.appendChild(check);

        // 图标
        const icon = document.createElement('div');
        icon.className = 'shop-cart-icon';
        icon.textContent = p.emoji || '📦';
        row.appendChild(icon);

        // 信息
        const info = document.createElement('div');
        info.className = 'shop-cart-info';
        const name = document.createElement('div');
        name.className = 'shop-cart-name';
        name.textContent = p.name;
        info.appendChild(name);
        const price = document.createElement('div');
        price.className = 'shop-cart-price';
        price.textContent = `¥${p.price}`;
        info.appendChild(price);
        row.appendChild(info);

        // 数量控制
        const qtyWrap = document.createElement('div');
        qtyWrap.className = 'shop-cart-qty';

        const minus = document.createElement('button');
        minus.textContent = '−';
        minus.addEventListener('click', () => changeQty(item.productId, -1));
        qtyWrap.appendChild(minus);

        const num = document.createElement('span');
        num.textContent = item.qty;
        qtyWrap.appendChild(num);

        const plus = document.createElement('button');
        plus.textContent = '+';
        plus.addEventListener('click', () => changeQty(item.productId, 1));
        qtyWrap.appendChild(plus);

        row.appendChild(qtyWrap);

        wrap.appendChild(row);
    });

    updateCartTotal();
}

function changeQty(productId, delta) {
    const data = ensureShopData();
    const item = data.cart.find((c) => c.productId === productId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        data.cart = data.cart.filter((c) => c.productId !== productId);
        _cartSelected.delete(productId);
    }
    saveShopData(data);
    renderCart();
}

function updateCartTotal() {
    const data = ensureShopData();
    let total = 0;

    data.cart.forEach((item) => {
        if (!_cartSelected.has(item.productId)) return;
        const p = data.products.find((x) => x.id === item.productId);
        if (p) total += p.price * item.qty;
    });

    const el = byId('cart-total');
    if (el) el.textContent = `¥${total}`;
}


/* ==========================================================================
   购物车操作
   ========================================================================== */

function bindCartBar() {
    const selAll = byId('cart-select-all');
    if (selAll) {
        selAll.addEventListener('change', () => {
            const data = ensureShopData();
            if (selAll.checked) {
                data.cart.forEach((c) => _cartSelected.add(c.productId));
            } else {
                _cartSelected.clear();
            }
            renderCart();
        });
    }
}

function cartDelete() {
    const data = ensureShopData();
    if (_cartSelected.size === 0) {
        toast('请先勾选要删除的商品');
        return;
    }
    data.cart = data.cart.filter((c) => !_cartSelected.has(c.productId));
    _cartSelected.clear();
    saveShopData(data);
    renderCart();
    toast('已删除');
}

async function cartCheckout() {
    const data = ensureShopData();
    const selected = data.cart.filter((c) => _cartSelected.has(c.productId));
    if (!selected.length) {
        toast('请先勾选要结算的商品');
        return;
    }

    let total = 0;
    selected.forEach((item) => {
        const p = data.products.find((x) => x.id === item.productId);
        if (p) total += p.price * item.qty;
    });

    if (total > data.balance) {
        toast(`余额不足，还差 ¥${(total - data.balance).toFixed(2)}`);
        return;
    }

    const ok = await mjConfirm(`共 ${selected.length} 件，合计 ¥${total}，确定下单？`, {
        title: '确认下单'
    });
    if (!ok) return;

    // 扣款
    data.balance -= total;

    // 生成订单
    const order = {
        id: uid('order'),
        items: selected.map((item) => {
            const p = data.products.find((x) => x.id === item.productId);
            return {
                productId: item.productId,
                name: p ? p.name : '未知',
                emoji: p ? p.emoji : '📦',
                price: p ? p.price : 0,
                qty: item.qty
            };
        }),
        total,
        status: 'pending',
        ts: Date.now()
    };
    data.orders.push(order);

    // 从购物车移除
    data.cart = data.cart.filter((c) => !_cartSelected.has(c.productId));
    _cartSelected.clear();

    saveShopData(data);
    renderAll();
    toast('下单成功 🎉');
    switchView('orders');
}


/* ==========================================================================
   订单
   ========================================================================== */

function renderOrders() {
    const wrap = byId('shop-orders');
    if (!wrap) return;

    const data = ensureShopData();
    let list = data.orders.slice().sort((a, b) => b.ts - a.ts);

    if (_currentOrderTab !== 'all') {
        list = list.filter((o) => o.status === _currentOrderTab);
    }

    wrap.innerHTML = '';

    if (!list.length) {
        wrap.innerHTML = '<div class="shop-empty">暂无订单</div>';
        return;
    }

    list.forEach((o) => wrap.appendChild(createOrderEl(o)));
}

function createOrderEl(order) {
    const card = document.createElement('div');
    card.className = 'shop-order';

    // 头部
    const header = document.createElement('div');
    header.className = 'shop-order-header';

    const orderId = document.createElement('span');
    orderId.className = 'shop-order-id';
    orderId.textContent = `订单号：${order.id.slice(-8)}`;
    header.appendChild(orderId);

    const statusText = {
        pending: '待送达',
        done: '已完成',
        cancelled: '已取消'
    }[order.status] || order.status;
    const status = document.createElement('span');
    status.className = `shop-order-status status-${order.status}`;
    status.textContent = statusText;
    header.appendChild(status);

    card.appendChild(header);

    // 商品列表
    order.items.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'shop-order-item';

        const emoji = document.createElement('span');
        emoji.className = 'shop-order-emoji';
        emoji.textContent = it.emoji || '📦';

        const name = document.createElement('span');
        name.className = 'shop-order-name';
        name.textContent = it.name;

        const qty = document.createElement('span');
        qty.className = 'shop-order-qty';
        qty.textContent = `× ${it.qty}`;

        const price = document.createElement('span');
        price.className = 'shop-order-price';
        price.textContent = `¥${it.price * it.qty}`;

        row.appendChild(emoji);
        row.appendChild(name);
        row.appendChild(qty);
        row.appendChild(price);
        card.appendChild(row);
    });

    // 底部
    const footer = document.createElement('div');
    footer.className = 'shop-order-footer';

    const time = document.createElement('span');
    time.className = 'shop-order-time';
    time.textContent = formatDate(order.ts);
    footer.appendChild(time);

    const total = document.createElement('span');
    total.className = 'shop-order-total';
    total.textContent = `合计 ¥${order.total}`;
    footer.appendChild(total);

    card.appendChild(footer);

    // 操作按钮
    if (order.status === 'pending') {
        const actions = document.createElement('div');
        actions.className = 'shop-order-actions';

        const doneBtn = document.createElement('button');
        doneBtn.className = 'shop-order-btn';
        doneBtn.textContent = '确认收货';
        doneBtn.addEventListener('click', () => {
            const data = ensureShopData();
            const o = data.orders.find((x) => x.id === order.id);
            if (o) o.status = 'done';
            saveShopData(data);
            renderOrders();
            toast('已确认收货');
        });
        actions.appendChild(doneBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'shop-order-btn danger';
        cancelBtn.textContent = '取消订单';
        cancelBtn.addEventListener('click', async () => {
            const ok = await mjConfirm('取消后会退还金额，确定吗？', { title: '取消订单' });
            if (!ok) return;
            const data = ensureShopData();
            const o = data.orders.find((x) => x.id === order.id);
            if (!o) return;
            o.status = 'cancelled';
            data.balance += o.total;
            saveShopData(data);
            renderAll();
            toast('已取消并退款');
        });
        actions.appendChild(cancelBtn);

        card.appendChild(actions);
    }

    return card;
}


/* ==========================================================================
   视图切换
   ========================================================================== */

function switchView(view) {
    _currentView = view;

    // 更新面板
    document.querySelectorAll('[data-shop-panel]').forEach((p) => {
        p.classList.toggle('active', p.dataset.shopPanel === view);
    });

    // 更新底部导航
    document.querySelectorAll('.shop-nav-item').forEach((b) => {
        b.classList.toggle('active', b.dataset.shopView === view);
    });

    // 头部标题
    const titleEl = byId('shop-title');
    const titles = { shop: '商城', cart: '购物车', orders: '我的订单' };
    if (titleEl) titleEl.textContent = titles[view] || '商城';

    renderAll();
}


/* ==========================================================================
   绑定
   ========================================================================== */

function bindNav() {
    const nav = byId('shop-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-shop-view]');
        if (!btn) return;
        switchView(btn.dataset.shopView);
    });
}

function bindTabs() {
    const wrap = byId('shop-tabs');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-shop-tab]');
        if (!btn) return;
        _currentCategory = btn.dataset.shopTab;
        wrap.querySelectorAll('.shop-tab').forEach((b) => {
            b.classList.toggle('active', b === btn);
        });
        renderProducts();
    });
}

function bindSearch() {
    const input = byId('shop-search');
    if (!input) return;
    input.addEventListener('input', () => {
        _searchKeyword = input.value.trim();
        renderProducts();
    });
}

function bindOrderTabs() {
    const wrap = byId('shop-order-tabs');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-order-tab]');
        if (!btn) return;
        _currentOrderTab = btn.dataset.orderTab;
        wrap.querySelectorAll('.shop-order-tab').forEach((b) => {
            b.classList.toggle('active', b === btn);
        });
        renderOrders();
    });
}


/* ==========================================================================
   许愿（添加自定义商品）
   ========================================================================== */

function openWishDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal" style="max-width: 380px;">
            <div class="modal-header">
                <h2 class="modal-title">✨ 许愿商品</h2>
                <button class="modal-close" data-role="close" aria-label="关闭">✕</button>
            </div>

            <div class="wish-form">
                <label class="wish-label">商品名称</label>
                <input type="text" class="form-input" id="wish-name" placeholder="输入商品名称..." maxlength="30">

                <label class="wish-label">价格（¥）</label>
                <input type="number" class="form-input" id="wish-price" placeholder="0.00" min="0" step="0.01">

                <label class="wish-label">分类</label>
                <select class="form-input" id="wish-category">
                    <option value="recommend">推荐</option>
                    <option value="takeout">外卖</option>
                </select>

                <label class="wish-label">小标签（用逗号分隔）</label>
                <input type="text" class="form-input" id="wish-tags" placeholder="如：衣物, 新品, 限量">

                <label class="wish-label">商品图标</label>
                <div class="wish-icon-row">
                    <input type="text" class="form-input" id="wish-emoji" placeholder="输入 emoji 如：👔 🧋 🎁" maxlength="4">
                    <span class="wish-or">或</span>
                    <button type="button" class="wish-upload" id="wish-upload">📷 上传图片</button>
                </div>

                <label class="wish-label">商品描述</label>
                <textarea class="form-textarea" id="wish-desc" rows="3" placeholder="输入商品详细描述..."></textarea>
            </div>

            <div class="modal-actions">
                <button class="modal-btn secondary" data-role="close">取消</button>
                <button class="modal-btn primary" data-role="save">许愿</button>
            </div>
        </div>
    `;

    let uploadedImage = '';

    overlay.querySelector('#wish-upload').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                uploadedImage = reader.result;
                const emojiInput = overlay.querySelector('#wish-emoji');
                emojiInput.value = '📷';
                emojiInput.disabled = true;
                toast('图片已上传');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    const close = () => overlay.remove();
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.closest('[data-role="close"]')) close();
    });

    overlay.querySelector('[data-role="save"]').addEventListener('click', () => {
        const name = overlay.querySelector('#wish-name').value.trim();
        const price = parseFloat(overlay.querySelector('#wish-price').value) || 0;
        const category = overlay.querySelector('#wish-category').value;
        const tagsRaw = overlay.querySelector('#wish-tags').value.trim();
        const emoji = overlay.querySelector('#wish-emoji').value.trim() || '📦';
        const desc = overlay.querySelector('#wish-desc').value.trim();

        if (!name) {
            toast('请输入商品名称');
            return;
        }

        const tags = tagsRaw
            ? tagsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
            : [];

        const data = ensureShopData();
        data.products.push({
            id: uid('p'),
            name,
            price,
            category,
            tags,
            emoji: uploadedImage || emoji,
            desc
        });
        saveShopData(data);

        close();
        renderAll();
        toast('许愿成功 ✨');
    });

    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.querySelector('#wish-name')?.focus();
    }, 120);
}


/* ==========================================================================
   修改余额
   ========================================================================== */

async function editBalance() {
    const data = ensureShopData();
    const input = await mjPrompt('输入新的余额：', {
        title: '修改余额',
        defaultValue: String(data.balance),
        confirmText: '保存'
    });
    if (input === null) return;

    const n = parseFloat(input);
    if (isNaN(n) || n < 0) {
        toast('请输入有效数字');
        return;
    }

    data.balance = n;
    saveShopData(data);
    renderBalance();
    toast(`余额已更新为 ¥${n.toFixed(2)}`);
}


/* ==========================================================================
   actions / navs
   ========================================================================== */

export const shopActions = {
    'wish-product':   () => openWishDialog(),
    'edit-balance':   () => editBalance(),
    'cart-delete':    () => cartDelete(),
    'cart-checkout':  () => cartCheckout()
};

export const shopNavs = {
    'shop': () => {
        ensureShopData();
        switchView('shop');
        showScreen('screen-shop');
    }
};


/* ==========================================================================
   对外导出
   ========================================================================== */

export default {
    initShop,
    destroyShop,
    shopActions,
    shopNavs
};
