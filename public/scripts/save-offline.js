/**
 * Save/remove current chant page + linked assets (and optional audio) in Cache API.
 * Requires service worker (sw.js) for offline fallback when the network fails.
 */
(function () {
  var CACHE_NAME = 'sc-offline-v1';
  var STORAGE_PREFIX = 'sc-offline-urls:';

  function baseHref() {
    var b = document.querySelector('base');
    return b && b.href ? b.href : location.origin + '/';
  }

  function absolutize(url) {
    try {
      return new URL(url, baseHref()).href;
    } catch (e) {
      return url;
    }
  }

  function sameOrigin(href) {
    try {
      return new URL(href).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  function collectAssetUrls() {
    var set = {};
    document
      .querySelectorAll(
        'link[rel="stylesheet"][href], script[src], link[rel="icon"][href], link[rel="manifest"][href]'
      )
      .forEach(function (el) {
        var href = el.getAttribute('href') || el.getAttribute('src');
        if (href) set[absolutize(href)] = true;
      });
    return Object.keys(set);
  }

  function putInCache(cache, url) {
    return fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (res.ok) return cache.put(url, res.clone());
      })
      .catch(function () {
        if (!sameOrigin(url)) {
          return fetch(url, { mode: 'no-cors', credentials: 'omit' }).then(function (res) {
            return cache.put(url, res.clone());
          });
        }
      })
      .catch(function () {});
  }

  function setSavedState(btn, saved) {
    btn.setAttribute('data-saved', saved ? 'true' : 'false');
    btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
  }

  function savePage(btn) {
    var pageUrl = absolutize(btn.getAttribute('data-page-url') || location.href);
    var audioUrl = btn.getAttribute('data-audio-url');
    var slug = btn.getAttribute('data-slug') || '';

    var urlSet = {};
    urlSet[pageUrl] = true;
    collectAssetUrls().forEach(function (u) {
      urlSet[u] = true;
    });
    urlSet[absolutize(new URL('favicon.svg', baseHref()).href)] = true;
    urlSet[absolutize(new URL('manifest.webmanifest', baseHref()).href)] = true;
    urlSet[absolutize(new URL('sw.js', baseHref()).href)] = true;
    if (audioUrl) urlSet[absolutize(audioUrl)] = true;

    var list = Object.keys(urlSet);
    var key = STORAGE_PREFIX + slug;

    btn.disabled = true;
    btn.setAttribute('data-busy', 'true');

    return caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return Promise.all(list.map(function (u) {
          return putInCache(cache, u);
        }));
      })
      .then(function () {
        try {
          localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {}
        setSavedState(btn, true);
      })
      .catch(function () {})
      .then(function () {
        btn.disabled = false;
        btn.removeAttribute('data-busy');
      });
  }

  function removePage(btn) {
    var slug = btn.getAttribute('data-slug') || '';
    var key = STORAGE_PREFIX + slug;
    var raw;
    try {
      raw = localStorage.getItem(key);
    } catch (e) {
      raw = null;
    }
    if (!raw) {
      setSavedState(btn, false);
      return Promise.resolve();
    }

    var list;
    try {
      list = JSON.parse(raw);
    } catch (e) {
      list = [];
    }

    btn.disabled = true;

    return caches
      .open(CACHE_NAME)
      .then(function (cache) {
        return Promise.all(
          list.map(function (u) {
            return cache.delete(u);
          })
        );
      })
      .then(function () {
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        setSavedState(btn, false);
      })
      .catch(function () {})
      .then(function () {
        btn.disabled = false;
      });
  }

  function bind(btn) {
    var slug = btn.getAttribute('data-slug') || '';
    var key = STORAGE_PREFIX + slug;
    try {
      if (localStorage.getItem(key)) setSavedState(btn, true);
    } catch (e) {}

    btn.addEventListener('click', function () {
      if (btn.getAttribute('data-saved') === 'true') {
        removePage(btn);
      } else {
        savePage(btn);
      }
    });
  }

  if (!('caches' in window)) return;

  document.querySelectorAll('[data-save-offline]').forEach(bind);
})();
