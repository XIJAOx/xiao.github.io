/* ==========================================================================
   梦角 · Dream Corner
   音乐模块  js/modules/music.js
   --------------------------------------------------------------------------
   覆盖 HTML 中的：
     音乐页 #screen-music
       - #music-tabs（我的音乐库 / 我的收藏 / TA 的收藏）
       - #music-add-input + #music-url-input + #btn-confirm-add-music
       - #music-library（列表）
       - #music-empty（空状态）
       - #music-playlist + #music-playlist-items + #btn-music-playlist-add
       - #btn-music-batch-manage / #music-batch-actions
         + #btn-music-batch-delete / #btn-music-batch-cancel
     首页播放器 #home-music-player
       - #home-music-title / #home-music-sub
       - #home-music-progress / #home-music-current-time / #home-music-total-time
       - #btn-home-music-prev / #btn-home-music-play / #btn-home-music-next

   数据结构（KEYS.MUSIC）：
     {
       library:     [{ id, title, artist, url, duration, playlist }],
       favorites:   [songId, ...],       // 我的收藏
       taFavorites: [songId, ...],       // TA 的收藏
       playlists:   [{ id, name, songIds: [] }],
       current:     { songId, playing, currentTime }
     }
   ========================================================================== */

import {
    $, $$, byId,
    showScreen,
    toast,
    setVisible, setText,
    formatDuration,
    uid, randomInt,
    escapeHtml
} from '../utils/dom.js';

import {
    KEYS, get, set, update
} from '../utils/storage.js';

import { bus, on } from '../utils/event.js';


/* ==========================================================================
   01. 常量
   ========================================================================== */

/** 音乐页三个 tab */
const TABS = {
    LIBRARY: 'my-library',
    MY_FAV:  'my-fav',
    TA_FAV:  'ta-fav'
};

/** 默认歌单 id */
const DEFAULT_PLAYLIST_ID = 'default';

/** 进度更新频率（毫秒） */
const PROGRESS_INTERVAL = 500;


/* ==========================================================================
   02. 内部状态
   ========================================================================== */

let _initialized = false;
let _unsubs = [];

let _currentTab = TABS.LIBRARY;
let _currentPlaylistFilter = null;    // 当前点击的歌单过滤
let _batchMode = false;
const _selectedIds = new Set();

/** Audio 单例 */
let _audio = null;
let _progressTimer = null;
/** 防止 bus 事件循环的标记 */
let _suppressBroadcast = false;


/* ==========================================================================
   03. 入口
   ========================================================================== */

export function initMusic() {
    if (_initialized) return;
    _initialized = true;

    // 确保数据完整
    ensureMusicData();

    // 创建 Audio
    createAudio();

    // 绑定页面
    bindTabs();
    bindAddMusic();
    bindPlaylistAdd();
    bindBatchManage();
    bindLibraryDelegate();
    bindPlaylistDelegate();

    // 首页控制按钮（HTML 里的 data-action 已经指向，但这里只需订阅 bus）
    bindBusHandlers();

    // 首次渲染
    renderLibrary();
    renderPlaylists();

    // 恢复上次播放
    restoreLastState();
}

export function destroyMusic() {
    _unsubs.forEach((off) => off && off());
    _unsubs = [];
    stopProgressTimer();
    if (_audio) {
        _audio.pause();
        _audio.src = '';
        _audio = null;
    }
    _initialized = false;
}


/* ==========================================================================
   04. 数据结构
   ========================================================================== */

function ensureMusicData() {
    const data = get(KEYS.MUSIC);
    if (!Array.isArray(data.library))     data.library = [];
    if (!Array.isArray(data.favorites))   data.favorites = [];
    if (!Array.isArray(data.taFavorites)) data.taFavorites = [];
    if (!Array.isArray(data.playlists) || !data.playlists.length) {
        data.playlists = [
            { id: DEFAULT_PLAYLIST_ID, name: '默认歌单', songIds: [] }
        ];
    }
    if (!data.current || typeof data.current !== 'object') {
        data.current = { songId: null, playing: false, currentTime: 0 };
    }
    set(KEYS.MUSIC, data);
    return data;
}

function getLibrary() {
    return ensureMusicData().library || [];
}

function getSongById(id) {
    return getLibrary().find((s) => s.id === id) || null;
}

function saveCurrent(patch) {
    const data = get(KEYS.MUSIC);
    data.current = { ...data.current, ...patch };
    set(KEYS.MUSIC, data);
}


/* ==========================================================================
   05. Audio 控制
   ========================================================================== */

function createAudio() {
    if (_audio) return;
    _audio = new Audio();
    _audio.preload = 'metadata';

    _audio.addEventListener('timeupdate', () => {
        broadcastState();
        updateProgressBar();
    });

    _audio.addEventListener('loadedmetadata', () => {
        // 拿到真实时长后写入曲目
        const current = get(KEYS.MUSIC).current;
        if (current && current.songId && _audio.duration && isFinite(_audio.duration)) {
            updateSongDuration(current.songId, _audio.duration);
        }
        broadcastState();
    });

    _audio.addEventListener('ended', () => {
        playNext();
    });

    _audio.addEventListener('error', () => {
        console.warn('[music] 音频加载失败');
        toast('这首歌暂时播放不了');
        broadcastState();
    });

    _audio.addEventListener('play', () => {
        saveCurrent({ playing: true });
        startProgressTimer();
        broadcastState();
    });

    _audio.addEventListener('pause', () => {
        saveCurrent({ playing: false });
        stopProgressTimer();
        broadcastState();
    });
}

/**
 * 播放指定歌曲
 * @param {string} songId
 * @param {boolean} [autoplay=true]
 */
export function playSong(songId, autoplay = true) {
    const song = getSongById(songId);
    if (!song) {
        toast('这首歌不存在');
        return;
    }
    if (!_audio) createAudio();

    // 同曲续播
    const current = get(KEYS.MUSIC).current;
    if (current.songId === songId && _audio.src) {
        if (autoplay && _audio.paused) _audio.play().catch(() => {});
        return;
    }

    _audio.src = song.url || '';
    _audio.currentTime = 0;
    saveCurrent({ songId, currentTime: 0 });

    if (autoplay) {
        _audio.play().catch((err) => {
            console.warn('[music] 播放失败：', err);
            toast('浏览器阻止了自动播放，请手动点击');
        });
    }

    // 渲染立即反馈
    renderLibrary();
    broadcastState();
    updateProgressBar();
}

/**
 * 暂停
 */
export function pause() {
    if (_audio && !_audio.paused) _audio.pause();
}

/**
 * 恢复播放
 */
export function resume() {
    if (_audio && _audio.paused && _audio.src) {
        _audio.play().catch(() => {});
    }
}

/**
 * 切换播放 / 暂停
 */
export function togglePlay() {
    const current = get(KEYS.MUSIC).current;
    if (!current.songId) {
        // 没选歌 → 播第一首
        const list = getPlaylistSongsForCurrentTab();
        if (list.length) playSong(list[0].id);
        return;
    }
    if (_audio && _audio.paused) resume();
    else pause();
}

/**
 * 下一首
 */
export function playNext() {
    const list = getPlaylistSongsForCurrentTab();
    if (!list.length) return;
    const current = get(KEYS.MUSIC).current;
    const idx = list.findIndex((s) => s.id === current.songId);
    const nextIdx = (idx + 1 + list.length) % list.length;
    playSong(list[nextIdx].id);
}

/**
 * 上一首
 */
export function playPrev() {
    const list = getPlaylistSongsForCurrentTab();
    if (!list.length) return;
    const current = get(KEYS.MUSIC).current;
    const idx = list.findIndex((s) => s.id === current.songId);
    const prevIdx = (idx - 1 + list.length) % list.length;
    playSong(list[prevIdx].id);
}

/**
 * 获取当前 tab（或当前歌单）对应的歌曲列表
 */
function getPlaylistSongsForCurrentTab() {
    const data = ensureMusicData();

    if (_currentPlaylistFilter) {
        const pl = data.playlists.find((p) => p.id === _currentPlaylistFilter);
        if (pl) {
            return pl.songIds
                .map((id) => data.library.find((s) => s.id === id))
                .filter(Boolean);
        }
    }

    if (_currentTab === TABS.LIBRARY) return data.library;
    if (_currentTab === TABS.MY_FAV) {
        return data.favorites
            .map((id) => data.library.find((s) => s.id === id))
            .filter(Boolean);
    }
    if (_currentTab === TABS.TA_FAV) {
        return data.taFavorites
            .map((id) => data.library.find((s) => s.id === id))
            .filter(Boolean);
    }
    return data.library;
}


/* ==========================================================================
   06. 播放状态广播
   ========================================================================== */

/**
 * 广播给首页播放器
 */
function broadcastState() {
    if (_suppressBroadcast) return;

    const data = ensureMusicData();
    const current = data.current;
    const song = current.songId ? getSongById(current.songId) : null;

    const state = {
        title: song ? song.title : '未在播放',
        sub: song ? (song.artist || '未知歌手') : '选择一首歌开始',
        current: _audio ? (_audio.currentTime || 0) : 0,
        total: _audio && isFinite(_audio.duration) ? _audio.duration : (song?.duration || 0),
        playing: !!(current.playing && _audio && !_audio.paused),
        progress: _audio && _audio.duration
            ? (_audio.currentTime / _audio.duration) * 100
            : 0
    };

    bus.emit('music:state', state);
}

/**
 * 更新首页进度条
 */
function updateProgressBar() {
    const bar = byId('home-music-progress');
    const curEl = byId('home-music-current-time');
    const totalEl = byId('home-music-total-time');
    if (!bar || !_audio) return;

    const cur = _audio.currentTime || 0;
    const total = isFinite(_audio.duration) ? _audio.duration : 0;
    bar.style.width = total > 0 ? `${(cur / total) * 100}%` : '0%';
    if (curEl) curEl.textContent = formatDuration(cur);
    if (totalEl) totalEl.textContent = formatDuration(total);
}

function startProgressTimer() {
    stopProgressTimer();
    _progressTimer = setInterval(() => {
        broadcastState();
        updateProgressBar();
    }, PROGRESS_INTERVAL);
}

function stopProgressTimer() {
    if (_progressTimer) clearInterval(_progressTimer);
    _progressTimer = null;
}

/**
 * 恢复上次播放的歌曲（不自动播放）
 */
function restoreLastState() {
    const data = ensureMusicData();
    const songId = data.current.songId;
    if (!songId) {
        broadcastState();
        return;
    }
    const song = getSongById(songId);
    if (!song) return;

    if (!_audio) createAudio();
    _audio.src = song.url || '';
    _audio.currentTime = data.current.currentTime || 0;

    // 不自动播放，只更新 UI
    broadcastState();
    updateProgressBar();
}


/* ==========================================================================
   07. Tab 切换
   ========================================================================== */

function bindTabs() {
    const wrap = byId('music-tabs');
    if (!wrap) return;
    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-music-tab]');
        if (!btn) return;
        switchTab(btn.dataset.musicTab);
    });
}

export function switchTab(tab) {
    if (!Object.values(TABS).includes(tab)) return;
    _currentTab = tab;
    _currentPlaylistFilter = null;   // 切 tab 时清掉歌单过滤

    const wrap = byId('music-tabs');
    if (wrap) {
        wrap.querySelectorAll('[data-music-tab]').forEach((btn) => {
            const active = btn.dataset.musicTab === tab;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
    }

    exitBatchMode();
    renderLibrary();
}


/* ==========================================================================
   08. 渲染：音乐库
   --------------------------------------------------------------------------
   DOM 结构对齐 CSS：
     .music-item
       .music-item-cover
       .music-item-info
         .music-item-title
         .music-item-sub
   ========================================================================== */

function renderLibrary() {
    const wrap = byId('music-library');
    const empty = byId('music-empty');
    if (!wrap) return;

    const songs = getPlaylistSongsForCurrentTab();
    const current = get(KEYS.MUSIC).current;

    // 清空（保留空状态节点）
    Array.from(wrap.children).forEach((child) => {
        if (child !== empty) child.remove();
    });

    if (!songs.length) {
        if (empty) {
            empty.hidden = false;
            empty.textContent = getEmptyText();
        }
        return;
    }
    if (empty) empty.hidden = true;

    const fragment = document.createDocumentFragment();
    songs.forEach((song) => {
        fragment.appendChild(createSongEl(song, current.songId === song.id));
    });
    wrap.appendChild(fragment);
}

function getEmptyText() {
    if (_currentTab === TABS.LIBRARY) return '还没有音乐';
    if (_currentTab === TABS.MY_FAV)  return '还没有收藏的音乐';
    return 'TA 还没有收藏的音乐';
}

function createSongEl(song, isPlaying) {
    const item = document.createElement('div');
    item.className = 'music-item';
    item.dataset.songId = song.id;
    if (isPlaying) item.classList.add('playing');
    if (_batchMode && _selectedIds.has(song.id)) item.classList.add('selected');

    // 封面
    const cover = document.createElement('div');
    cover.className = 'music-item-cover';
    cover.textContent = isPlaying ? '♪' : '♫';
    item.appendChild(cover);

    // 信息
    const info = document.createElement('div');
    info.className = 'music-item-info';

    const title = document.createElement('div');
    title.className = 'music-item-title';
    title.textContent = song.title || '未命名';
    info.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'music-item-sub';
    sub.textContent = song.artist || '未知歌手';
    info.appendChild(sub);

    item.appendChild(info);

    // 点击
    item.addEventListener('click', () => {
        if (_batchMode) {
            toggleSelectSong(song.id, item);
        } else {
            playSong(song.id);
        }
    });

    // 长按 → 收藏 / 删除
    attachLongPress(item, song);

    return item;
}


/* ==========================================================================
   09. 渲染：歌单
   ========================================================================== */

function renderPlaylists() {
    const wrap = byId('music-playlist-items');
    if (!wrap) return;

    const data = ensureMusicData();
    wrap.innerHTML = '';

    data.playlists.forEach((pl) => {
        const btn = document.createElement('button');
        btn.className = 'music-playlist-item';
        btn.dataset.playlistId = pl.id;
        btn.setAttribute('aria-label', pl.name);
        if (_currentPlaylistFilter === pl.id) btn.classList.add('active');

        const icon = document.createElement('span');
        icon.className = 'music-playlist-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '♪';

        const name = document.createElement('span');
        name.className = 'music-playlist-name';
        name.textContent = pl.name;

        btn.appendChild(icon);
        btn.appendChild(name);
        wrap.appendChild(btn);
    });
}

function bindPlaylistDelegate() {
    const wrap = byId('music-playlist-items');
    if (!wrap) return;

    wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-playlist-id]');
        if (!btn) return;
        const id = btn.dataset.playlistId;

        // 长按删除由 attachLongPressPlaylist 处理
        // 单击 = 过滤
        _currentPlaylistFilter = _currentPlaylistFilter === id ? null : id;
        renderPlaylists();
        renderLibrary();
    });

    // 长按删除
    wrap.addEventListener('contextmenu', (e) => {
        const btn = e.target.closest('[data-playlist-id]');
        if (!btn) return;
        e.preventDefault();
        const id = btn.dataset.playlistId;
        if (id === DEFAULT_PLAYLIST_ID) {
            toast('默认歌单不可删除');
            return;
        }
        if (!window.confirm('删除这个歌单？')) return;
        const data = get(KEYS.MUSIC);
        data.playlists = data.playlists.filter((p) => p.id !== id);
        set(KEYS.MUSIC, data);
        if (_currentPlaylistFilter === id) _currentPlaylistFilter = null;
        renderPlaylists();
        renderLibrary();
        toast('歌单已删除');
    });
}


/* ==========================================================================
   10. 添加音乐
   ========================================================================== */

function bindAddMusic() {
function toggleAddMusicInput() {
    const inputWrap = byId('music-add-input');
    const urlInput = byId('music-url-input');
    if (!inputWrap) return;
    inputWrap.hidden = !inputWrap.hidden;
    if (!inputWrap.hidden) urlInput?.focus();
}

function confirmAddMusic() {
    const inputWrap = byId('music-add-input');
    const urlInput = byId('music-url-input');
    const url = (urlInput?.value || '').trim();
    if (!url) {
        toast('请输入音乐链接');
        return;
    }
    addSong(url);
    if (urlInput) urlInput.value = '';
    if (inputWrap) inputWrap.hidden = true;
}

function bindAddMusic() {
    // 按钮通过 data-action 分发，这里只保留输入框的回车
    const urlInput = byId('music-url-input');
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAddMusic();
        });
    }
}
   
/**
 * 添加一首歌
 * @param {string} url
 */
export function addSong(url) {
    const data = get(KEYS.MUSIC);

    // 从 URL 里提取一个较友好的默认标题
    let title = '新歌曲';
    try {
        const u = new URL(url);
        const filename = u.pathname.split('/').filter(Boolean).pop() || '';
        const base = filename.replace(/\.[^.]+$/, '');
        if (base) title = decodeURIComponent(base);
    } catch (e) {
        // 不是合法 URL 就用默认标题
    }

    const song = {
        id: uid('song'),
        title,
        artist: '未知歌手',
        url,
        duration: 0,
        playlist: DEFAULT_PLAYLIST_ID
    };

    data.library.push(song);

    // 自动加入默认歌单
    const def = data.playlists.find((p) => p.id === DEFAULT_PLAYLIST_ID);
    if (def && !def.songIds.includes(song.id)) def.songIds.push(song.id);

    set(KEYS.MUSIC, data);

    renderLibrary();
    renderPlaylists();
    toast('已添加：' + song.title);

    // 尝试后台读取时长
    prefetchDuration(song.id, url);
}

/**
 * 后台加载音频以获取时长
 */
function prefetchDuration(songId, url) {
    try {
        const probe = new Audio();
        probe.preload = 'metadata';
        probe.src = url;
        probe.addEventListener('loadedmetadata', () => {
            if (isFinite(probe.duration)) {
                updateSongDuration(songId, probe.duration);
                renderLibrary();
            }
            probe.src = '';
        });
        probe.addEventListener('error', () => {
            probe.src = '';
        });
    } catch (e) { /* ignore */ }
}

function updateSongDuration(songId, duration) {
    const data = get(KEYS.MUSIC);
    const song = data.library.find((s) => s.id === songId);
    if (song) {
        song.duration = duration;
        set(KEYS.MUSIC, data);
    }
}


/* ==========================================================================
   11. 歌单管理
   ========================================================================== */

function bindPlaylistAdd() {
    // 走 data-action
}

function addPlaylist() {
    const name = window.prompt('新歌单名称：', '');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const data = get(KEYS.MUSIC);
    data.playlists.push({
        id: uid('pl'),
        name: trimmed,
        songIds: []
    });
    set(KEYS.MUSIC, data);
    renderPlaylists();
    toast('已创建歌单：' + trimmed);
       }


/* ==========================================================================
   12. 批量管理
   ========================================================================== */

function bindBatchManage() {
function bindBatchManage() {
    // 全部按钮走 data-action，无需在此绑定
}

function toggleBatchManage() {
    if (_batchMode) exitBatchMode();
    else enterBatchMode();
          }
    if (delBtn) delBtn.addEventListener('click', deleteSelectedSongs);
    if (cancelBtn) cancelBtn.addEventListener('click', exitBatchMode);
}

function enterBatchMode() {
    _batchMode = true;
    _selectedIds.clear();

    const btn = byId('btn-music-batch-manage');
    if (btn) btn.textContent = '完成';

    const actions = byId('music-batch-actions');
    if (actions) actions.hidden = false;

    renderLibrary();
}

function exitBatchMode() {
    _batchMode = false;
    _selectedIds.clear();

    const btn = byId('btn-music-batch-manage');
    if (btn) btn.textContent = '批量管理';

    const actions = byId('music-batch-actions');
    if (actions) actions.hidden = true;

    renderLibrary();
}

function toggleSelectSong(id, el) {
    if (_selectedIds.has(id)) {
        _selectedIds.delete(id);
        el.classList.remove('selected');
    } else {
        _selectedIds.add(id);
        el.classList.add('selected');
    }
}

function deleteSelectedSongs() {
    if (_selectedIds.size === 0) {
        toast('还没有选择');
        return;
    }

    if (!window.confirm(`确定删除选中的 ${_selectedIds.size} 首歌吗？`)) return;

    const data = get(KEYS.MUSIC);
    data.library = data.library.filter((s) => !_selectedIds.has(s.id));
    data.favorites = data.favorites.filter((id) => !_selectedIds.has(id));
    data.taFavorites = data.taFavorites.filter((id) => !_selectedIds.has(id));
    data.playlists.forEach((pl) => {
        pl.songIds = pl.songIds.filter((id) => !_selectedIds.has(id));
    });

    // 若删的是当前播放的歌，停止播放
    if (_selectedIds.has(data.current.songId)) {
        if (_audio) { _audio.pause(); _audio.src = ''; }
        data.current = { songId: null, playing: false, currentTime: 0 };
        broadcastState();
    }

    set(KEYS.MUSIC, data);

    _selectedIds.clear();
    _batchMode = false;

    const btn = byId('btn-music-batch-manage');
    if (btn) btn.textContent = '批量管理';
    const actions = byId('music-batch-actions');
    if (actions) actions.hidden = true;

    renderLibrary();
    renderPlaylists();
    toast('已删除');
}


/* ==========================================================================
   13. 长按：收藏 / 删除 / 加入歌单
   ========================================================================== */

function attachLongPress(el, song) {
    let timer = null;

    const start = () => {
        timer = setTimeout(() => {
            showSongMenu(song);
        }, 650);
    };
    const cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    el.addEventListener('touchcancel', cancel);

    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancel();
        showSongMenu(song);
    });
}

function showSongMenu(song) {
    const data = ensureMusicData();
    const isFav = data.favorites.includes(song.id);
    const favLabel = isFav ? '取消收藏' : '收藏';

    const choice = window.prompt(
        `《${song.title}》\n\n输入序号：\n1. ${favLabel}\n2. 加入歌单\n3. 删除`,
        '1'
    );
    if (choice === null) return;

    const n = parseInt(choice, 10);
    if (n === 1) toggleFavorite(song.id);
    else if (n === 2) addSongToPlaylist(song.id);
    else if (n === 3) deleteSong(song.id);
}

/**
 * 收藏 / 取消收藏
 */
function toggleFavorite(songId) {
    const data = get(KEYS.MUSIC);
    const idx = data.favorites.indexOf(songId);
    if (idx === -1) {
        data.favorites.push(songId);
        toast('已收藏');
    } else {
        data.favorites.splice(idx, 1);
        toast('已取消收藏');
    }
    set(KEYS.MUSIC, data);
    renderLibrary();
}

function addSongToPlaylist(songId) {
    const data = ensureMusicData();
    const names = data.playlists
        .map((p, i) => `${i + 1}. ${p.name}`)
        .join('\n');
    const ans = window.prompt(`加入哪个歌单？\n\n${names}`, '1');
    if (ans === null) return;
    const idx = parseInt(ans, 10) - 1;
    if (idx < 0 || idx >= data.playlists.length) return;

    const pl = data.playlists[idx];
    if (!pl.songIds.includes(songId)) {
        pl.songIds.push(songId);
        set(KEYS.MUSIC, data);
        renderPlaylists();
        toast(`已加入「${pl.name}」`);
    } else {
        toast('已经在这个歌单里了');
    }
}

function deleteSong(songId) {
    if (!window.confirm('删除这首歌？')) return;
    const data = get(KEYS.MUSIC);
    data.library = data.library.filter((s) => s.id !== songId);
    data.favorites = data.favorites.filter((id) => id !== songId);
    data.taFavorites = data.taFavorites.filter((id) => id !== songId);
    data.playlists.forEach((pl) => {
        pl.songIds = pl.songIds.filter((id) => id !== songId);
    });
    if (data.current.songId === songId) {
        if (_audio) { _audio.pause(); _audio.src = ''; }
        data.current = { songId: null, playing: false, currentTime: 0 };
        broadcastState();
    }
    set(KEYS.MUSIC, data);
    renderLibrary();
    toast('已删除');
}


/* ==========================================================================
   14. 库列表事件（选中/播放）已经内联在 createSongEl
   ========================================================================== */

function bindLibraryDelegate() {
    // 目前播放和选择的点击都在 createSongEl 里
    // 保留这个函数以便未来扩展
}


/* ==========================================================================
   15. 响应 bus 上的播放控制（来自首页播放器）
   ========================================================================== */

function bindBusHandlers() {
    _unsubs.push(
        bus.on('music:toggle', () => togglePlay()),
        bus.on('music:next',   () => playNext()),
        bus.on('music:prev',   () => playPrev()),
        bus.on('music:request-state', () => broadcastState())
    );
}


/* ==========================================================================
   16. 供 app.js 注册的 action / nav 集合
   ========================================================================== */

export const musicActions = {
    'music-batch-manage': () => byId('btn-music-batch-manage')?.click(),
    'add-music':          () => byId('btn-music-add')?.click(),
    'confirm-add-music':  () => byId('btn-confirm-add-music')?.click(),
    'delete-selected-music': () => deleteSelectedSongs(),
    'cancel-music-batch':    () => exitBatchMode(),
    'add-playlist':          () => byId('btn-music-playlist-add')?.click(),

    /* 首页播放器（HTML 里已有 data-action） */
    'music-play': () => togglePlay(),
    'music-next': () => playNext(),
    'music-prev': () => playPrev()
};

export const musicNavs = {
    'music': () => {
        ensureMusicData();
        renderLibrary();
        renderPlaylists();
        showScreen('screen-music');
    }
};


/* ==========================================================================
   17. 对外导出
   ========================================================================== */

export default {
    initMusic,
    destroyMusic,
    playSong,
    playNext,
    playPrev,
    togglePlay,
    pause,
    resume,
    addSong,
    switchTab,
    musicActions,
    musicNavs
};
