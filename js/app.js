/* InkNote - app controller: tools, pages, history, autosave, exports */
(function () {
  'use strict';

  var M = window.InkModel;
  var S = window.InkStorage;
  var R = window.InkRender;
  var X = window.InkExport;

  var $ = function (sel) { return document.querySelector(sel); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  var el = {
    base: $('#baseCanvas'),
    live: $('#liveCanvas'),
    wrap: $('#pageWrap'),
    stage: $('#stage'),
    title: $('#docTitle'),
    zoomLabel: $('#zoomLabel'),
    undo: $('#btnUndo'),
    redo: $('#btnRedo'),
    prev: $('#prevPage'),
    next: $('#nextPage'),
    add: $('#addPage'),
    dup: $('#dupPage'),
    del: $('#delPage'),
    clear: $('#clearPage'),
    png: $('#btnPng'),
    pdf: $('#btnPdf'),
    menu: $('#btnMenu'),
    menuPop: $('#menuPop'),
    file: $('#fileInput'),
    exportJson: $('#btnExportJson'),
    importJson: $('#btnImportJson'),
    newDoc: $('#btnNewDoc'),
    slider: $('#sizeSlider'),
    sizeLabel: $('#sizeLabel'),
    zoomIn: $('#zoomIn'),
    zoomOut: $('#zoomOut'),
    zoomFit: $('#zoomFit'),
    color: $('#colorInput'),
    btnPages: $('#btnPages'),
    btnGrid: $('#btnGrid'),
    pageChip: $('#pageChip'),
    titleCount: $('#titleCount'),
    pagesPop: $('#pagesPop'),
    pagesGrid: $('#pagesGrid'),
    pAdd: $('#pAdd'),
    pDup: $('#pDup'),
    pDel: $('#pDel'),
    btnSettings: $('#btnSettings'),
    setPop: $('#setPop'),
    btnLine: $('#btnLine'),
    linePop: $('#linePop'),
    lineIcon: $('#lineIconPath'),
    lineOpts: Array.prototype.slice.call(document.querySelectorAll('[data-line]')),
    smoothBtns: Array.prototype.slice.call(document.querySelectorAll('[data-smooth]')),
    sensSlider: $('#sensSlider'),
    sensLabel: $('#sensLabel'),
    band: $('#marginBand'),
    pips: Array.prototype.slice.call(document.querySelectorAll('[data-pip]')),
    tools: Array.prototype.slice.call(document.querySelectorAll('[data-tool]')),
    swatches: Array.prototype.slice.call(document.querySelectorAll('[data-color]')),
    bgs: Array.prototype.slice.call(document.querySelectorAll('[data-bg]'))
  };

  var baseCtx = el.base.getContext('2d');
  var liveCtx = el.live.getContext('2d');

  var SIZE_RANGE = {
    pen: [1, 24, 0.5],
    line: [1, 24, 0.5],
    highlighter: [8, 48, 1],
    eraser: [6, 64, 1]
  };
  /* Three quick sizes per tool, shown as the small dots in the top bar. */
  var QUICK = {
    pen: [1.6, 3.2, 6.4],
    line: [1.6, 3.2, 6.4],
    highlighter: [12, 20, 32],
    eraser: [10, 18, 30]
  };
  /* Dash pattern previews for the toolbar icon. */
  var LINE_DASH = { solid: 'none', dashed: '4 3', dotted: '0.6 2.8', dashdot: '4.4 2.2 0.6 2.2' };
  var LINE_ORDER = ['solid', 'dashed', 'dotted', 'dashdot'];

  var doc = bootDoc();
  var tool = 'pen';
  var color = '#111111';
  var sizes = { pen: 3.2, line: 3.2, highlighter: 20, eraser: 18 };
  var lineStyle = 'solid';
  /* Handwriting quality: 0 = raw, 1 = light, 3 = strong stabiliser. */
  var smoothLevel = 1;
  var pressureSens = 0.65;
  var SMOOTH_ALPHA = { 0: 1, 1: 0.55, 2: 0.4, 3: 0.28 };
  var smoothPt = null;
  var lastRaw = null;
  var zoom = 1;
  var fitMode = true;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var current = null;
  var straightFrom = null;
  var erasing = false;
  var eraseSnapshot = null;
  var eraseRemoved = false;
  var eraserPos = null;
  var redrawQueued = false;

  var undoStack = [];
  var redoStack = [];
  var saveTimer = null;

  /* ---------------------------------------------------------------- doc io */

  function bootDoc() {
    var saved = S.load();
    if (saved) {
      try { return M.normalizeDoc(saved); } catch (e) { /* fall through */ }
    }
    return M.createDoc();
  }

  function activePage() {
    return doc.pages[clamp(doc.active, 0, doc.pages.length - 1)];
  }

  function markDirty() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { S.save(doc); }, 300);
  }

  var PREFS_KEY = 'inknote:pen:v1';

  function loadPrefs() {
    try {
      var raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (raw) {
        if (typeof raw.smooth === 'number') smoothLevel = clamp(Math.round(raw.smooth), 0, 3);
        if (typeof raw.sens === 'number') pressureSens = clamp(raw.sens, 0, 1);
      }
    } catch (e) { /* ignore */ }
    R.setPressureSensitivity(pressureSens);
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ smooth: smoothLevel, sens: pressureSens }));
    } catch (e) { /* ignore */ }
  }

  function snapshot() {
    return JSON.stringify(doc);
  }

  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack.length = 0;
  }

  function restore(serialized) {
    doc = M.normalizeDoc(JSON.parse(serialized));
    renderAll();
    markDirty();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }

  /* ------------------------------------------------------------- rendering */

  /* Backing scale, capped so a wide fit-to-width zoom cannot exhaust canvas memory. */
  function pageScale() {
    var raw = dpr * zoom;
    var cap = Math.sqrt(12e6 / (M.PAGE_W * M.PAGE_H));
    return Math.min(raw, cap);
  }

  function applyTransform(ctx) {
    var s = pageScale();
    ctx.setTransform(s, 0, 0, s, 0, 0);
  }

  function layout() {
    var s = pageScale();
    var bw = Math.round(M.PAGE_W * s);
    var bh = Math.round(M.PAGE_H * s);
    var cssW = (M.PAGE_W * zoom) + 'px';
    var cssH = (M.PAGE_H * zoom) + 'px';
    [el.base, el.live].forEach(function (canvas) {
      canvas.width = bw;
      canvas.height = bh;
      canvas.style.width = cssW;
      canvas.style.height = cssH;
    });
    el.wrap.style.width = cssW;
    el.wrap.style.height = cssH;
  }

  function renderBase() {
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    baseCtx.clearRect(0, 0, el.base.width, el.base.height);
    applyTransform(baseCtx);
    var page = activePage();
    R.drawBackground(baseCtx, page.bg, M.PAGE_W, M.PAGE_H, 1 / zoom);
    for (var i = 0; i < page.strokes.length; i++) {
      R.renderStroke(baseCtx, page.strokes[i]);
    }
  }

  function clearLive() {
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.clearRect(0, 0, el.live.width, el.live.height);
    applyTransform(liveCtx);
  }

  function renderLive() {
    clearLive();
    if (current) R.renderStroke(liveCtx, current);
    if (eraserPos && tool === 'eraser') {
      R.drawEraserRing(liveCtx, eraserPos.x, eraserPos.y, sizes.eraser / 2);
    }
  }

  function renderAll() {
    layout();
    renderBase();
    clearLive();
    updateUI();
  }

  function queueRedraw() {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(function () {
      redrawQueued = false;
      renderBase();
    });
  }

  /* ----------------------------------------------------------------- input */

  function pagePoint(e) {
    var rect = el.base.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom
    };
  }

  function pressureOf(e) {
    if (e.pointerType !== 'pen') return 0.5;
    var p = typeof e.pressure === 'number' ? e.pressure : 0.5;
    return clamp(p, 0.08, 1);
  }

  function addPoint(pt, pressure) {
    var pts = current.points;
    if (!pts.length) {
      pts.push({ x: pt.x, y: pt.y, p: pressure });
      return;
    }
    var last = pts[pts.length - 1];
    var p = last.p * 0.55 + pressure * 0.45;
    var dx = pt.x - last.x;
    var dy = pt.y - last.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.35) return;
    var step = Math.max(1.5, current.size * 0.2);
    var n = clamp(Math.round(dist / step), 1, 48);
    for (var i = 1; i <= n; i++) {
      var t = i / n;
      pts.push({ x: last.x + dx * t, y: last.y + dy * t, p: last.p + (p - last.p) * t });
    }
  }

  function eraseAt(pt) {
    var page = activePage();
    var radius = sizes.eraser / 2;
    var removed = false;
    for (var i = page.strokes.length - 1; i >= 0; i--) {
      if (R.strokeHitsPoint(page.strokes[i], pt.x, pt.y, radius)) {
        page.strokes.splice(i, 1);
        removed = true;
      }
    }
    if (removed) eraseRemoved = true;
    return removed;
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    /* Palm rejection: fingers scroll the paper, only pen/mouse draws. */
    if (e.pointerType === 'touch') return;
    e.preventDefault();
    try { el.base.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var pt = pagePoint(e);

    if (tool === 'eraser') {
      erasing = true;
      eraseSnapshot = snapshot();
      eraseRemoved = false;
      eraserPos = pt;
      if (eraseAt(pt)) queueRedraw();
      renderLive();
      return;
    }

    pushHistory();
    current = {
      id: M.uid(),
      tool: tool === 'highlighter' ? 'highlighter' : 'pen',
      color: color,
      size: sizes[tool],
      pressureMode: e.pointerType === 'pen' ? 'real' : 'none',
      style: tool === 'highlighter' ? 'solid' : lineStyle,
      points: []
    };
    smoothPt = { x: pt.x, y: pt.y };
    lastRaw = { x: pt.x, y: pt.y, p: pressureOf(e) };
    /* Straight-line mode: the pen tool behaves like a ruler for this stroke
       (also available by holding Shift with the normal pen). */
    straightFrom = (tool === 'line' || e.shiftKey) ? { x: pt.x, y: pt.y } : null;
    if (straightFrom) {
      current.points = [{ x: pt.x, y: pt.y, p: pressureOf(e) }];
    } else {
      addPoint(pt, pressureOf(e));
    }
    renderLive();
  }

  var scrollTimer = null;
  var scrollDir = 0;
  var scrollSpeed = 0;

  function scrollTick() {
    if (!scrollDir) return;
    var before = el.stage.scrollTop;
    el.stage.scrollTop = before + scrollDir * scrollSpeed;
    if (el.stage.scrollTop === before) stopAutoScroll();
  }

  function stopAutoScroll() {
    if (scrollTimer) clearInterval(scrollTimer);
    scrollTimer = null;
    scrollDir = 0;
    el.band.classList.remove('is-active');
  }

  /* Scrble-style margin autoscroll: once the nib enters the purple band the
     page keeps moving, even when the stylus itself stops moving. */
  function autoScroll(e) {
    var stageRect = el.stage.getBoundingClientRect();
    var bandTop = el.band.getBoundingClientRect().top;
    var dir = 0;
    var speed = 0;
    if (e.clientY >= bandTop) {
      if (el.stage.scrollTop + el.stage.clientHeight < el.stage.scrollHeight - 1) {
        dir = 1;
        speed = clamp(4 + (e.clientY - bandTop) * 0.5, 4, 18);
      }
    } else if (e.clientY < stageRect.top + 44 && el.stage.scrollTop > 0) {
      dir = -1;
      speed = 8;
    }
    if (!dir) { stopAutoScroll(); return; }
    scrollDir = dir;
    scrollSpeed = speed;
    el.band.classList.toggle('is-active', dir > 0);
    if (!scrollTimer) scrollTimer = setInterval(scrollTick, 16);
  }

  function onPointerMove(e) {
    if (current) {
      autoScroll(e);
      var pt = pagePoint(e);
      var pr = pressureOf(e);
      if (straightFrom) {
        current.points = [
          { x: straightFrom.x, y: straightFrom.y, p: current.points[0].p },
          { x: pt.x, y: pt.y, p: pr }
        ];
      } else {
        lastRaw = { x: pt.x, y: pt.y, p: pr };
        var alpha = SMOOTH_ALPHA[smoothLevel] || 1;
        if (alpha < 1) {
          smoothPt.x += (pt.x - smoothPt.x) * alpha;
          smoothPt.y += (pt.y - smoothPt.y) * alpha;
          addPoint(smoothPt, pr);
        } else {
          smoothPt = { x: pt.x, y: pt.y };
          addPoint(pt, pr);
        }
      }
      renderLive();
      return;
    }
    if (erasing) {
      autoScroll(e);
      eraserPos = pagePoint(e);
      if (eraseAt(eraserPos)) queueRedraw();
      renderLive();
      return;
    }
    if (tool === 'eraser') {
      eraserPos = pagePoint(e);
      renderLive();
    }
  }

  function onPointerUp() {
    stopAutoScroll();
    var straight = !!straightFrom;
    if (current) {
      /* Land on the real last sample so smoothing never shortens a letter. */
      if (!straight && lastRaw) addPoint(lastRaw, lastRaw.p);
      var finished = current;
      current = null;
      if (finished.points.length) {
        activePage().strokes.push(finished);
        applyTransform(baseCtx);
        R.renderStroke(baseCtx, finished);
        markDirty();
      }
      clearLive();
      updateUI();
      straightFrom = null;
      smoothPt = null;
      lastRaw = null;
      return;
    }
    if (erasing) {
      erasing = false;
      if (eraseRemoved) {
        undoStack.push(eraseSnapshot);
        if (undoStack.length > 60) undoStack.shift();
        redoStack.length = 0;
        markDirty();
      }
      eraseSnapshot = null;
      renderBase();
      clearLive();
      updateUI();
    }
    straightFrom = null;
    smoothPt = null;
    lastRaw = null;
  }

  function onPointerCancel() {
    stopAutoScroll();
    straightFrom = null;
    smoothPt = null;
    lastRaw = null;
    if (current) {
      current = null;
      clearLive();
      if (undoStack.length) undoStack.pop();
      updateUI();
      return;
    }
    if (erasing) {
      erasing = false;
      eraseSnapshot = null;
      renderBase();
      clearLive();
    }
  }

  /* -------------------------------------------------------------------- ui */

  function updateUI() {
    el.pageChip.textContent = String(doc.active + 1);
    el.titleCount.textContent = '(' + doc.pages.length + ')';
    el.prev.disabled = doc.active <= 0;
    el.next.disabled = doc.active >= doc.pages.length - 1;
    el.del.disabled = doc.pages.length <= 1;
    el.pDel.disabled = doc.pages.length <= 1;
    el.undo.disabled = undoStack.length === 0;
    el.redo.disabled = redoStack.length === 0;
    if (document.activeElement !== el.title) el.title.value = doc.title;

    el.tools.forEach(function (btn) {
      var on = btn.dataset.tool === tool;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    el.swatches.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.color.toLowerCase() === color.toLowerCase());
    });
    el.bgs.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.bg === activePage().bg);
    });
    el.lineOpts.forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.line === lineStyle);
    });
    if (el.lineIcon) el.lineIcon.setAttribute('stroke-dasharray', LINE_DASH[lineStyle] || 'none');
    el.smoothBtns.forEach(function (btn) {
      btn.classList.toggle('is-active', String(smoothLevel) === btn.dataset.smooth);
    });
    if (el.sensSlider && document.activeElement !== el.sensSlider) {
      el.sensSlider.value = String(Math.round(pressureSens * 100));
    }
    if (el.sensLabel) el.sensLabel.textContent = String(Math.round(pressureSens * 100));
    syncPips();
  }

  /* The active quick-size dot: nearest of the three preset widths for this tool. */
  function syncPips() {
    var list = QUICK[tool] || QUICK.pen;
    var best = 0;
    var bestDiff = Infinity;
    for (var i = 0; i < list.length; i++) {
      var diff = Math.abs(list[i] - sizes[tool]);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    el.pips.forEach(function (pip, i) {
      pip.classList.toggle('is-active', i === best);
      pip.style.setProperty('--pip', color);
      var span = pip.querySelector('span');
      if (span) span.style.background = color;
    });
  }

  function updateZoomLabel() {
    el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
  }

  function syncSlider() {
    var range = SIZE_RANGE[tool];
    el.slider.min = String(range[0]);
    el.slider.max = String(range[1]);
    el.slider.step = String(range[2]);
    el.slider.value = String(sizes[tool]);
    el.sizeLabel.textContent = String(Math.round(sizes[tool]));
    el.slider.disabled = false;
    syncPips();
  }

  function setTool(next) {
    if (tool === next) return;
    tool = next;
    eraserPos = null;
    el.base.style.cursor = tool === 'eraser' ? 'none' : 'crosshair';
    syncSlider();
    renderLive();
    updateUI();
  }

  function setColor(next) {
    color = next;
    el.color.value = next;
    updateUI();
  }

  function changeSize(delta) {
    var range = SIZE_RANGE[tool];
    sizes[tool] = clamp(sizes[tool] + delta * range[2] * 2, range[0], range[1]);
    syncSlider();
  }

  function setZoom(next) {
    zoom = clamp(next, 0.35, 3);
    fitMode = false;
    layout();
    renderBase();
    renderLive();
    updateZoomLabel();
  }

  /* Paper fills the window like a notepad: fit the width, scroll vertically. */
  function fitStage() {
    var availW = el.stage.clientWidth;
    if (availW <= 0) return;
    zoom = clamp(availW / M.PAGE_W, 0.35, 3);
    layout();
    renderBase();
    renderLive();
    updateZoomLabel();
    fitMode = true;
  }

  function gotoPage(index) {
    var next = clamp(index, 0, doc.pages.length - 1);
    if (next === doc.active) return;
    doc.active = next;
    eraserPos = null;
    el.stage.scrollTop = 0;
    renderAll();
    markDirty();
  }

  function addPage() {
    pushHistory();
    doc.pages.splice(doc.active + 1, 0, M.createPage(activePage().bg));
    doc.active += 1;
    renderAll();
    markDirty();
  }

  function duplicatePage() {
    pushHistory();
    var copy = JSON.parse(JSON.stringify(activePage()));
    copy.id = M.uid();
    doc.pages.splice(doc.active + 1, 0, copy);
    doc.active += 1;
    renderAll();
    markDirty();
  }

  function deletePage() {
    if (doc.pages.length <= 1) return;
    pushHistory();
    doc.pages.splice(doc.active, 1);
    doc.active = clamp(doc.active, 0, doc.pages.length - 1);
    renderAll();
    markDirty();
  }

  /* Page overview: a live-rendered thumbnail for every page, like the page
     strip in Scrble Ink. */
  function renderPageGrid() {
    el.pagesGrid.innerHTML = '';
    doc.pages.forEach(function (page, index) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-thumb' + (index === doc.active ? ' is-active' : '');
      btn.title = 'Trang ' + (index + 1);

      var canvas = document.createElement('canvas');
      var w = 82;
      var h = Math.round(w * M.PAGE_H / M.PAGE_W);
      canvas.width = w * 2;
      canvas.height = h * 2;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      var ctx = canvas.getContext('2d');
      var s = canvas.width / M.PAGE_W;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      R.drawBackground(ctx, page.bg, M.PAGE_W, M.PAGE_H, 0.9 / s);
      for (var i = 0; i < page.strokes.length; i++) R.renderStroke(ctx, page.strokes[i]);

      var label = document.createElement('span');
      label.textContent = String(index + 1);

      btn.appendChild(canvas);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        gotoPage(index);
        renderPageGrid();
      });
      el.pagesGrid.appendChild(btn);
    });
  }

  function clearPage() {
    if (!activePage().strokes.length) return;
    pushHistory();
    activePage().strokes = [];
    renderBase();
    updateUI();
    markDirty();
  }

  function setBackground(bg) {
    if (activePage().bg === bg) return;
    pushHistory();
    activePage().bg = bg;
    renderBase();
    updateUI();
    markDirty();
  }

  function safeName() {
    return (doc.title || 'inknote')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'inknote';
  }

  function exportPng() {
    X.exportPNG(activePage(), safeName() + '-trang-' + (doc.active + 1)).catch(function (err) {
      alert(err.message);
    });
  }

  function exportPdf() {
    if (el.pdf.dataset.busy === '1') return;
    el.pdf.dataset.busy = '1';
    var label = el.pdf.textContent;
    X.exportPDF(doc, safeName(), function (i, total) {
      el.pdf.textContent = i + '/' + total;
    }).then(function () {
      el.pdf.textContent = label;
      el.pdf.dataset.busy = '0';
    }).catch(function (err) {
      el.pdf.textContent = label;
      el.pdf.dataset.busy = '0';
      alert('Xuất PDF thất bại: ' + err.message);
    });
  }

  var POPOVERS = [];

  function registerPop(pop, trigger) {
    POPOVERS.push({ pop: pop, trigger: trigger });
  }

  function closePopovers(except) {
    POPOVERS.forEach(function (entry) {
      if (entry.pop === except) return;
      entry.pop.hidden = true;
      if (entry.trigger) entry.trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function togglePop(pop, trigger) {
    var willOpen = pop.hidden;
    closePopovers(pop);
    pop.hidden = !willOpen;
    if (trigger) trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  function newDocument() {
    if (!confirm('Tạo ghi chú mới? Nội dung hiện tại sẽ được thay thế (vẫn có thể hoàn tác).')) return;
    pushHistory();
    doc = M.createDoc();
    renderAll();
    markDirty();
  }

  /* ----------------------------------------------------------------- wiring */

  el.base.addEventListener('pointerdown', onPointerDown);
  el.base.addEventListener('pointermove', onPointerMove);
  el.base.addEventListener('pointerup', onPointerUp);
  el.base.addEventListener('pointercancel', onPointerCancel);
  el.base.addEventListener('pointerleave', function () {
    if (erasing || current) return;
    eraserPos = null;
    renderLive();
  });

  el.tools.forEach(function (btn) {
    btn.addEventListener('click', function () { setTool(btn.dataset.tool); });
  });
  el.swatches.forEach(function (btn) {
    btn.addEventListener('click', function () { setColor(btn.dataset.color); });
  });
  el.color.addEventListener('input', function () { setColor(el.color.value); });
  el.slider.addEventListener('input', function () {
    sizes[tool] = parseFloat(el.slider.value) || SIZE_RANGE[tool][0];
    el.sizeLabel.textContent = String(Math.round(sizes[tool]));
    syncPips();
  });
  el.pips.forEach(function (pip, index) {
    pip.addEventListener('click', function () {
      var list = QUICK[tool] || QUICK.pen;
      sizes[tool] = list[index];
      syncSlider();
    });
  });

  el.bgs.forEach(function (btn) {
    btn.addEventListener('click', function () { setBackground(btn.dataset.bg); });
  });

  el.undo.addEventListener('click', undo);
  el.redo.addEventListener('click', redo);
  el.prev.addEventListener('click', function () { gotoPage(doc.active - 1); });
  el.next.addEventListener('click', function () { gotoPage(doc.active + 1); });
  el.add.addEventListener('click', addPage);
  el.dup.addEventListener('click', duplicatePage);
  el.del.addEventListener('click', deletePage);
  el.clear.addEventListener('click', clearPage);

  el.png.addEventListener('click', exportPng);
  el.pdf.addEventListener('click', exportPdf);

  el.zoomIn.addEventListener('click', function () { setZoom(zoom + 0.1); });
  el.zoomOut.addEventListener('click', function () { setZoom(zoom - 0.1); });
  el.zoomFit.addEventListener('click', fitStage);

  el.title.addEventListener('input', function () {
    doc.title = el.title.value.slice(0, 120);
    markDirty();
  });

  registerPop(el.menuPop, el.menu);
  registerPop(el.pagesPop, el.btnPages);
  registerPop(el.pagesPop, el.btnGrid);
  registerPop(el.setPop, el.btnSettings);
  registerPop(el.linePop, el.btnLine);

  el.menu.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePop(el.menuPop, el.menu);
  });
  el.btnLine.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePop(el.linePop, el.btnLine);
  });
  el.lineOpts.forEach(function (btn) {
    btn.addEventListener('click', function () {
      lineStyle = btn.dataset.line;
      updateUI();
      closePopovers();
    });
  });

  el.smoothBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      smoothLevel = parseInt(btn.dataset.smooth, 10) || 0;
      updateUI();
      savePrefs();
    });
  });

  el.sensSlider.addEventListener('input', function () {
    pressureSens = clamp(parseFloat(el.sensSlider.value) / 100, 0, 1);
    R.setPressureSensitivity(pressureSens);
    el.sensLabel.textContent = String(Math.round(pressureSens * 100));
    renderBase();
    renderLive();
    savePrefs();
  });

  function togglePages() {
    var willOpen = el.pagesPop.hidden;
    closePopovers(el.pagesPop);
    if (willOpen) renderPageGrid();
    el.pagesPop.hidden = !willOpen;
    el.btnPages.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  }

  el.btnPages.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePages();
  });
  el.btnGrid.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePages();
  });
  el.btnSettings.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePop(el.setPop, el.btnSettings);
  });

  function pageAction(action) {
    action();
    if (!el.pagesPop.hidden) renderPageGrid();
  }
  el.pAdd.addEventListener('click', function () { pageAction(addPage); });
  el.pDup.addEventListener('click', function () { pageAction(duplicatePage); });
  el.pDel.addEventListener('click', function () { pageAction(deletePage); });
  document.addEventListener('click', function (e) {
    var inside = POPOVERS.some(function (entry) {
      return entry.pop.contains(e.target) || (entry.trigger && entry.trigger.contains(e.target));
    });
    if (!inside) closePopovers();
  });
  el.exportJson.addEventListener('click', function () {
    X.exportJSON(doc, safeName());
    closePopovers();
  });
  el.importJson.addEventListener('click', function () {
    el.file.click();
  });
  el.newDoc.addEventListener('click', function () {
    closePopovers();
    newDocument();
  });
  el.file.addEventListener('change', function () {
    var file = el.file.files && el.file.files[0];
    el.file.value = '';
    if (!file) return;
    X.readFileAsText(file).then(function (text) {
      var parsed = M.normalizeDoc(JSON.parse(text));
      pushHistory();
      doc = parsed;
      renderAll();
      markDirty();
      closePopovers();
    }).catch(function (err) {
      alert('Không nhập được file: ' + err.message);
    });
  });

  document.addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    var mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (e.key === 'Escape') {
      closePopovers();
      return;
    }
    if (mod || e.altKey) return;

    switch (e.key) {
      case 'p': case 'P': setTool('pen'); break;
      case 's': case 'S': setTool('line'); break;
      case 'h': case 'H': setTool('highlighter'); break;
      case 'e': case 'E': setTool('eraser'); break;
      case 'l': case 'L': {
        lineStyle = LINE_ORDER[(LINE_ORDER.indexOf(lineStyle) + 1) % LINE_ORDER.length];
        updateUI();
        break;
      }
      case '[': changeSize(-1); break;
      case ']': changeSize(1); break;
      case '+': case '=': setZoom(zoom + 0.1); break;
      case '-': case '_': setZoom(zoom - 0.1); break;
      case 'ArrowLeft': gotoPage(doc.active - 1); break;
      case 'ArrowRight': gotoPage(doc.active + 1); break;
      case 'PageUp': gotoPage(doc.active - 1); break;
      case 'PageDown': gotoPage(doc.active + 1); break;
      case 'Delete': case 'Backspace': e.preventDefault(); clearPage(); break;
      default: break;
    }
  });

  window.addEventListener('resize', function () {
    if (fitMode) fitStage();
  });

  /* The Review pane can open with a zero-sized stage, so refit as soon as it gains size. */
  if (window.ResizeObserver) {
    var lastStage = { w: 0, h: 0 };
    new ResizeObserver(function () {
      var w = el.stage.clientWidth;
      var h = el.stage.clientHeight;
      if (w === lastStage.w && h === lastStage.h) return;
      lastStage.w = w;
      lastStage.h = h;
      if (fitMode && w > 0 && h > 0) fitStage();
    }).observe(el.stage);
  }

  window.addEventListener('beforeunload', function () {
    S.save(doc);
  });

  /* ------------------------------------------------------------------- boot */

  el.base.style.cursor = 'crosshair';
  el.title.value = doc.title;
  loadPrefs();
  syncSlider();
  setColor(color);
  layout();
  renderBase();
  updateZoomLabel();
  updateUI();
  /* rAF and ResizeObserver both pause on a hidden tab, so retry until the stage has width. */
  var fitTries = 0;
  function bootFit() {
    if (el.stage.clientWidth > 0) {
      if (fitMode) fitStage();
      return;
    }
    if (fitTries++ < 60) setTimeout(bootFit, 60);
  }
  setTimeout(bootFit, 0);
})();
