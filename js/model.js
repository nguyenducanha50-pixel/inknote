/* InkNote - document model (classic script, no build step) */
(function (global) {
  'use strict';

  var PAGE_W = 794;   // A4 @ 96dpi -> logical page units
  var PAGE_H = 1123;
  var BG_STYLES = ['blank', 'lined', 'grid', 'dotted'];
  var MAX_TITLE = 120;

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 's' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function createPage(bg) {
    return { id: uid(), bg: BG_STYLES.indexOf(bg) >= 0 ? bg : 'lined', strokes: [] };
  }

  function createDoc() {
    return {
      app: 'inknote',
      version: 1,
      title: 'Ghi chú mới',
      pages: [createPage('lined')],
      active: 0
    };
  }

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function isStroke(raw) {
    return !!raw &&
      (raw.tool === 'pen' || raw.tool === 'highlighter') &&
      typeof raw.color === 'string' &&
      num(raw.size, 0) > 0 &&
      Array.isArray(raw.points) && raw.points.length > 0;
  }

  function normalizeStroke(raw) {
    var points = [];
    for (var i = 0; i < raw.points.length; i++) {
      var p = raw.points[i];
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      points.push({ x: p.x, y: p.y, p: Math.min(1, Math.max(0, num(p.p, 0.5))) });
    }
    if (!points.length) return null;
    return {
      id: typeof raw.id === 'string' ? raw.id : uid(),
      tool: raw.tool,
      color: raw.color.slice(0, 32),
      size: Math.min(200, Math.max(0.5, num(raw.size, 2))),
      pressureMode: raw.pressureMode === 'real' ? 'real' : 'none',
      points: points
    };
  }

  /* Accepts saved/imported data and returns a safe document, or throws. */
  function normalizeDoc(raw) {
    if (!raw || !Array.isArray(raw.pages) || raw.pages.length === 0) {
      throw new Error('Dữ liệu không hợp lệ: thiếu danh sách trang.');
    }
    var pages = raw.pages.slice(0, 200).map(function (rawPage) {
      var strokes = [];
      if (rawPage && Array.isArray(rawPage.strokes)) {
        for (var i = 0; i < rawPage.strokes.length && strokes.length < 20000; i++) {
          if (!isStroke(rawPage.strokes[i])) continue;
          var s = normalizeStroke(rawPage.strokes[i]);
          if (s) strokes.push(s);
        }
      }
      return {
        id: rawPage && typeof rawPage.id === 'string' ? rawPage.id : uid(),
        bg: rawPage && BG_STYLES.indexOf(rawPage.bg) >= 0 ? rawPage.bg : 'blank',
        strokes: strokes
      };
    });
    var active = Math.min(Math.max(0, Math.round(num(raw.active, 0))), pages.length - 1);
    var title = typeof raw.title === 'string' ? raw.title.slice(0, MAX_TITLE) : 'Ghi chú';
    return { app: 'inknote', version: 1, title: title, pages: pages, active: active };
  }

  function cloneDoc(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  global.InkModel = {
    PAGE_W: PAGE_W,
    PAGE_H: PAGE_H,
    BG_STYLES: BG_STYLES,
    uid: uid,
    createPage: createPage,
    createDoc: createDoc,
    normalizeDoc: normalizeDoc,
    cloneDoc: cloneDoc
  };
})(window);
