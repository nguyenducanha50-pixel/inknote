/* InkNote - exports (PNG / PDF / JSON) with no external dependencies */
(function (global) {
  'use strict';

  var M = global.InkModel;
  var R = global.InkRender;

  var A4_W = 595.28;
  var A4_H = 841.89;

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function renderPageToCanvas(page, scale) {
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(M.PAGE_W * scale);
    canvas.height = Math.round(M.PAGE_H * scale);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    R.drawBackground(ctx, page.bg, M.PAGE_W, M.PAGE_H, 0.5);
    for (var i = 0; i < page.strokes.length; i++) {
      R.renderStroke(ctx, page.strokes[i]);
    }
    return canvas;
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
    return out;
  }

  function fmt(n) {
    var v = Math.round(n * 100) / 100;
    return String(v);
  }

  /* Minimal PDF writer: one JPEG (DCTDecode) image XObject per page. */
  function buildPdf(images) {
    var enc = new TextEncoder();
    var parts = [];
    var length = 0;

    function push(data) {
      var bytes = typeof data === 'string' ? enc.encode(data) : data;
      parts.push(bytes);
      length += bytes.length;
    }

    var objects = [];
    var kids = [];
    var i;

    for (i = 0; i < images.length; i++) {
      kids.push((3 + i * 3) + ' 0 R');
    }

    objects.push({ body: '<< /Type /Catalog /Pages 2 0 R >>' });
    objects.push({
      body: '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + images.length + ' >>'
    });

    for (i = 0; i < images.length; i++) {
      var img = images[i];
      var pageNum = 3 + i * 3;
      var contentNum = pageNum + 1;
      var imageNum = pageNum + 2;
      var fit = Math.min(A4_W / img.width, A4_H / img.height);
      var w = img.width * fit;
      var h = img.height * fit;
      var x = (A4_W - w) / 2;
      var y = (A4_H - h) / 2;

      objects.push({
        body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + fmt(A4_W) + ' ' + fmt(A4_H) + ']' +
          ' /Resources << /XObject << /Im0 ' + imageNum + ' 0 R >> >>' +
          ' /Contents ' + contentNum + ' 0 R >>'
      });

      var content = 'q\n' + fmt(w) + ' 0 0 ' + fmt(h) + ' ' + fmt(x) + ' ' + fmt(y) + ' cm\n/Im0 Do\nQ\n';
      var contentBytes = enc.encode(content);
      objects.push({
        body: '<< /Length ' + contentBytes.length + ' >>',
        stream: contentBytes
      });

      objects.push({
        body: '<< /Type /XObject /Subtype /Image /Width ' + img.width + ' /Height ' + img.height +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode' +
          ' /Length ' + img.bytes.length + ' >>',
        stream: img.bytes
      });
    }

    push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');

    var offsets = [];
    for (i = 0; i < objects.length; i++) {
      var obj = objects[i];
      offsets[i] = length;
      push((i + 1) + ' 0 obj\n' + obj.body + '\n');
      if (obj.stream) {
        push('stream\n');
        push(obj.stream);
        push('\nendstream\n');
      }
      push('endobj\n');
    }

    var startxref = length;
    var xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (i = 0; i < offsets.length; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n' +
      'startxref\n' + startxref + '\n%%EOF\n';
    push(xref);

    return new Blob(parts, { type: 'application/pdf' });
  }

  function exportPNG(page, filename) {
    var canvas = renderPageToCanvas(page, 2);
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('Không tạo được ảnh PNG.'));
          return;
        }
        download(blob, filename + '.png');
        resolve();
      }, 'image/png');
    });
  }

  function exportPDF(doc, filename, onProgress) {
    var images = [];
    var index = 0;

    function step() {
      if (index >= doc.pages.length) {
        download(buildPdf(images), filename + '.pdf');
        return Promise.resolve();
      }
      if (onProgress) onProgress(index + 1, doc.pages.length);
      var canvas = renderPageToCanvas(doc.pages[index], 1.6);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      images.push({
        width: canvas.width,
        height: canvas.height,
        bytes: base64ToBytes(dataUrl.slice(dataUrl.indexOf(',') + 1))
      });
      index++;
      /* yield so the progress label paints between pages */
      return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(step);
    }

    return Promise.resolve().then(step);
  }

  function exportJSON(doc, filename) {
    var blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    download(blob, filename + '.json');
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('Không đọc được file.')); };
      reader.readAsText(file);
    });
  }

  global.InkExport = {
    exportPNG: exportPNG,
    exportPDF: exportPDF,
    exportJSON: exportJSON,
    readFileAsText: readFileAsText,
    buildPdf: buildPdf
  };
})(window);
