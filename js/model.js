/* InkNote - document model (classic script, no build step) */
(function (global) {
  'use strict';

  var PAGE_W = 794;   // A4 @ 96dpi -> logical page units
  var PAGE_H = 1123;
  /* Named sheets. "long" grows taller as you write; "screen" is resized to the
     window, so one page fills the display. */
  var PAPERS = {
    a4: [794, 1123],
    a4l: [1123, 794],
    a3: [1191, 1684],
    a3l: [1684, 1191],
    a2: [1684, 2384],
    a2l: [2384, 1684],
    a0: [2384, 3370],
    a0l: [3370, 2384],
    long: [794, 2246]
  };
  var MIN_PAGE = 320;
  var MAX_PAGE = 14000;
  var BG_STYLES = ['blank', 'lined', 'grid', 'dotted'];
  var LINE_STYLES = ['solid', 'dashed', 'dotted', 'dashdot'];
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
      paper: 'a3l',
      pageW: 1684,
      pageH: 1191,
      grow: false,
      pages: [createPage('lined')],
      active: 0
    };
  }

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function clampPage(v, fallback) {
    var n = num(v, fallback);
    return Math.round(Math.min(MAX_PAGE, Math.max(MIN_PAGE, n)));
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
      style: LINE_STYLES.indexOf(raw.style) >= 0 ? raw.style : 'solid',
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
    /* Older notes saved before paper sizes existed had no pageW: give them
       the roomy A3 landscape sheet instead of the old A4 one. */
    var paper = raw.paper === 'screen' || PAPERS[raw.paper]
      ? raw.paper
      : (typeof raw.pageW === 'number' ? 'a4' : 'a3l');
    var dims = PAPERS[paper] || [PAGE_W, PAGE_H];
    return {
      app: 'inknote',
      version: 1,
      title: title,
      paper: paper,
      pageW: clampPage(raw.pageW, dims[0]),
      pageH: clampPage(raw.pageH, dims[1]),
      grow: raw.grow === true || paper === 'long',
      pages: pages,
      active: active
    };
  }

  function cloneDoc(doc) {
    return JSON.parse(JSON.stringify(doc));
  }

  global.InkModel = {
    PAGE_W: PAGE_W,
    PAGE_H: PAGE_H,
    PAPERS: PAPERS,
    MIN_PAGE: MIN_PAGE,
    MAX_PAGE: MAX_PAGE,
    BG_STYLES: BG_STYLES,
    uid: uid,
    createPage: createPage,
    createDoc: createDoc,
    normalizeDoc: normalizeDoc,
    cloneDoc: cloneDoc
  };
})(window);
