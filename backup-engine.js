/**
 * backup-engine.js
 * 备份引擎：导出/导入/自动备份/本地快照
 * 依赖：config.js / utils.js / data.js / core.js
 * 被依赖：listeners.js / main.js
 *
 * 说明：
 * 1. 支持导出为 .json 文件（下载）
 * 2. 支持从 .json 文件导入（读取 + 校验 + 恢复）
 * 3. 支持把快照存到 localStorage（不下载文件）
 * 4. 支持定时自动快照
 * 5. 挂到 window.APP_BACKUP 上
 */

(function (global) {
    'use strict';

    var CONFIG = global.APP_CONFIG || {};
    var UTILS = global.APP_UTILS || {};
    var DATA = global.APP_DATA || {};
    var CORE = global.APP_CORE || {};

    var Store = UTILS.Store;
    var Time = UTILS.Time;
    var Str = UTILS.Str;
    var Obj = UTILS.Obj;
    var Log = UTILS.Log || { log: function(){}, warn: function(){}, error: function(){} };

    var EVENTS = CONFIG.EVENTS || {};
    var BACKUP_KEY = 'backups';              // 本地快照存储 key（Store 会自动加前缀）
    var LAST_TIME_KEY = 'backup_last_time';  // 上次备份时间
    var DEFAULT_BACKUP = CONFIG.DEFAULT_BACKUP || { autoInterval: 0, maxBackups: 10 };

    // 自动备份定时器 id
    var _timer = null;
    // 是否正在备份
    var _busy = false;

    /* ============================================================
     * 1. 内部工具
     * ============================================================ */

    function _emit(event, payload) {
        if (CORE.emit) CORE.emit(event, payload);
    }

    function _now() {
        return Date.now();
    }

    // 生成备份文件名
    function _makeFileName(ext) {
        var d = new Date();
        var y = d.getFullYear();
        var m = Time.pad(d.getMonth() + 1);
        var day = Time.pad(d.getDate());
        var h = Time.pad(d.getHours());
        var mi = Time.pad(d.getMinutes());
        return '梦角备份_' + y + m + day + '_' + h + mi + '.' + (ext || 'json');
    }

    // 生成快照 ID
    function _makeSnapshotId() {
        return 'snap_' + _now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    }

    // 下载文件
    function _download(filename, content, mime) {
        try {
            var blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 1000);
            return true;
        } catch (e) {
            Log.error('[backup] 下载失败:', e);
            return false;
        }
    }

    // 读取上传的文件
    function _readFile(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error('没有文件'));
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var text = e.target.result;
                    var json = JSON.parse(text);
                    resolve(json);
                } catch (err) {
                    reject(new Error('文件内容不是有效的 JSON'));
                }
            };
            reader.onerror = function () {
                reject(new Error('读取文件失败'));
            };
            reader.readAsText(file, 'utf-8');
        });
    }

    /* ============================================================
     * 2. 校验
     * ============================================================ */

    function _validate(data) {
        if (!data || typeof data !== 'object') {
            return { ok: false, msg: '数据为空或格式错误' };
        }
        if (!data.exportedAt || !data.version) {
            return { ok: false, msg: '不是有效的备份文件（缺少版本信息）' };
        }
        // 至少得有一个业务模块
        var hasAny = ['user', 'characters', 'settings', 'chatList', 'messages',
                      'favorites', 'letters', 'moments', 'shop'].some(function (k) {
            return data[k] !== undefined;
        });
        if (!hasAny) {
            return { ok: false, msg: '备份文件里没有任何数据' };
        }
        return { ok: true };
    }

    /* ============================================================
     * 3. 导出
     * ============================================================ */

    /**
     * 导出为文件下载
     * @param {object} options { filename, silent }
     * @returns {boolean}
     */
    function exportToFile(options) {
        options = options || {};
        if (_busy) {
            Log.warn('[backup] 正在备份中，请稍后');
            return false;
        }
        if (!DATA.All || !DATA.All.exportAll) {
            Log.error('[backup] data.js 未加载');
            return false;
        }

        _busy = true;
        _emit(EVENTS.BACKUP_START || 'backup:start', { type: 'export' });

        try {
            var data = DATA.All.exportAll();
            data.backupType = 'full';
            data.backupId = Str.uid('bk');
            var json = JSON.stringify(data, null, 2);
            var filename = options.filename || _makeFileName('json');
            var ok = _download(filename, json);

            if (ok) {
                _saveLastTime();
                _emit(EVENTS.BACKUP_DONE || 'backup:done', {
                    type: 'export',
                    filename: filename,
                    size: json.length
                });
                Log.log('[backup] 导出成功:', filename);
            } else {
                _emit('backup:fail', { type: 'export', reason: '下载失败' });
            }

            _busy = false;
            return ok;
        } catch (e) {
            Log.error('[backup] 导出异常:', e);
            _emit('backup:fail', { type: 'export', reason: e.message });
            _busy = false;
            return false;
        }
    }

    /**
     * 导出为字符串（不下载，仅返回）
     */
    function exportToString() {
        try {
            var data = DATA.All.exportAll();
            data.backupType = 'full';
            data.backupId = Str.uid('bk');
            return JSON.stringify(data, null, 2);
        } catch (e) {
            Log.error('[backup] 导出字符串失败:', e);
            return '';
        }
    }

    /* ============================================================
     * 4. 导入
     * ============================================================ */

    /**
     * 从文件导入
     * @param {File} file
     * @param {object} options { merge: 是否合并（默认覆盖）, silent }
     * @returns {Promise<boolean>}
     */
    function importFromFile(file, options) {
        options = options || {};
        if (_busy) return Promise.reject(new Error('正在处理中'));

        _busy = true;
        _emit(EVENTS.BACKUP_START || 'backup:start', { type: 'import' });

        return _readFile(file)
            .then(function (data) {
                var check = _validate(data);
                if (!check.ok) {
                    throw new Error(check.msg);
                }

                // 覆盖前先做一次本地快照
                if (options.silent !== true) {
                    createSnapshot('导入前自动快照');
                }

                var ok = DATA.All.importAll(data);
                if (!ok) throw new Error('写入失败');

                _saveLastTime();
                _emit(EVENTS.BACKUP_DONE || 'backup:done', { type: 'import' });
                Log.log('[backup] 导入成功');
                _busy = false;
                return true;
            })
            .catch(function (err) {
                Log.error('[backup] 导入失败:', err);
                _emit('backup:fail', { type: 'import', reason: err.message });
                _busy = false;
                throw err;
            });
    }

    /**
     * 从字符串导入
     */
    function importFromString(jsonStr, options) {
        options = options || {};
        if (_busy) return Promise.reject(new Error('正在处理中'));
        _busy = true;
        _emit(EVENTS.BACKUP_START || 'backup:start', { type: 'import' });

        return new Promise(function (resolve, reject) {
            try {
                var data = JSON.parse(jsonStr);
                var check = _validate(data);
                if (!check.ok) throw new Error(check.msg);

                if (options.silent !== true) {
                    createSnapshot('导入前自动快照');
                }

                var ok = DATA.All.importAll(data);
                if (!ok) throw new Error('写入失败');

                _saveLastTime();
                _emit(EVENTS.BACKUP_DONE || 'backup:done', { type: 'import' });
                _busy = false;
                resolve(true);
            } catch (err) {
                Log.error('[backup] 导入失败:', err);
                _emit('backup:fail', { type: 'import', reason: err.message });
                _busy = false;
                reject(err);
            }
        });
    }

    /**
     * 触发文件选择（打开系统文件框）
     * @param {object} options
     * @returns {Promise<boolean>}
     */
    function pickAndImport(options) {
        options = options || {};
        return new Promise(function (resolve, reject) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';

            input.addEventListener('change', function () {
                var file = input.files && input.files[0];
                document.body.removeChild(input);
                if (!file) {
                    return reject(new Error('未选择文件'));
                }
                importFromFile(file, options).then(resolve).catch(reject);
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    /* ============================================================
     * 5. 本地快照（存 localStorage，不下载文件）
     * ============================================================ */

    /**
     * 列出所有快照
     */
    function listSnapshots() {
        var list = Store.get(BACKUP_KEY) || [];
        return list;
    }

    /**
     * 创建快照
     * @param {string} label 快照名称
     */
    function createSnapshot(label) {
        try {
            var data = DATA.All.exportAll();
            var snapshot = {
                id: _makeSnapshotId(),
                label: label || '手动快照',
                createdAt: _now(),
                size: JSON.stringify(data).length,
                data: data
            };

            var list = listSnapshots();
            list.unshift(snapshot);

            // 超出数量则删除最旧的
            var max = DEFAULT_BACKUP.maxBackups || 10;
            if (list.length > max) {
                list = list.slice(0, max);
            }

            Store.set(BACKUP_KEY, list);
            _saveLastTime();
            Log.log('[backup] 快照已创建:', snapshot.id);

            _emit('backup:snapshot', snapshot);
            return snapshot;
        } catch (e) {
            Log.error('[backup] 创建快照失败:', e);
            return null;
        }
    }

    /**
     * 获取快照
     */
    function getSnapshot(id) {
        return Obj.findById(listSnapshots(), id);
    }

    /**
     * 删除快照
     */
    function removeSnapshot(id) {
        var list = listSnapshots();
        Obj.removeById(list, id);
        Store.set(BACKUP_KEY, list);
        _emit('backup:snapshotRemoved', { id: id });
    }

    /**
     * 清空快照
     */
    function clearSnapshots() {
        Store.set(BACKUP_KEY, []);
        _emit('backup:snapshotCleared', {});
    }

    /**
     * 恢复快照
     * @param {string} id
     */
    function restoreSnapshot(id) {
        var snap = getSnapshot(id);
        if (!snap) {
            Log.warn('[backup] 找不到快照:', id);
            return false;
        }
        try {
            // 恢复前先给当前状态做一个快照
            createSnapshot('恢复前自动快照');
            var ok = DATA.All.importAll(snap.data);
            if (ok) {
                _emit('backup:restored', { id: id });
                Log.log('[backup] 快照已恢复:', id);
            }
            return ok;
        } catch (e) {
            Log.error('[backup] 恢复快照失败:', e);
            return false;
        }
    }

    /* ============================================================
     * 6. 自动备份
     * ============================================================ */

    /**
     * 启动自动备份
     * @param {number} intervalMs 间隔毫秒，0 或不传则读配置
     */
    function startAutoBackup(intervalMs) {
        stopAutoBackup();

        var interval = intervalMs || DEFAULT_BACKUP.autoInterval || 0;
        if (!interval || interval < 60000) {
            Log.warn('[backup] 自动备份间隔过短，已忽略');
            return false;
        }

        _timer = setInterval(function () {
            createSnapshot('自动快照 ' + Time.formatTime());
        }, interval);

        Log.log('[backup] 自动备份已启动，间隔 ' + (interval / 1000) + ' 秒');
        _emit('backup:autoStart', { interval: interval });
        return true;
    }

    /**
     * 停止自动备份
     */
    function stopAutoBackup() {
        if (_timer) {
            clearInterval(_timer);
            _timer = null;
            _emit('backup:autoStop', {});
            Log.log('[backup] 自动备份已停止');
        }
    }

    /**
     * 是否在自动备份中
     */
    function isAutoBackupRunning() {
        return _timer !== null;
    }

    /* ============================================================
     * 7. 上次备份时间
     * ============================================================ */
    function _saveLastTime() {
        Store.set(LAST_TIME_KEY, _now());
    }

    function getLastBackupTime() {
        return Store.get(LAST_TIME_KEY) || 0;
    }

    function getLastBackupTimeText() {
        var ts = getLastBackupTime();
        if (!ts) return '从未备份';
        return Time.fromNow(ts);
    }

    /* ============================================================
     * 8. 统计
     * ============================================================ */

    /**
     * 备份占用大小
     */
    function getBackupSize() {
        var list = listSnapshots();
        var sum = 0;
        list.forEach(function (s) {
            sum += s.size || 0;
        });
        return sum;
    }

    /**
     * 备份统计
     */
    function getStats() {
        var list = listSnapshots();
        return {
            count: list.length,
            size: getBackupSize(),
            lastTime: getLastBackupTime(),
            lastTimeText: getLastBackupTimeText(),
            autoRunning: isAutoBackupRunning()
        };
    }

    /* ============================================================
     * 9. 清理
     * ============================================================ */

    /**
     * 按时间清理，保留最近 n 个
     */
    function keepLatest(n) {
        var list = listSnapshots();
        var num = Number(n) || 5;
        if (list.length > num) {
            list = list.slice(0, num);
            Store.set(BACKUP_KEY, list);
        }
        return list.length;
    }

    /* ============================================================
     * 10. 初始化
     * ============================================================ */
    function init() {
        Log.log('[backup] 初始化完成');
        // 启动自动备份（如果配置里开了）
        if (DEFAULT_BACKUP.autoInterval > 0) {
            startAutoBackup(DEFAULT_BACKUP.autoInterval);
        }
    }

    /* ============================================================
     * 11. 对外导出
     * ============================================================ */
    var APP_BACKUP = {
        init: init,

        // 导出
        exportToFile: exportToFile,
        exportToString: exportToString,

        // 导入
        importFromFile: importFromFile,
        importFromString: importFromString,
        pickAndImport: pickAndImport,

        // 快照
        listSnapshots: listSnapshots,
        createSnapshot: createSnapshot,
        getSnapshot: getSnapshot,
        removeSnapshot: removeSnapshot,
        clearSnapshots: clearSnapshots,
        restoreSnapshot: restoreSnapshot,

        // 自动备份
        startAutoBackup: startAutoBackup,
        stopAutoBackup: stopAutoBackup,
        isAutoBackupRunning: isAutoBackupRunning,

        // 时间
        getLastBackupTime: getLastBackupTime,
        getLastBackupTimeText: getLastBackupTimeText,

        // 统计
        getStats: getStats,

        // 清理
        keepLatest: keepLatest
    };

    // 挂到全局
    global.APP_BACKUP = APP_BACKUP;

    // 如果之后用 ES Module，取消下面这行注释
    // export default APP_BACKUP;

})(typeof window !== 'undefined' ? window : this);