/**
 * image-handler.js
 * 图片处理工具：选择 / 读取 / 压缩 / 裁剪 / 转 base64
 * 依赖：无
 * 被依赖：features.js / listeners.js / theme-editor.js
 *
 * 挂到 window.APP_IMG 上
 */

(function (global) {
    'use strict';

    /* ============================================================
     * 1. 选择文件
     * ============================================================ */

    /**
     * 弹出文件选择框
     * @param {object} options
     *   - accept: 'image/*' | 'image/png' | 等
     *   - capture: true 时调用摄像头（移动端）
     *   - multiple: 多选
     * @returns {Promise<File|File[]>}
     */
    function pick(options) {
        options = options || {};
        return new Promise(function (resolve, reject) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = options.accept || 'image/*';
            if (options.capture) input.setAttribute('capture', 'environment');
            if (options.multiple) input.multiple = true;
            input.style.display = 'none';

            input.addEventListener('change', function () {
                var files = input.files;
                document.body.removeChild(input);

                if (!files || files.length === 0) {
                    reject(new Error('未选择文件'));
                    return;
                }
                if (options.multiple) {
                    resolve(Array.prototype.slice.call(files));
                } else {
                    resolve(files[0]);
                }
            });

            document.body.appendChild(input);
            input.click();
        });
    }

    /* ============================================================
     * 2. 读文件 → DataURL / Image
     * ============================================================ */

    /**
     * 文件 → DataURL
     */
    function toDataURL(file) {
        return new Promise(function (resolve, reject) {
            if (!file) return reject(new Error('没有文件'));
            var reader = new FileReader();
            reader.onload = function (e) { resolve(e.target.result); };
            reader.onerror = function () { reject(new Error('读取失败')); };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 文件 → Image 对象
     */
    function toImage(file) {
        return toDataURL(file).then(function (url) {
            return new Promise(function (resolve, reject) {
                var img = new Image();
                img.onload = function () { resolve({ img: img, url: url }); };
                img.onerror = function () { reject(new Error('图片加载失败')); };
                img.src = url;
            });
        });
    }

    /* ============================================================
     * 3. 压缩
     * ============================================================ */

    /**
     * 压缩图片
     * @param {File} file
     * @param {object} options
     *   - maxWidth: 最大宽（默认 1200）
     *   - maxHeight: 最大高（默认 1200）
     *   - quality: 0~1（默认 0.8）
     *   - format: 'image/jpeg' | 'image/png' | 'image/webp'（默认 jpeg）
     * @returns {Promise<{dataUrl, width, height, size}>}
     */
    function compress(file, options) {
        options = options || {};
        var maxW = options.maxWidth || 1200;
        var maxH = options.maxHeight || 1200;
        var quality = options.quality !== undefined ? options.quality : 0.8;
        var format = options.format || 'image/jpeg';

        return toImage(file).then(function (result) {
            var img = result.img;
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;

            // 计算缩放
            var scale = 1;
            if (w > maxW || h > maxH) {
                scale = Math.min(maxW / w, maxH / h);
            }
            var tw = Math.round(w * scale);
            var th = Math.round(h * scale);

            var canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
            var ctx = canvas.getContext('2d');

            // 透明背景填白（jpeg 不支持透明）
            if (format === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, tw, th);
            }

            ctx.drawImage(img, 0, 0, tw, th);

            var dataUrl = canvas.toDataURL(format, quality);
            return {
                dataUrl: dataUrl,
                width: tw,
                height: th,
                size: Math.round(dataUrl.length * 0.75)  // 粗略估算字节数
            };
        });
    }

    /**
     * 压缩 + 直接转成 base64 存用
     */
    function compressToBase64(file, options) {
        return compress(file, options).then(function (r) { return r.dataUrl; });
    }

    /* ============================================================
     * 4. 裁剪（正方形 / 圆形 / 自定义）
     * ============================================================ */

    /**
     * 裁剪成正方形
     * @param {File} file
     * @param {object} options
     *   - size: 输出尺寸（默认 300）
     *   - quality: 0~1
     *   - circle: 是否圆形（PNG 时透明）
     * @returns {Promise<string>} DataURL
     */
    function toSquare(file, options) {
        options = options || {};
        var size = options.size || 300;
        var quality = options.quality !== undefined ? options.quality : 0.85;
        var circle = !!options.circle;

        return toImage(file).then(function (result) {
            var img = result.img;
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;

            // 取短边
            var side = Math.min(w, h);
            var sx = (w - side) / 2;
            var sy = (h - side) / 2;

            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');

            if (circle) {
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, size, size);
            }

            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

            var format = circle ? 'image/png' : 'image/jpeg';
            return canvas.toDataURL(format, quality);
        });
    }

    /* ============================================================
     * 5. 获取信息
     * ============================================================ */

    /**
     * 读取图片信息（宽高、大小）
     */
    function getInfo(file) {
        return toImage(file).then(function (result) {
            var img = result.img;
            return {
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                size: file.size,
                type: file.type,
                name: file.name
            };
        });
    }

    /* ============================================================
     * 6. 验证
     * ============================================================ */

    /**
     * 验证是不是图片
     */
    function isImage(file) {
        if (!file) return false;
        return /^image\//.test(file.type || '');
    }

    /**
     * 验证大小（字节）
     */
    function checkSize(file, maxBytes) {
        if (!file) return false;
        return file.size <= (maxBytes || 5 * 1024 * 1024);
    }

    /* ============================================================
     * 7. 一步到位：选择 → 压缩 → 返回 base64
     * ============================================================ */

    /**
     * 弹窗选图 → 压缩 → 返回 base64
     * @param {object} options 见 compress
     * @returns {Promise<string>} DataURL
     */
    function pickAndCompress(options) {
        return pick({ accept: 'image/*' }).then(function (file) {
            return compressToBase64(file, options);
        });
    }

    /**
     * 弹窗选图 → 裁剪正方形 → 返回 base64
     */
    function pickAndSquare(options) {
        return pick({ accept: 'image/*' }).then(function (file) {
            return toSquare(file, options);
        });
    }

    /* ============================================================
     * 8. 便捷：绑定到一个按钮上
     * ============================================================ */

    /**
     * 把某个元素变成"点击上传图片"的按钮
     * @param {HTMLElement} el
     * @param {Function} onDone (dataUrl) => void
     * @param {object} options
     */
    function bindUpload(el, onDone, options) {
        options = options || {};
        if (!el || typeof onDone !== 'function') return;

        el.addEventListener('click', function () {
            var p = options.square ? pickAndSquare(options) : pickAndCompress(options);
            p.then(function (dataUrl) {
                onDone(dataUrl);
            }).catch(function (err) {
                if (err && err.message === '未选择文件') return;
                console.warn('[image] 上传失败:', err);
            });
        });
    }

    /* ============================================================
     * 9. 与 HTML 弹窗配合
     * ============================================================ */

    /**
     * 处理许愿弹窗的"上传图片"（商品图标）
     * 上传后把 base64 放进 .wish-emoji-input
     */
    function handleWishIconUpload() {
        pickAndCompress({ maxWidth: 200, maxHeight: 200, quality: 0.8 }).then(function (dataUrl) {
            var input = document.querySelector('.wish-emoji-input');
            if (input) {
                input.value = dataUrl;
                input.setAttribute('data-is-image', '1');
                // 简单预览
                _showPreview(input, dataUrl);
            }
        }).catch(function () {});
    }

    /**
     * 处理聊天背景上传
     */
    function handleChatBgUpload() {
        pickAndCompress({ maxWidth: 1200, maxHeight: 1200, quality: 0.85 }).then(function (dataUrl) {
            var TE = global.APP_THEME_EDITOR;
            if (TE && TE.setChatBg) {
                TE.setChatBg({ chatBgImage: dataUrl });
            }
            var ENV = global.APP_ENVELOPE;
            if (ENV && ENV.tip) ENV.tip('背景已更新');
        }).catch(function () {});
    }

    /**
     * 处理朋友圈背景上传
     */
    function handleMomentsBgUpload() {
        pickAndCompress({ maxWidth: 1200, maxHeight: 600, quality: 0.85 }).then(function (dataUrl) {
            var DATA = global.APP_DATA;
            if (DATA && DATA.Moments) {
                DATA.Moments.setBg(dataUrl);
            }
            var FEATURES = global.APP_FEATURES;
            if (FEATURES && FEATURES.Moments) {
                FEATURES.Moments.renderBg();
            }
            var ENV = global.APP_ENVELOPE;
            if (ENV && ENV.tip) ENV.tip('已更新');
        }).catch(function () {});
    }

    /**
     * 处理头像上传
     */
    function handleAvatarUpload() {
        pickAndSquare({ size: 300, quality: 0.9, circle: false }).then(function (dataUrl) {
            var DATA = global.APP_DATA;
            if (DATA && DATA.User) {
                DATA.User.patch({ avatar: dataUrl });
                DATA.User.patch && DATA.User.patch({ avatarBig: dataUrl });
                DATA.User.patch && DATA.User.patch({ avatarSmall: dataUrl });
            }
            // 更新所有头像
            var avatars = document.querySelectorAll('.avatar-me, .avatar-me-big, .avatar-me-small');
            avatars.forEach(function (a) {
                a.style.backgroundImage = 'url(' + dataUrl + ')';
                a.style.backgroundSize = 'cover';
                a.style.backgroundPosition = 'center';
            });
            var ENV = global.APP_ENVELOPE;
            if (ENV && ENV.tip) ENV.tip('头像已更新');
        }).catch(function () {});
    }

    /* ============================================================
     * 10. 内部：输入框旁边的预览
     * ============================================================ */
    function _showPreview(input, dataUrl) {
        var wrap = input.parentNode;
        if (!wrap) return;

        // 移除旧预览
        var old = wrap.querySelector('.img-preview-thumb');
        if (old) old.remove();

        // 如果输入框旁边已经有预览区就不重复
        var thumb = document.createElement('img');
        thumb.className = 'img-preview-thumb';
        thumb.src = dataUrl;
        thumb.style.cssText = [
            'width:40px',
            'height:40px',
            'border-radius:8px',
            'object-fit:cover',
            'margin-left:8px',
            'vertical-align:middle',
            'border:1px solid #eee'
        ].join(';');

        // 把它放到输入框后面
        if (input.nextSibling) {
            wrap.insertBefore(thumb, input.nextSibling);
        } else {
            wrap.appendChild(thumb);
        }
    }

    /* ============================================================
     * 11. 对外导出
     * ============================================================ */
    var APP_IMG = {
        // 选择
        pick: pick,
        pickAndCompress: pickAndCompress,
        pickAndSquare: pickAndSquare,

        // 读取
        toDataURL: toDataURL,
        toImage: toImage,

        // 处理
        compress: compress,
        compressToBase64: compressToBase64,
        toSquare: toSquare,

        // 信息
        getInfo: getInfo,
        isImage: isImage,
        checkSize: checkSize,

        // 便捷
        bindUpload: bindUpload,

        // 与具体 HTML 场景绑定
        handleWishIconUpload: handleWishIconUpload,
        handleChatBgUpload: handleChatBgUpload,
        handleMomentsBgUpload: handleMomentsBgUpload,
        handleAvatarUpload: handleAvatarUpload
    };

    global.APP_IMG = APP_IMG;

})(typeof window !== 'undefined' ? window : this);