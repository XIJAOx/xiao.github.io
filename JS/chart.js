/**
 * chart.js
 * 纯 Canvas 图表库（无依赖）
 * 依赖：无
 * 被依赖：features.js / listeners.js
 *
 * 支持：
 * 1. 柱状图 Bar
 * 2. 折线图 Line
 * 3. 环形图 Doughnut
 * 4. 迷你火花图 Sparkline
 *
 * 挂到 window.APP_CHART 上
 */

(function (global) {
    'use strict';

    /* ============================================================
     * 工具
     * ============================================================ */
    function _pad(n) { return n < 10 ? '0' + n : '' + n; }

    function _getDevicePixelRatio() {
        return window.devicePixelRatio || 1;
    }

    /**
     * 初始化 canvas，处理高清屏模糊
     */
    function _setupCanvas(canvas) {
        if (!canvas) return null;
        var dpr = _getDevicePixelRatio();
        var rect = canvas.getBoundingClientRect();
        var w = rect.width || canvas.clientWidth || 300;
        var h = rect.height || canvas.clientHeight || 150;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
        ctx.textBaseline = 'middle';

        return { ctx: ctx, width: w, height: h };
    }

    /**
     * 圆角矩形路径
     */
    function _roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /* ============================================================
     * 1. 柱状图 Bar
     * ============================================================ */
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} options
     *   - data: [{ label, value }]
     *   - color: 单色 或 function(item, i) 返回颜色
     *   - highlight: 高亮色
     *   - highlightIndex: 高亮第几个
     *   - showValue: 是否显示数值
     *   - showGrid: 是否显示网格
     *   - padding: { top, right, bottom, left }
     *   - ySteps: Y轴分几段
     */
    function bar(canvas, options) {
        options = options || {};
        var data = options.data || [];
        if (data.length === 0) return;

        var setup = _setupCanvas(canvas);
        if (!setup) return;
        var ctx = setup.ctx;
        var W = setup.width;
        var H = setup.height;

        var padding = options.padding || { top: 20, right: 12, bottom: 28, left: 32 };
        var chartW = W - padding.left - padding.right;
        var chartH = H - padding.top - padding.bottom;

        var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
        // 向上取整到一个好数字
        var ySteps = options.ySteps || 4;
        var stepVal = Math.ceil(maxVal / ySteps);
        var topVal = stepVal * ySteps;

        var barCount = data.length;
        var gap = 6;
        var barW = Math.min(40, (chartW - gap * (barCount - 1)) / barCount);
        var totalBarW = barW * barCount + gap * (barCount - 1);
        var startX = padding.left + (chartW - totalBarW) / 2;

        var highlightIndex = options.highlightIndex;
        var defaultColor = options.color || '#000000';
        var highlightColor = options.highlight || '#ff4466';

        // Y 轴网格
        if (options.showGrid !== false) {
            ctx.strokeStyle = '#f0f0f0';
            ctx.lineWidth = 1;
            for (var i = 0; i <= ySteps; i++) {
                var y = padding.top + chartH - (i / ySteps) * chartH;
                ctx.beginPath();
                ctx.moveTo(padding.left, y + 0.5);
                ctx.lineTo(W - padding.right, y + 0.5);
                ctx.stroke();

                // Y 轴标签
                ctx.fillStyle = '#999';
                ctx.textAlign = 'right';
                ctx.fillText(String(i * stepVal), padding.left - 6, y);
            }
        }

        // 画柱子
        ctx.textAlign = 'center';
        data.forEach(function (d, i) {
            var val = d.value;
            var h = topVal > 0 ? (val / topVal) * chartH : 0;
            if (h < 2 && val > 0) h = 2;

            var x = startX + i * (barW + gap);
            var y = padding.top + chartH - h;

            var color = defaultColor;
            if (typeof options.color === 'function') {
                color = options.color(d, i);
            }
            if (highlightIndex === i) color = highlightColor;

            // 渐变
            var grad = ctx.createLinearGradient(0, y, 0, padding.top + chartH);
            grad.addColorStop(0, color);
            grad.addColorStop(1, _fadeColor(color, 0.35));

            ctx.fillStyle = grad;
            _roundRect(ctx, x, y, barW, h, 4);
            ctx.fill();

            // 数值
            if (options.showValue && val > 0) {
                ctx.fillStyle = '#666';
                ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
                ctx.fillText(String(val), x + barW / 2, y - 8);
                ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
            }

            // X 轴标签
            ctx.fillStyle = highlightIndex === i ? '#333' : '#999';
            ctx.fillText(String(d.label), x + barW / 2, padding.top + chartH + 14);
        });
    }

    /* ============================================================
     * 2. 折线图 Line
     * ============================================================ */
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} options
     *   - data: [{ label, value }]
     *   - color: 线条颜色
     *   - fill: 是否填充渐变
     *   - showPoint: 是否显示点
     *   - showValue: 是否显示数值
     *   - smooth: 是否平滑曲线
     */
    function line(canvas, options) {
        options = options || {};
        var data = options.data || [];
        if (data.length === 0) return;

        var setup = _setupCanvas(canvas);
        if (!setup) return;
        var ctx = setup.ctx;
        var W = setup.width;
        var H = setup.height;

        var padding = options.padding || { top: 20, right: 12, bottom: 28, left: 32 };
        var chartW = W - padding.left - padding.right;
        var chartH = H - padding.top - padding.bottom;

        var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
        var minVal = options.minValue !== undefined ? options.minValue : 0;
        var ySteps = options.ySteps || 4;
        var stepVal = Math.ceil((maxVal - minVal) / ySteps) || 1;
        var topVal = minVal + stepVal * ySteps;

        var color = options.color || '#4299e1';

        // Y 轴网格
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (var i = 0; i <= ySteps; i++) {
            var y = padding.top + chartH - (i / ySteps) * chartH;
            ctx.beginPath();
            ctx.moveTo(padding.left, y + 0.5);
            ctx.lineTo(W - padding.right, y + 0.5);
            ctx.stroke();

            ctx.fillStyle = '#999';
            ctx.textAlign = 'right';
            ctx.fillText(String(minVal + i * stepVal), padding.left - 6, y);
        }

        // 计算点坐标
        var points = data.map(function (d, i) {
            var x = data.length === 1
                ? padding.left + chartW / 2
                : padding.left + (i / (data.length - 1)) * chartW;
            var y = padding.top + chartH - ((d.value - minVal) / (topVal - minVal)) * chartH;
            return { x: x, y: y, value: d.value, label: d.label };
        });

        // 线条路径
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        if (options.smooth && points.length > 2) {
            _drawSmoothPath(ctx, points);
        } else {
            points.forEach(function (p, i) {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
        }
        ctx.stroke();

        // 填充
        if (options.fill !== false) {
            var grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
            grad.addColorStop(0, _fadeColor(color, 0.25));
            grad.addColorStop(1, _fadeColor(color, 0));

            ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
            ctx.lineTo(points[0].x, padding.top + chartH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // 点
        if (options.showPoint !== false) {
            points.forEach(function (p) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }

        // X 轴标签
        ctx.textAlign = 'center';
        ctx.fillStyle = '#999';
        ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
        points.forEach(function (p, i) {
            // 太多就隔一个显示
            if (points.length > 8 && i % 2 !== 0 && i !== points.length - 1) return;
            ctx.fillText(String(p.label), p.x, padding.top + chartH + 14);
        });

        // 数值
        if (options.showValue) {
            ctx.fillStyle = '#666';
            ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
            points.forEach(function (p) {
                if (p.value > 0) {
                    ctx.fillText(String(p.value), p.x, p.y - 10);
                }
            });
        }
    }

    function _drawSmoothPath(ctx, points) {
        ctx.moveTo(points[0].x, points[0].y);
        for (var i = 0; i < points.length - 1; i++) {
            var p0 = points[i];
            var p1 = points[i + 1];
            var cpX = (p0.x + p1.x) / 2;
            ctx.quadraticCurveTo(cpX, p0.y, cpX, (p0.y + p1.y) / 2);
            ctx.quadraticCurveTo(cpX, p1.y, p1.x, p1.y);
        }
    }

    /* ============================================================
     * 3. 环形图 Doughnut
     * ============================================================ */
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {object} options
     *   - data: [{ label, value, color }]
     *   - size: 半径（默认自动）
     *   - thickness: 环宽
     *   - centerText: 中心文字
     *   - showLegend: 是否显示图例
     */
    function doughnut(canvas, options) {
        options = options || {};
        var data = options.data || [];
        if (data.length === 0) return;

        var setup = _setupCanvas(canvas);
        if (!setup) return;
        var ctx = setup.ctx;
        var W = setup.width;
        var H = setup.height;

        var showLegend = options.showLegend !== false;
        var legendW = showLegend ? 100 : 0;

        var cx = (W - legendW) / 2;
        var cy = H / 2;
        var outerR = Math.min(W - legendW, H) / 2 - 10;
        var thickness = options.thickness || Math.max(16, outerR * 0.35);
        var innerR = outerR - thickness;

        var total = data.reduce(function (s, d) { return s + d.value; }, 0);
        if (total === 0) total = 1;

        var startAngle = -Math.PI / 2;

        data.forEach(function (d) {
            var ratio = d.value / total;
            var endAngle = startAngle + ratio * Math.PI * 2;

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, endAngle);
            ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = d.color || _defaultColor(d.index || 0);
            ctx.fill();

            startAngle = endAngle;
        });

        // 中心文字
        if (options.centerText) {
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.font = 'bold 22px -apple-system, "PingFang SC", sans-serif';
            ctx.fillText(options.centerText, cx, cy - 6);

            if (options.centerSubText) {
                ctx.fillStyle = '#999';
                ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
                ctx.fillText(options.centerSubText, cx, cy + 14);
            }
        }

        // 图例
        if (showLegend) {
            var lx = W - legendW + 10;
            var ly = 20;
            var lineH = 22;

            ctx.textAlign = 'left';
            data.forEach(function (d) {
                ctx.fillStyle = d.color || _defaultColor(d.index || 0);
                _roundRect(ctx, lx, ly + lineH * 0.5 - 5, 10, 10, 3);
                ctx.fill();

                ctx.fillStyle = '#666';
                ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
                var label = d.label + ' ' + Math.round((d.value / total) * 100) + '%';
                ctx.fillText(label, lx + 16, ly + lineH * 0.5);

                ly += lineH;
            });
        }
    }

    /* ============================================================
     * 4. 火花图 Sparkline（迷你趋势线）
     * ============================================================ */
    function sparkline(canvas, options) {
        options = options || {};
        var data = options.data || [];
        if (data.length === 0) return;

        var setup = _setupCanvas(canvas);
        if (!setup) return;
        var ctx = setup.ctx;
        var W = setup.width;
        var H = setup.height;

        var pad = 4;
        var chartW = W - pad * 2;
        var chartH = H - pad * 2;

        var values = data.map(function (d) { return typeof d === 'number' ? d : d.value; });
        var maxVal = Math.max.apply(null, values.concat([1]));
        var minVal = Math.min.apply(null, values.concat([0]));

        var color = options.color || '#4299e1';

        var points = values.map(function (v, i) {
            var x = values.length === 1
                ? pad + chartW / 2
                : pad + (i / (values.length - 1)) * chartW;
            var y = pad + chartH - ((v - minVal) / (maxVal - minVal || 1)) * chartH;
            return { x: x, y: y };
        });

        // 填充
        var grad = ctx.createLinearGradient(0, pad, 0, pad + chartH);
        grad.addColorStop(0, _fadeColor(color, 0.3));
        grad.addColorStop(1, _fadeColor(color, 0));

        ctx.beginPath();
        points.forEach(function (p, i) {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.lineTo(points[points.length - 1].x, pad + chartH);
        ctx.lineTo(points[0].x, pad + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // 线
        ctx.beginPath();
        points.forEach(function (p, i) {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    /* ============================================================
     * 5. 辅助
     * ============================================================ */
    var COLORS = ['#4299e1', '#ff6b81', '#48a868', '#c9a885', '#b077ee', '#ffaa33', '#dd4444', '#88ccdd'];

    function _defaultColor(i) {
        return COLORS[i % COLORS.length];
    }

    function _fadeColor(hex, alpha) {
        // hex → rgba
        if (!hex) return 'rgba(0,0,0,0)';
        if (hex.indexOf('#') === 0) {
            var h = hex.slice(1);
            if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
            var r = parseInt(h.slice(0, 2), 16);
            var g = parseInt(h.slice(2, 4), 16);
            var b = parseInt(h.slice(4, 6), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }
        if (hex.indexOf('rgb') === 0) {
            return hex.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')');
        }
        return 'rgba(0,0,0,' + alpha + ')';
    }

    /* ============================================================
     * 6. 自动渲染：根据 canvas 上的 data-* 属性识别
     * ============================================================ */

    /**
     * 给 canvas 加 data-chart="bar" data-chart-json='{"data":[...]}'
     * 然后调用 APP_CHART.autoRender() 就能自动画
     */
    function autoRender(root) {
        root = root || document;
        var list = root.querySelectorAll('canvas[data-chart]');
        list.forEach(function (canvas) {
            var type = canvas.getAttribute('data-chart');
            var json = canvas.getAttribute('data-chart-json');
            var options = {};
            try {
                if (json) options = JSON.parse(json);
            } catch (e) {}

            if (type === 'bar') bar(canvas, options);
            else if (type === 'line') line(canvas, options);
            else if (type === 'doughnut') doughnut(canvas, options);
            else if (type === 'sparkline') sparkline(canvas, options);
        });
    }

    /* ============================================================
     * 7. 便捷：从数组直接画
     * ============================================================ */

    /**
     * 从 [1,2,3,4,5] 画柱状图
     */
    function barFromArray(canvas, values, labels, options) {
        options = options || {};
        var data = values.map(function (v, i) {
            return { value: v, label: labels ? labels[i] : String(i) };
        });
        options.data = data;
        return bar(canvas, options);
    }

    function lineFromArray(canvas, values, labels, options) {
        options = options || {};
        var data = values.map(function (v, i) {
            return { value: v, label: labels ? labels[i] : String(i) };
        });
        options.data = data;
        return line(canvas, options);
    }

    /* ============================================================
     * 8. 对外导出
     * ============================================================ */
    var APP_CHART = {
        bar: bar,
        line: line,
        doughnut: doughnut,
        sparkline: sparkline,
        autoRender: autoRender,
        barFromArray: barFromArray,
        lineFromArray: lineFromArray,
        COLORS: COLORS
    };

    global.APP_CHART = APP_CHART;

})(typeof window !== 'undefined' ? window : this);