/**
 * audio-player.js
 * 真正的音乐播放器
 * 依赖：config / utils / state / core / data
 * 被依赖：features.js / listeners.js
 *
 * 功能：
 * 1. 播放 / 暂停 / 切歌 / 拖动进度
 * 2. 播放列表
 * 3. 音量控制
 * 4. 循环 / 随机模式
 * 5. 进度实时更新 UI
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var STATE = global.APP_STATE || {};
    var CORE = global.APP_CORE || {};
    var DATA = global.APP_DATA || {};

    var Dom = UTILS.Dom;
    var Time = UTILS.Time;
    var Num = UTILS.Num;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    /* ============================================================
     * 1. 内部状态
     * ============================================================ */
    var _audio = null;           // HTMLAudioElement
    var _playlist = [];          // 当前播放列表
    var _currentIndex = -1;      // 当前索引
    var _mode = 'list';          // 'list' | 'single' | 'shuffle'
    var _volume = 0.8;
    var _inited = false;
    var _tickTimer = null;

    /* ============================================================
     * 2. 初始化
     * ============================================================ */
    function init() {
        if (_inited) return;

        _audio = new Audio();
        _audio.preload = 'metadata';
        _audio.volume = _volume;

        _audio.addEventListener('timeupdate', _onTimeUpdate);
        _audio.addEventListener('loadedmetadata', _onLoaded);
        _audio.addEventListener('ended', _onEnded);
        _audio.addEventListener('play', _onPlay);
        _audio.addEventListener('pause', _onPause);
        _audio.addEventListener('error', _onError);

        // 从 localStorage 恢复音量、模式
        var saved = UTILS.Store.get('audio_settings');
        if (saved) {
            _volume = saved.volume !== undefined ? saved.volume : 0.8;
            _mode = saved.mode || 'list';
            _audio.volume = _volume;
        }

        _inited = true;
        Log.log('[audio] 初始化完成');
    }

    /* ============================================================
     * 3. 播放控制
     * ============================================================ */

    /**
     * 播放一个 URL
     * @param {string} url
     * @param {object} info { title, author, id }
     */
    function play(url, info) {
        if (!_audio) init();
        if (!url) { Log.warn('[audio] 没有 url'); return false; }

        _audio.src = url;
        _currentInfo = info || {};

        var p = _audio.play();
        if (p && p.catch) {
            p.catch(function (err) {
                Log.error('[audio] 播放失败:', err);
                if (CORE.emit) CORE.emit('audio:error', { error: err, info: info });
            });
        }

        _startTick();
        _updateUI();
        if (CORE.emit) CORE.emit('audio:play', { url: url, info: info });
        return true;
    }

    var _currentInfo = {};

    function pause() {
        if (!_audio) return;
        _audio.pause();
    }

    function resume() {
        if (!_audio) return;
        if (!_audio.src) return;
        _audio.play().catch(function () {});
    }

    function toggle() {
        if (!_audio || !_audio.src) return;
        if (_audio.paused) resume();
        else pause();
    }

    function stop() {
        if (!_audio) return;
        _audio.pause();
        _audio.currentTime = 0;
        _stopTick();
        _updateUI();
    }

    /**
     * 跳到指定秒
     */
    function seek(sec) {
        if (!_audio) return;
        try {
            _audio.currentTime = Math.max(0, Number(sec) || 0);
        } catch (e) {}
        _updateUI();
    }

    /**
     * 按百分比拖动（0~100）
     */
    function seekPercent(p) {
        if (!_audio || !_audio.duration) return;
        seek((Number(p) / 100) * _audio.duration);
    }

    function setVolume(v) {
        if (!_audio) return;
        _volume = Math.max(0, Math.min(1, Number(v)));
        _audio.volume = _volume;
        _saveSettings();
        if (CORE.emit) CORE.emit('audio:volume', _volume);
    }

    function getVolume() {
        return _volume;
    }

    /* ============================================================
     * 4. 播放列表
     * ============================================================ */

    /**
     * 设置播放列表
     * @param {array} list [{ id, title, author, url, cover }]
     * @param {number} startIndex 从第几首开始
     */
    function setPlaylist(list, startIndex) {
        _playlist = list || [];
        _currentIndex = (typeof startIndex === 'number') ? startIndex : 0;

        if (_playlist.length === 0) return;
        _playCurrent();
    }

    function playByIndex(index) {
        if (index < 0 || index >= _playlist.length) return;
        _currentIndex = index;
        _playCurrent();
    }

    function next() {
        if (_playlist.length === 0) return;
        if (_mode === 'shuffle') {
            _currentIndex = Num.randInt(0, _playlist.length - 1);
        } else {
            _currentIndex = (_currentIndex + 1) % _playlist.length;
        }
        _playCurrent();
    }

    function prev() {
        if (_playlist.length === 0) return;
        if (_mode === 'shuffle') {
            _currentIndex = Num.randInt(0, _playlist.length - 1);
        } else {
            _currentIndex = (_currentIndex - 1 + _playlist.length) % _playlist.length;
        }
        _playCurrent();
    }

    function _playCurrent() {
        var song = _playlist[_currentIndex];
        if (!song) return;
        if (!song.url) {
            Log.warn('[audio] 歌曲缺少 url:', song);
            _updateUI();
            return;
        }
        play(song.url, song);
    }

    function getCurrent() {
        return _playlist[_currentIndex] || null;
    }

    function getPlaylist() {
        return _playlist.slice();
    }

    function getCurrentIndex() {
        return _currentIndex;
    }

    /* ============================================================
     * 5. 播放模式
     * ============================================================ */
    function setMode(mode) {
        _mode = ['list', 'single', 'shuffle'].indexOf(mode) > -1 ? mode : 'list';
        _saveSettings();
        _updateUI();
        if (CORE.emit) CORE.emit('audio:mode', _mode);
    }

    function getMode() {
        return _mode;
    }

    function cycleMode() {
        var order = ['list', 'single', 'shuffle'];
        var i = order.indexOf(_mode);
        setMode(order[(i + 1) % order.length]);
        return _mode;
    }

    /* ============================================================
     * 6. 事件
     * ============================================================ */
    function _onTimeUpdate() {
        _updateUI();
    }

    function _onLoaded() {
        _updateUI();
        if (CORE.emit) CORE.emit('audio:loaded', {
            duration: _audio.duration,
            info: _currentInfo
        });
    }

    function _onEnded() {
        if (CORE.emit) CORE.emit('audio:ended', { info: _currentInfo });
        if (_mode === 'single') {
            _audio.currentTime = 0;
            _audio.play().catch(function () {});
        } else {
            next();
        }
    }

    function _onPlay() {
        _startTick();
        _updateUI();
        if (CORE.emit) CORE.emit('audio:playing', {});
    }

    function _onPause() {
        _stopTick();
        _updateUI();
        if (CORE.emit) CORE.emit('audio:paused', {});
    }

    function _onError(e) {
        Log.error('[audio] 播放错误', e);
        if (CORE.emit) CORE.emit('audio:error', { error: e });
    }

    /* ============================================================
     * 7. UI 同步
     * ============================================================ */
    var _tickTimer = null;

    function _startTick() {
        _stopTick();
        _tickTimer = setInterval(function () {
            _updateProgressOnly();
        }, 1000);
    }

    function _stopTick() {
        if (_tickTimer) {
            clearInterval(_tickTimer);
            _tickTimer = null;
        }
    }

    function _updateProgressOnly() {
        if (!_audio) return;

        var cur = _audio.currentTime || 0;
        var dur = _audio.duration || 0;
        var percent = dur > 0 ? (cur / dur) * 100 : 0;

        // 首页播放器
        _setTextAll('.player-time-row span:first-child', formatTime(cur));
        _setTextAll('.player-time-row span:last-child', formatTime(dur));
        _setWidthAll('.player-progress-bar', percent + '%');

        // 音乐页播放器
        _setTextAll('.music-time-row span:first-child', formatTime(cur));
        _setTextAll('.music-time-row span:last-child', formatTime(dur));
        _setWidthAll('.progress-bar', percent + '%');

        if (CORE.emit) CORE.emit('audio:progress', {
            current: cur,
            duration: dur,
            percent: percent
        });
    }

    function _updateUI() {
        if (!_audio) return;

        // 播放/暂停按钮
        var isPaused = _audio.paused || !_audio.src;
        _setTextAll('.btn-player-play', isPaused ? '▶' : '⏸');
        _setTextAll('.play-btn', isPaused ? '▶' : '⏸');

        // 当前歌曲信息
        if (_currentInfo) {
            _setTextAll('.player-text h3', _currentInfo.title || '未在播放');
            _setTextAll('.player-text p', _currentInfo.author || '选择一首歌开始');
            _setTextAll('.music-title', _currentInfo.title || '未在播放');
            _setTextAll('.music-author', _currentInfo.author || '');
        }

        _updateProgressOnly();
    }

    function _setTextAll(sel, text) {
        document.querySelectorAll(sel).forEach(function (el) {
            el.textContent = text;
        });
    }

    function _setWidthAll(sel, w) {
        document.querySelectorAll(sel).forEach(function (el) {
            el.style.width = w;
        });
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec)) return '00:00';
        var s = Math.floor(sec);
        var m = Math.floor(s / 60);
        var ss = s % 60;
        return (m < 10 ? '0' + m : m) + ':' + (ss < 10 ? '0' + ss : ss);
    }

    function _saveSettings() {
        UTILS.Store.set('audio_settings', {
            volume: _volume,
            mode: _mode
        });
    }

    /* ============================================================
     * 8. 与商城音乐库整合
     * ============================================================ */

    /**
     * 从音乐库播放
     * @param {array} list 数据源（默认取 DATA.Music.listLibrary()）
     * @param {number} index
     */
    function playFromLibrary(list, index) {
        var songs = list || (DATA.Music && DATA.Music.listLibrary()) || [];
        var playable = songs.filter(function (s) { return s.url || s.link; })
            .map(function (s) {
                return {
                    id: s.id,
                    title: s.title || '未知',
                    author: s.author || '',
                    url: s.url || s.link,
                    cover: s.cover || ''
                };
            });

        if (playable.length === 0) {
            Log.warn('[audio] 音乐库里没有可播放的歌');
            return false;
        }

        setPlaylist(playable, index || 0);
        return true;
    }

    /**
     * 从某个链接播放
     */
    function playUrl(url, title, author) {
        return play(url, {
            title: title || '未知',
            author: author || '',
            url: url
        });
    }

    /* ============================================================
     * 9. 状态
     * ============================================================ */
    function isPlaying() {
        return _audio && !_audio.paused && !!_audio.src;
    }

    function isPaused() {
        return !isPlaying();
    }

    function getCurrentTime() {
        return _audio ? _audio.currentTime : 0;
    }

    function getDuration() {
        return _audio ? _audio.duration : 0;
    }

    function getProgress() {
        if (!_audio || !_audio.duration) return 0;
        return (_audio.currentTime / _audio.duration) * 100;
    }

    /* ============================================================
     * 10. 销毁
     * ============================================================ */
    function destroy() {
        if (_audio) {
            _audio.pause();
            _audio.src = '';
            _audio = null;
        }
        _stopTick();
        _inited = false;
    }

    /* ============================================================
     * 11. 对外导出
     * ============================================================ */
    var APP_AUDIO = {
        init: init,
        destroy: destroy,

        // 播放控制
        play: play,
        playUrl: playUrl,
        playFromLibrary: playFromLibrary,
        pause: pause,
        resume: resume,
        toggle: toggle,
        stop: stop,
        seek: seek,
        seekPercent: seekPercent,

        // 切歌
        next: next,
        prev: prev,
        playByIndex: playByIndex,

        // 播放列表
        setPlaylist: setPlaylist,
        getPlaylist: getPlaylist,
        getCurrent: getCurrent,
        getCurrentIndex: getCurrentIndex,

        // 模式
        setMode: setMode,
        getMode: getMode,
        cycleMode: cycleMode,

        // 音量
        setVolume: setVolume,
        getVolume: getVolume,

        // 状态
        isPlaying: isPlaying,
        isPaused: isPaused,
        getCurrentTime: getCurrentTime,
        getDuration: getDuration,
        getProgress: getProgress,

        // 工具
        formatTime: formatTime
    };

    global.APP_AUDIO = APP_AUDIO;

})(typeof window !== 'undefined' ? window : this);