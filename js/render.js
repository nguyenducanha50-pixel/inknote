/* InkNote - canvas rendering: paper backgrounds + pressure-aware strokes */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function drawBackground(ctx, bg, w, h, thin) {
    var unit = thin || 1;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    var y, x;
    if (bg === 'lined') {
      var gap = 32;
      ctx.strokeStyle = '#d7e5f8';
      ctx.lineWidth = unit;
      ctx.beginPath();
      for (y = gap; y < h; y += gap) {
        ctx.moveTo(0, y + unit / 2);
        ctx.lineTo(w, y + unit / 2);
      }
      ctx.stroke();
    } else if (bg === 'grid') {
      var cell = 24;
      ctx.strokeStyle = '#e6eef9';
      ctx.lineWidth = unit;
      ctx.beginPath();
      for (x = cell; x < w; x += cell) {
        ctx.moveTo(x + unit / 2, 0);
        ctx.lineTo(x + unit / 2, h);
      }
      for (y = cell; y < h; y += cell) {
        ctx.moveTo(0, y + unit / 2);
        ctx.lineTo(w, y + unit / 2);
      }
      ctx.stroke();
    } else if (bg === 'dotted') {
      var step = 24;
      ctx.fillStyle = '#cfdcee';
      for (y = step; y < h; y += step) {
        for (x = step; x < w; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.7, unit * 0.9), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function widthFor(stroke, pressure) {
    if (stroke.pressureMode !== 'real') return stroke.size;
    return stroke.size * (0.35 + 0.65 * pressure);
  }

  function roundCap(ctx, x, y, r) {
    if (r <= 0.05) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /* One closed outline per stroke: a single fill cannot cancel itself at the
     joints the way separate overlapping quads do (that caused the dashed look). */
  function renderPen(ctx, stroke) {
    var pts = stroke.points;
    var i;
    var n = pts.length;
    if (n === 1) {
      roundCap(ctx, pts[0].x, pts[0].y, widthFor(stroke, pts[0].p) / 2);
      return;
    }

    var left = new Array(n);
    var right = new Array(n);
    for (i = 0; i < n; i++) {
      var prev = i > 0 ? pts[i - 1] : pts[i];
      var next = i < n - 1 ? pts[i + 1] : pts[i];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.0001) {
        dx = 1;
        dy = 0;
        len = 1;
      }
      var nx = -dy / len;
      var ny = dx / len;
      var w = widthFor(stroke, pts[i].p) / 2;
      left[i] = { x: pts[i].x + nx * w, y: pts[i].y + ny * w };
      right[i] = { x: pts[i].x - nx * w, y: pts[i].y - ny * w };
    }

    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
    for (i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();

    roundCap(ctx, pts[0].x, pts[0].y, widthFor(stroke, pts[0].p) / 2);
    roundCap(ctx, pts[n - 1].x, pts[n - 1].y, widthFor(stroke, pts[n - 1].p) / 2);
  }

  function renderHighlighter(ctx, stroke) {
    var pts = stroke.points;
    ctx.globalAlpha = 0.32;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = stroke.size;
    if (pts.length === 1) {
      roundCap(ctx, pts[0].x, pts[0].y, stroke.size / 2);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
    } else {
      for (var i = 1; i < pts.length - 1; i++) {
        var mx = (pts[i].x + pts[i + 1].x) / 2;
        var my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      var last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
    ctx.stroke();
  }

  function renderStroke(ctx, stroke) {
    if (!stroke || !stroke.points || !stroke.points.length) return;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    if (stroke.tool === 'highlighter') {
      renderHighlighter(ctx, stroke);
    } else {
      renderPen(ctx, stroke);
    }
    ctx.restore();
  }

  function segDistSq(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    var t = 0;
    if (lenSq > 0) {
      t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    var ex = px - (x1 + t * dx);
    var ey = py - (y1 + t * dy);
    return ex * ex + ey * ey;
  }

  function strokeHitsPoint(stroke, px, py, radius) {
    var pts = stroke.points;
    if (!pts || !pts.length) return false;
    var reach = radius + stroke.size / 2;
    var reachSq = reach * reach;
    if (pts.length === 1) {
      return segDistSq(px, py, pts[0].x, pts[0].y, pts[0].x, pts[0].y) <= reachSq;
    }
    for (var i = 1; i < pts.length; i++) {
      if (segDistSq(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= reachSq) return true;
    }
    return false;
  }

  function drawEraserRing(ctx, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(30,40,60,0.75)';
    ctx.stroke();
    ctx.restore();
  }

  global.InkRender = {
    drawBackground: drawBackground,
    renderStroke: renderStroke,
    strokeHitsPoint: strokeHitsPoint,
    drawEraserRing: drawEraserRing,
    widthFor: widthFor
  };
})(window);
