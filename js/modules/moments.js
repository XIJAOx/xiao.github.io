/* ==========================================================================
   梦角 · Dream Corner
   朋友圈模块  js/modules/moments.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     #screen-moments
       - #header-moments（返回 / 标题 / 访问记录 / 发动态）
       - #moments-bg（可点击换背景的封面区）
       - #moments-bg-avatar / #moments-bg-name（封面头像与名字）
       - #moments-feed（动态列表）
       - #moments-empty（空状态）

   数据结构（KEYS.MOMENTS）：
     {
       posts: [
         {
           id, authorId, authorName, authorAvatar,
           text, images: [], ts,
           likes: [{ id, name, ts }],
           comments: [{ id, name, text, ts }]
         }
       ],
       bg: '',          // 背景图 URL / dataURL（空则用默认渐变）
       visitors: [{ id, name, ts }]
     }
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setText, setVisible,
    formatChatTime,
    uid, randomInt, randomPick,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** TA 随机评论/点赞语料 */
const TA_COMMENTS = [
    '好可爱呀',
    '这张照片我好喜欢',
    '哈哈哈笑死',
    '嗯嗯，说得对',
    '想和你一起去',
    '看到这个就想到你',
    '今天的你也在发光',
    '抱抱',
    '记下来啦',
    '什么时候带我去'
];

/** TA 主动发动态的语料池 */
const TA_POSTS = [
    '今天的天空很蓝，分享给你。',
    '刚吃完一顿很满足的晚餐。',
    '路过花店，买了一束桔梗。',
    '下雨了，听着雨声发了一会儿呆。',
    '今天有点想你。',
    '新买的杯子，好看吗？',
    '最近在读一本书，读到一句话很喜欢。',
    '晚安，做个好梦。'
];

/** TA 主动发动态的冷却（毫秒） */
const TA_POST_COOLDOWN = 3 * 60 * 1000;


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];
let _lastTaPostAt = 0;
let _loopTimer = null;


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initMoments() {
    if (_initialized) return;
    _initialized = true;

    ensureMomentsData();
    bindBg();
    bindHeaderButtons();
    renderBg();
    renderFeed();
    bindFeedDelegate();

    // 打开朋友圈时记录一次访客
    _unsubs.push(
        bus.on('screen:change', ({ id }) => {
            if (id === 'screen-moments') {
                recordMyVisit();
                renderFeed();
            }
        }),
        bus.on('moments:new', renderFeed),
        bus.on('profile:update', () => {
            renderBg();
            renderFeed();
        })
    );

    startTaPostLoop();
}

export function destroyMoments() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    if (_loopTimer) clearInterval(_loopTimer);
    _loopTimer = null;
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensureMomentsData() {
    const data = get(KEYS.MOMENTS);
    if (!Array.isArray(data.posts))    data.posts = [];
    if (!Array.isArray(data.visitors)) data.visitors = [];
    if (typeof data.bg !== 'string')   data.bg = '';
    set(KEYS.MOMENTS, data);
    return data;
}


/* ==========================================================================
   05. 渲染：封面（背景 + 头像 + 名字）
   ========================================================================== */

function renderBg() {
    const bgEl = byId('moments-bg');
    const nameEl = byId('moments-bg-name');
    const avatarEl = byId('moments-bg-avatar');
    const data = get(KEYS.MOMENTS);
    const profile = get(KEYS.PROFILE);

    // 背景：有自定义就应用图片，否则用 CSS 默认渐变
    if (bgEl) {
        if (data.bg) {
            bgEl.style.backgroundImage = `url(${data.bg})`;
            bgEl.style.backgroundSize = 'cover';
            bgEl.style.backgroundPosition = 'center';
        } else {
            bgEl.style.backgroundImage = '';
            bgEl.style.backgroundSize = '';
            bgEl.style.backgroundPosition = '';
        }
    }

    // 名字
    if (nameEl) nameEl.textContent = profile.me.name || '我';

    // 头像
    if (avatarEl) {
        const src = profile.me.avatar;
        const oldImg = avatarEl.querySelector('img.mj-avatar-img');
        if (src) {
            let img = oldImg;
            if (!img) {
                img = document.createElement('img');
                img.className = 'mj-avatar-img';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                avatarEl.appendChild(img);
            }
            img.src = src;
            const svg = avatarEl.querySelector('svg');
            if (svg) svg.style.display = 'none';
        } else {
            if (oldImg) oldImg.remove();
            const svg = avatarEl.querySelector('svg');
            if (svg) svg.style.display = '';
        }
    }
}


/* ==========================================================================
   06. 渲染：动态列表
   --------------------------------------------------------------------------
   CSS 里的结构：
     .moment-item
       .moment-avatar
       .moment-main
         .moment-name
         .moment-text
         .moment-images > img
         .moment-meta
           .moment-actions > .moment-action
         .moment-comments
           .moment-comment
             .moment-comment-name
   ========================================================================== */

function renderFeed() {
    const feed = byId('moments-feed');
    const emptyEl = byId('moments-empty');
    if (!feed) return;

    const data = get(KEYS.MOMENTS);
    const posts = data.posts.slice().sort((a, b) => b.ts - a.ts);

    // 清空，但保留空状态节点
    Array.from(feed.children).forEach((child) => {
        if (child !== emptyEl) child.remove();
    });

    if (!posts.length) {
        if (emptyEl) emptyEl.hidden = false;
        return;
    }
    if (emptyEl) emptyEl.hidden = true;

    const fragment = document.createDocumentFragment();
    posts.forEach((post) => fragment.appendChild(createPostEl(post)));
    feed.appendChild(fragment);
}

/**
 * 创建单条动态 DOM
 * @param {Object} post
 * @returns {HTMLElement}
 */
function createPostEl(post) {
    const item = document.createElement('article');
    item.className = 'moment-item';
    item.dataset.postId = post.id;

    // 头像
    const avatar = document.createElement('div');
    avatar.className = 'moment-avatar';
    avatar.appendChild(createAvatarContent(post.authorAvatar));
    item.appendChild(avatar);

    // 主体
    const main = document.createElement('div');
    main.className = 'moment-main';

    // 名字
    const nameEl = document.createElement('div');
    nameEl.className = 'moment-name';
    nameEl.textContent = post.authorName || 'TA';
    main.appendChild(nameEl);

    // 正文
    if (post.text) {
        const textEl = document.createElement('p');
        textEl.className = 'moment-text';
        textEl.textContent = post.text;
        main.appendChild(textEl);
    }

    // 图片
    if (Array.isArray(post.images) && post.images.length) {
        const imagesEl = document.createElement('div');
        imagesEl.className = 'moment-images';
        post.images.forEach((src) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            img.loading = 'lazy';
            imagesEl.appendChild(img);
        });
        main.appendChild(imagesEl);
    }

    // 元信息 + 操作
    const meta = document.createElement('div');
    meta.className = 'moment-meta';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'mj-moment-time';
    timeSpan.textContent = formatChatTime(post.ts);
    meta.appendChild(timeSpan);

    const actions = document.createElement('div');
    actions.className = 'moment-actions';

    // 点赞
    const likeBtn = document.createElement('button');
    likeBtn.className = 'moment-action';
    likeBtn.dataset.momentAction = 'like';
    likeBtn.textContent = post.likes?.length
        ? `♥ ${post.likes.length}`
        : '♥ 赞';
    actions.appendChild(likeBtn);

    // 评论
    const commentBtn = document.createElement('button');
    commentBtn.className = 'moment-action';
    commentBtn.dataset.momentAction = 'comment';
    commentBtn.textContent = '💬 评论';
    actions.appendChild(commentBtn);

    // 删除（仅自己的动态）
    if (post.authorId === 'me') {
        const delBtn = document.createElement('button');
        delBtn.className = 'moment-action';
        delBtn.dataset.momentAction = 'delete';
        delBtn.textContent = '✕';
        actions.appendChild(delBtn);
    }

    meta.appendChild(actions);
    main.appendChild(meta);

    // 评论列表
    if (Array.isArray(post.comments) && post.comments.length) {
        const commentsEl = document.createElement('div');
        commentsEl.className = 'moment-comments';
        post.comments.forEach((c) => {
            const row = document.createElement('div');
            row.className = 'moment-comment';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'moment-comment-name';
            nameSpan.textContent = (c.name || 'TA') + '：';
            row.appendChild(nameSpan);
            row.appendChild(document.createTextNode(c.text || ''));
            commentsEl.appendChild(row);
        });
        main.appendChild(commentsEl);
    }

    item.appendChild(main);
    return item;
}

/**
 * 头像内容（有图用图，否则回退到 svg）
 */
function createAvatarContent(src) {
    if (src) {
        const img = document.createElement('img');
        img.className = 'mj-avatar-img';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.src = src;
        return img;
    }
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.padding = '8px';
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute(
        'd',
        'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'
    );
    svg.appendChild(path);
    return svg;
}


/* ==========================================================================
   07. 动态列表事件（点赞 / 评论 / 删除）
   ========================================================================== */

function bindFeedDelegate() {
    const feed = byId('moments-feed');
    if (!feed) return;

    feed.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-moment-action]');
        if (!btn) return;
        const item = btn.closest('[data-post-id]');
        if (!item) return;
        const postId = item.dataset.postId;

        const action = btn.dataset.momentAction;
        if (action === 'like')   doLike(postId);
        else if (action === 'comment') doComment(postId);
        else if (action === 'delete')  doDelete(postId);
    });
}

/**
 * 点赞 / 取消点赞
 */
function doLike(postId) {
    const data = get(KEYS.MOMENTS);
    const post = data.posts.find((p) => p.id === postId);
    if (!post) return;

    post.likes = Array.isArray(post.likes) ? post.likes : [];
    const myName = get(KEYS.PROFILE).me.name || '我';
    const myId = 'me';

    const idx = post.likes.findIndex((l) => l.id === myId);
    if (idx === -1) {
        post.likes.push({ id: myId, name: myName, ts: Date.now() });
    } else {
        post.likes.splice(idx, 1);
    }

    set(KEYS.MOMENTS, data);
    renderFeed();
}

/**
 * 评论
 */
function doComment(postId) {
    const data = get(KEYS.MOMENTS);
    const post = data.posts.find((p) => p.id === postId);
    if (!post) return;

    const text = window.prompt('评论：', '');
    if (text === null) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    post.comments = Array.isArray(post.comments) ? post.comments : [];
    post.comments.push({
        id: uid('cmt'),
        name: get(KEYS.PROFILE).me.name || '我',
        text: trimmed,
        ts: Date.now()
    });
    set(KEYS.MOMENTS, data);
    renderFeed();

    // TA 概率性回复
    if (Math.random() < 0.7) {
        setTimeout(() => {
            const d2 = get(KEYS.MOMENTS);
            const p2 = d2.posts.find((p) => p.id === postId);
            if (!p2) return;
            p2.comments = p2.comments || [];
            p2.comments.push({
                id: uid('cmt'),
                name: get(KEYS.PROFILE).ta.name || 'TA',
                text: randomPick(TA_COMMENTS),
                ts: Date.now()
            });
            set(KEYS.MOMENTS, d2);
            renderFeed();
        }, randomInt(1500, 4000));
    }
}

/**
 * 删除动态（仅自己）
 */
function doDelete(postId) {
    const data = get(KEYS.MOMENTS);
    const post = data.posts.find((p) => p.id === postId);
    if (!post || post.authorId !== 'me') return;
    if (!window.confirm('删除这条动态？')) return;

    data.posts = data.posts.filter((p) => p.id !== postId);
    set(KEYS.MOMENTS, data);
    renderFeed();
    toast('已删除');
}


/* ==========================================================================
   08. 封面（点击换背景）
   ========================================================================== */

function bindBg() {
    const bg = byId('moments-bg');
    if (!bg) return;

    bg.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const data = get(KEYS.MOMENTS);
                data.bg = reader.result;
                set(KEYS.MOMENTS, data);
                renderBg();
                toast('已更换背景');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    });

    // 长按 → 恢复默认背景
    let pressTimer = null;
    bg.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            if (window.confirm('恢复默认背景？')) {
                const data = get(KEYS.MOMENTS);
                data.bg = '';
                set(KEYS.MOMENTS, data);
                renderBg();
            }
        }, 700);
    }, { passive: true });
    const cancel = () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; };
    bg.addEventListener('touchend', cancel);
    bg.addEventListener('touchmove', cancel);
    bg.addEventListener('touchcancel', cancel);
}


/* ==========================================================================
   09. 头部按钮（发动态 / 访客记录）
   ========================================================================== */

function bindHeaderButtons() {
    const postBtn = byId('btn-moments-post');
    if (postBtn) postBtn.addEventListener('click', openPostPanel);

    const visitorsBtn = byId('btn-moments-visitors');
    if (visitorsBtn) visitorsBtn.addEventListener('click', showVisitors);
}


/* ==========================================================================
   10. 发布动态面板
   --------------------------------------------------------------------------
   复用 .question-create-panel 样式做底部弹层
   ========================================================================== */

let _postPanelEl = null;

function openPostPanel() {
    if (!_postPanelEl) {
        _postPanelEl = createPostPanel();
        const screen = byId('screen-moments');
        if (screen) screen.appendChild(_postPanelEl);
    }
    _postPanelEl.hidden = false;

    // 清空
    const textEl = _postPanelEl.querySelector('#moment-post-text');
    const imgsEl = _postPanelEl.querySelector('#moment-post-preview');
    if (textEl) textEl.value = '';
    if (imgsEl) imgsEl.innerHTML = '';

    // 暂存已选图片
    _postPanelEl._images = [];
}

function createPostPanel() {
    const panel = document.createElement('div');
    panel.className = 'question-create-panel';
    panel.id = 'moment-post-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <div class="question-create-header">
            <h3>发朋友圈</h3>
            <button data-moment-post-close aria-label="关闭">✕</button>
        </div>
        <div class="question-create-body">
            <div class="question-create-item">
                <label for="moment-post-text">这一刻的想法</label>
                <textarea id="moment-post-text" rows="6"
                    style="width:100%;padding:12px 16px;border:1px solid var(--c-line-2);border-radius:12px;font-size:14px;line-height:1.65;background:var(--c-surface-2);resize:none;"
                    placeholder="记录一下吧~"></textarea>
            </div>
            <div class="question-create-item">
                <label>图片</label>
                <button type="button" data-moment-post-pick
                    style="align-self:flex-start;padding:6px 14px;border-radius:999px;font-size:13px;color:var(--c-primary);background:var(--c-primary-soft);">
                    + 添加图片
                </button>
                <div id="moment-post-preview"
                    style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;"></div>
            </div>
        </div>
        <div class="question-create-actions">
            <button data-moment-post-close>取消</button>
            <button data-moment-post-save>发布</button>
        </div>
    `;

    // 事件
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-moment-post-close]')) {
            panel.hidden = true;
            return;
        }
        if (e.target.closest('[data-moment-post-pick]')) {
            pickImages(panel);
            return;
        }
        if (e.target.closest('[data-moment-post-save]')) {
            submitPost(panel);
        }
    });

    return panel;
}

function pickImages(panel) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
        const files = Array.from(input.files || []);
        if (!files.length) return;

        panel._images = panel._images || [];
        const preview = panel.querySelector('#moment-post-preview');
        if (!preview) return;

        let remaining = files.length;
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                panel._images.push(reader.result);

                const img = document.createElement('img');
                img.src = reader.result;
                img.alt = '';
                img.style.width = '100%';
                img.style.aspectRatio = '1 / 1';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                preview.appendChild(img);

                if (--remaining === 0) {
                    // 全部处理完成
                }
            };
            reader.readAsDataURL(file);
        });
    };
    input.click();
}

function submitPost(panel) {
    const textEl = panel.querySelector('#moment-post-text');
    const text = (textEl?.value || '').trim();
    const images = panel._images || [];

    if (!text && images.length === 0) {
        toast('至少写点什么或加张图吧');
        return;
    }

    const profile = get(KEYS.PROFILE);
    const data = get(KEYS.MOMENTS);
    const post = {
        id: uid('post'),
        authorId: 'me',
        authorName: profile.me.name || '我',
        authorAvatar: profile.me.avatar || '',
        text,
        images,
        ts: Date.now(),
        likes: [],
        comments: []
    };
    data.posts.push(post);
    set(KEYS.MOMENTS, data);

    panel.hidden = true;
    renderFeed();
    toast('已发布');

    // 触发 TA 点赞/评论
    scheduleTaInteraction(post.id);
    bus.emit('moments:new', post);
}


/* ==========================================================================
   11. TA 交互（点赞 / 评论 / 转发朋友圈）
   ========================================================================== */

function scheduleTaInteraction(postId) {
    // 60% 概率点赞
    if (Math.random() < 0.7) {
        setTimeout(() => {
            const data = get(KEYS.MOMENTS);
            const post = data.posts.find((p) => p.id === postId);
            if (!post) return;
            post.likes = post.likes || [];
            const taId = 'ta';
            if (!post.likes.find((l) => l.id === taId)) {
                post.likes.push({
                    id: taId,
                    name: get(KEYS.PROFILE).ta.name || 'TA',
                    ts: Date.now()
                });
                set(KEYS.MOMENTS, data);
                renderFeed();
            }
        }, randomInt(2000, 6000));
    }

    // 50% 概率评论
    if (Math.random() < 0.5) {
        setTimeout(() => {
            const data = get(KEYS.MOMENTS);
            const post = data.posts.find((p) => p.id === postId);
            if (!post) return;
            post.comments = post.comments || [];
            post.comments.push({
                id: uid('cmt'),
                name: get(KEYS.PROFILE).ta.name || 'TA',
                text: randomPick(TA_COMMENTS),
                ts: Date.now()
            });
            set(KEYS.MOMENTS, data);
            renderFeed();
        }, randomInt(3000, 9000));
    }
}


/* ==========================================================================
   12. 访客记录
   ========================================================================== */

/**
 * 记录一次我的访问
 */
function recordMyVisit() {
    const data = get(KEYS.MOMENTS);
    data.visitors = Array.isArray(data.visitors) ? data.visitors : [];
    data.visitors.push({
        id: uid('visit'),
        name: get(KEYS.PROFILE).me.name || '我',
        ts: Date.now()
    });
    // 只保留最近 100 条
    if (data.visitors.length > 100) {
        data.visitors = data.visitors.slice(-100);
    }
    set(KEYS.MOMENTS, data);

    // 偶尔"TA"也来访问
    if (Math.random() < 0.35) {
        setTimeout(() => {
            const d = get(KEYS.MOMENTS);
            d.visitors.push({
                id: uid('visit'),
                name: get(KEYS.PROFILE).ta.name || 'TA',
                ts: Date.now()
            });
            set(KEYS.MOMENTS, d);
        }, randomInt(3000, 8000));
    }
}

/**
 * 显示访客记录
 */
function showVisitors() {
    const data = get(KEYS.MOMENTS);
    const visitors = (data.visitors || []).slice().reverse();

    if (!visitors.length) {
        toast('还没有访客记录');
        return;
    }

    // 简单的文本弹窗
    const lines = visitors.slice(0, 15)
        .map((v) => `${v.name} · ${formatChatTime(v.ts)}`)
        .join('\n');
    window.alert(`最近访客：\n\n${lines}`);
}


/* ==========================================================================
   13. TA 主动发朋友圈
   ========================================================================== */

/**
 * 生成一条 TA 的动态
 */
export function createTaPost() {
    const profile = get(KEYS.PROFILE);
    const data = get(KEYS.MOMENTS);
    const settings = get(KEYS.SETTINGS);
    const cfg = settings.moments || {};

    // 是否让 TA 主动发（沿用已有的开关逻辑，默认为开）
    // 这里简单地按随机概率触发，不做强制限制
    const post = {
        id: uid('post'),
        authorId: 'ta',
        authorName: profile.ta.name || 'TA',
        authorAvatar: profile.ta.avatar || '',
        text: randomPick(TA_POSTS),
        images: [],
        ts: Date.now(),
        likes: [],
        comments: []
    };
    data.posts.push(post);
    set(KEYS.MOMENTS, data);
    bus.emit('moments:new', post);
    return post;
}

/**
 * 启动一个后台循环：每 3 分钟检查一次是否让 TA 发动态
 */
function startTaPostLoop() {
    if (_loopTimer) clearInterval(_loopTimer);

    _loopTimer = setInterval(() => {
        const now = Date.now();
        if (now - _lastTaPostAt < TA_POST_COOLDOWN) return;
        // 约 6% 概率发
        if (Math.random() < 0.06) {
            _lastTaPostAt = now;
            createTaPost();
        }
    }, 60 * 1000);
}


/* ==========================================================================
   14. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const momentsActions = {
    'post-moment':   () => openPostPanel(),
    'view-visitors': () => showVisitors(),
    'change-moments-bg': () => byId('moments-bg')?.click()
};

export const momentsNavs = {
    'moments': () => {
        ensureMomentsData();
        renderBg();
        renderFeed();
        showScreen('screen-moments');
    }
};


/* ==========================================================================
   15. 对外导出
   ========================================================================== */

export default {
    initMoments,
    destroyMoments,
    createTaPost,
    momentsActions,
    momentsNavs
};