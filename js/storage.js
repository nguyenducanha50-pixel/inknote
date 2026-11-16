/* InkNote - session persistence in localStorage */
(function (global) {
  'use strict';

  var KEY = 'inknote:doc:v1';

  function available() {
    try {
      var probe = '__inknote_probe__';
      global.localStorage.setItem(probe, '1');
      global.localStorage.removeItem(probe);
      return true;
    } catch (e) {
      return false;
    }
  }

  function save(doc) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(doc));
      return true;
    } catch (e) {
      return false; // quota exceeded / private mode
    }
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clear() {
    try {
      global.localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }

  global.InkStorage = {
    available: available,
    save: save,
    load: load,
    clear: clear,
    KEY: KEY
  };
})(window);
