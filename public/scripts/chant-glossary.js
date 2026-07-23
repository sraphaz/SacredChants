/**
 * Sanskrit glossary popover: click on desktop, long-press on touch.
 * Expects #chant-glossary-data (JSON) and #chant-glossary-popover in the DOM.
 */
(function () {
  var LONG_MS = 480;
  var dataEl = document.getElementById('chant-glossary-data');
  var popover = document.getElementById('chant-glossary-popover');
  if (!dataEl || !popover) return;

  var entries = {};
  try {
    entries = JSON.parse(dataEl.textContent || '{}');
  } catch (e) {
    return;
  }

  var iastEl = popover.querySelector('.chant-glossary-popover__iast');
  var originalEl = popover.querySelector('.chant-glossary-popover__original');
  var briefEl = popover.querySelector('.chant-glossary-popover__brief');
  var deepEl = popover.querySelector('.chant-glossary-popover__deep');
  var panel = popover.querySelector('.chant-glossary-popover__panel');
  var activeBtn = null;
  var longTimer = null;
  var longFired = false;
  var touchMoved = false;

  function uiLocale() {
    return (
      (document.documentElement.dataset && document.documentElement.dataset.locale) ||
      'en'
    );
  }

  function pickText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    var loc = uiLocale();
    if (typeof obj[loc] === 'string' && obj[loc].trim()) return obj[loc];
    if (loc === 'hi' || loc === 'ar') return '';
    return obj.en || obj.pt || '';
  }

  function closePopover() {
    popover.hidden = true;
    popover.classList.remove('chant-glossary-popover--open');
    if (activeBtn) {
      activeBtn.setAttribute('aria-expanded', 'false');
      activeBtn = null;
    }
    document.body.classList.remove('chant-glossary-open');
  }

  function openPopover(btn) {
    var id = btn.getAttribute('data-glossary-id');
    var entry = id && entries[id];
    if (!entry) return;

    activeBtn = btn;
    btn.setAttribute('aria-expanded', 'true');
    if (iastEl) iastEl.textContent = entry.iast || '';
    if (originalEl) {
      if (entry.original) {
        originalEl.textContent = entry.original;
        originalEl.hidden = false;
      } else {
        originalEl.textContent = '';
        originalEl.hidden = true;
      }
    }
    if (briefEl) briefEl.textContent = pickText(entry.brief);
    if (deepEl) deepEl.textContent = pickText(entry.deep);

    popover.hidden = false;
    popover.classList.add('chant-glossary-popover--open');
    document.body.classList.add('chant-glossary-open');

    // Prefer focus close button for a11y
    var closeBtn = popover.querySelector('[data-glossary-close].chant-glossary-popover__close');
    if (closeBtn && typeof closeBtn.focus === 'function') {
      try {
        closeBtn.focus();
      } catch (e) {}
    }
  }

  function onWordActivate(btn, ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (popover.classList.contains('chant-glossary-popover--open') && activeBtn === btn) {
      closePopover();
      return;
    }
    openPopover(btn);
  }

  document.addEventListener(
    'click',
    function (ev) {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var btn = t.closest('.chant-word--gloss');
      if (btn) {
        // Touch devices use long-press; ignore synthetic click after long-press
        if (longFired) {
          longFired = false;
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        onWordActivate(btn, ev);
        return;
      }
      if (t.closest('[data-glossary-close]')) {
        closePopover();
        return;
      }
      if (
        popover.classList.contains('chant-glossary-popover--open') &&
        panel &&
        !panel.contains(t)
      ) {
        closePopover();
      }
    },
    true
  );

  document.addEventListener(
    'keydown',
    function (ev) {
      if (ev.key === 'Escape' && popover.classList.contains('chant-glossary-popover--open')) {
        closePopover();
      }
    },
    true
  );

  function clearLong() {
    if (longTimer) {
      clearTimeout(longTimer);
      longTimer = null;
    }
  }

  document.addEventListener(
    'touchstart',
    function (ev) {
      var t = ev.target;
      if (!(t instanceof Element)) return;
      var btn = t.closest('.chant-word--gloss');
      if (!btn) return;
      touchMoved = false;
      longFired = false;
      clearLong();
      longTimer = setTimeout(function () {
        longTimer = null;
        longFired = true;
        onWordActivate(btn, null);
        // Haptic if available
        if (navigator.vibrate) {
          try {
            navigator.vibrate(12);
          } catch (e) {}
        }
      }, LONG_MS);
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'touchmove',
    function () {
      touchMoved = true;
      clearLong();
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'touchend',
    function (ev) {
      clearLong();
      if (longFired) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    { capture: true }
  );

  document.addEventListener(
    'touchcancel',
    function () {
      clearLong();
    },
    { capture: true }
  );

  document.addEventListener(
    'contextmenu',
    function (ev) {
      var t = ev.target;
      if (t instanceof Element && t.closest('.chant-word--gloss')) {
        ev.preventDefault();
      }
    },
    true
  );
})();
