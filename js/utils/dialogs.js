/* ==========================================================================
   梦角 · Dream Corner
   弹窗组件  js/utils/dialogs.js
   --------------------------------------------------------------------------
   替代原生 window.prompt / confirm / alert，样式与 App 一致
   用法：
     const name = await mjPrompt('姓名', { placeholder: '请输入' });
     const ok   = await mjConfirm('确定删除？');
     await mjAlert('已完成');
     const text = await mjTextarea('写点什么', { placeholder: '...' });
   ========================================================================== */

const STYLE_ID = 'mj-dialogs-style';
let _styleInjected = false;

function injectStyles() {
    if (_styleInjected || document.getElementById(STYLE_ID)) return;
    _styleInjected = true;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .mj-dialog-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            animation: mj-fade-in 0.2s ease both;
        }
        @keyframes mj-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes mj-dialog-in {
            from { opacity: 0; transform: translateY(14px) scale(0.96); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mj-dialog {
            width: 100%;
            max-width: 340px;
            padding: 22px 20px 18px;
            border-radius: 22px;
            background: #fff;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.24);
            animation: mj-dialog-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
            box-sizing: border-box;
        }
        .mj-dialog-title {
            font-size: 17px;
            font-weight: 700;
            color: #1a1a1a;
            text-align: center;
            margin-bottom: 8px;
        }
        .mj-dialog-message {
            font-size: 14px;
            line-height: 1.6;
            color: #666;
            text-align: center;
            word-break: break-word;
            white-space: pre-wrap;
        }
        .mj-dialog-input {
            display: block;
            width: 100%;
            margin-top: 14px;
            padding: 0 14px;
            height: 44px;
            border: 1px solid #e0e0e8;
            border-radius: 12px;
            font-size: 15px;
            background: #fafafc;
            outline: none;
            box-sizing: border-box;
            font-family: inherit;
        }
        .mj-dialog-input:focus {
            border-color: #ff6b8a;
            background: #fff;
            box-shadow: 0 0 0 3px #fff0f3;
        }
        .mj-dialog-textarea {
            display: block;
            width: 100%;
            min-height: 100px;
            margin-top: 14px;
            padding: 12px 14px;
            border: 1px solid #e0e0e8;
            border-radius: 12px;
            font-size: 15px;
            line-height: 1.6;
            background: #fafafc;
            outline: none;
            box-sizing: border-box;
            resize: none;
            font-family: inherit;
        }
        .mj-dialog-textarea:focus {
            border-color: #ff6b8a;
            background: #fff;
            box-shadow: 0 0 0 3px #fff0f3;
        }
        .mj-dialog-actions {
            display: flex;
            gap: 10px;
            margin-top: 18px;
        }
        .mj-dialog-btn {
            flex: 1;
            height: 44px;
            border: 0;
            border-radius: 999px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            transition: transform 0.14s ease, opacity 0.14s ease;
            font-family: inherit;
        }
        .mj-dialog-btn:active {
            transform: scale(0.96);
        }
        .mj-dialog-btn.cancel {
            color: #666;
            background: #f0f0f5;
        }
        .mj-dialog-btn.confirm {
            color: #fff;
            background: linear-gradient(135deg, #ff6b8a, #e8556f);
            box-shadow: 0 6px 18px rgba(255, 107, 138, 0.28);
        }
        .mj-dialog-btn.danger {
            background: linear-gradient(135deg, #ff7b7b, #e03c3c);
            box-shadow: 0 6px 18px rgba(224, 60, 60, 0.28);
        }
    `;
    document.head.appendChild(style);
}

function openDialog(options) {
    return new Promise((resolve) => {
        injectStyles();

        const {
            title,
            message,
            input,
            textarea,
            placeholder,
            defaultValue,
            confirmText,
            cancelText,
            danger,
            showCancel = true
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'mj-dialog-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'mj-dialog';

        if (title) {
            const t = document.createElement('div');
            t.className = 'mj-dialog-title';
            t.textContent = title;
            dialog.appendChild(t);
        }

        if (message) {
            const m = document.createElement('div');
            m.className = 'mj-dialog-message';
            m.textContent = message;
            dialog.appendChild(m);
        }

        let inputEl = null;
        let textareaEl = null;

        if (textarea) {
            textareaEl = document.createElement('textarea');
            textareaEl.className = 'mj-dialog-textarea';
            if (placeholder) textareaEl.placeholder = placeholder;
            if (defaultValue) textareaEl.value = defaultValue;
            dialog.appendChild(textareaEl);
        } else if (input) {
            inputEl = document.createElement('input');
            inputEl.className = 'mj-dialog-input';
            inputEl.type = 'text';
            if (placeholder) inputEl.placeholder = placeholder;
            if (defaultValue) inputEl.value = defaultValue;
            dialog.appendChild(inputEl);
        }

        const actions = document.createElement('div');
        actions.className = 'mj-dialog-actions';

        let _closed = false;
        const close = (result) => {
            if (_closed) return;
            _closed = true;
            overlay.style.animation = 'mj-fade-in 0.18s ease reverse both';
            setTimeout(() => overlay.remove(), 180);
            resolve(result);
        };

        if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'mj-dialog-btn cancel';
            cancelBtn.textContent = cancelText || '取消';
            cancelBtn.addEventListener('click', () => close(null));
            actions.appendChild(cancelBtn);
        }

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'mj-dialog-btn ' + (danger ? 'danger' : 'confirm');
        confirmBtn.textContent = confirmText || '确定';
        confirmBtn.addEventListener('click', () => {
            if (input) close(inputEl.value);
            else if (textarea) close(textareaEl.value);
            else close(true);
        });
        actions.appendChild(confirmBtn);

        dialog.appendChild(actions);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 点遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(null);
        });

        // 键盘
        const onKey = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKey);
                close(null);
            } else if (e.key === 'Enter' && input && !e.shiftKey) {
                e.preventDefault();
                document.removeEventListener('keydown', onKey);
                close(inputEl.value);
            }
        };
        document.addEventListener('keydown', onKey);

        setTimeout(() => {
            if (inputEl) inputEl.focus();
            else if (textareaEl) textareaEl.focus();
        }, 220);
    });
}

/** 单行输入 */
export function mjPrompt(message, options = {}) {
    return openDialog({
        title: options.title || message,
        message: options.title ? message : '',
        input: true,
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消'
    });
}

/** 多行输入 */
export function mjTextarea(message, options = {}) {
    return openDialog({
        title: options.title || message,
        message: options.title ? message : '',
        textarea: true,
        placeholder: options.placeholder || '',
        defaultValue: options.defaultValue || '',
        confirmText: options.confirmText || '保存',
        cancelText: options.cancelText || '取消'
    });
}

/** 确认框，返回 true / false */
export function mjConfirm(message, options = {}) {
    return openDialog({
        title: options.title || '确认',
        message,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        danger: options.danger !== false
    }).then((r) => r === true);
}

/** 提示框 */
export function mjAlert(message, options = {}) {
    return openDialog({
        title: options.title || '提示',
        message,
        confirmText: options.confirmText || '知道了',
        showCancel: false
    });
}

export default { mjPrompt, mjTextarea, mjConfirm, mjAlert };