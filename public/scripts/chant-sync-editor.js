/**
 * Minimal karaoke sync rail: thin idle edge, hover/touch to reveal.
 * Scroll wheel / vertical drag nudges the active line start.
 */
(function () {
  'use strict';

  var MIN_GAP = 0.05;
  var DRAFT_PREFIX = 'sc-sync-draft:';
  var WHEEL_STEP = 0.1;
  var DRAG_PX_PER_SEC = 80;

  function roundStart(sec) {
    return Math.round(sec * 1000) / 1000;
  }

  function nudgeStart(starts, index, delta) {
    if (index < 0 || index >= starts.length || !isFinite(delta)) {
      return starts.slice();
    }
    var next = starts.slice();
    var prevMin = index > 0 ? next[index - 1] + MIN_GAP : 0;
    var nextMax =
      index + 1 < next.length ? next[index + 1] - MIN_GAP : Infinity;
    var value = roundStart(next[index] + delta);
    if (value < prevMin) value = roundStart(prevMin);
    if (value > nextMax) value = roundStart(nextMax);
    if (value < 0) value = 0;
    next[index] = value;
    return next;
  }

  function buildExport(slug, baseline, current) {
    var starts = current.map(roundStart);
    var anchors = {};
    var diffs = [];
    for (var i = 0; i < starts.length; i++) {
      anchors[String(i)] = starts[i];
      var from = roundStart(baseline[i] != null ? baseline[i] : starts[i]);
      if (from !== starts[i]) diffs.push({ i: i, from: from, to: starts[i] });
    }
    return {
      kind: 'sync-review',
      version: 1,
      slug: slug,
      updatedAt: new Date().toISOString(),
      starts: starts,
      anchors: anchors,
      diffs: diffs,
    };
  }

  function draftKey(slug) {
    return DRAFT_PREFIX + slug;
  }

  function loadDraft(slug, expectedLen) {
    try {
      var raw = localStorage.getItem(draftKey(slug));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.starts)) return null;
      if (parsed.starts.length !== expectedLen) return null;
      return parsed.starts.map(Number);
    } catch (e) {
      return null;
    }
  }

  function saveDraft(slug, starts) {
    try {
      localStorage.setItem(
        draftKey(slug),
        JSON.stringify({
          starts: starts.map(roundStart),
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {}
  }

  function clearDraft(slug) {
    try {
      localStorage.removeItem(draftKey(slug));
    } catch (e) {}
  }

  function downloadJson(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: 'application/json',
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function formatSec(sec) {
    return roundStart(sec).toFixed(2) + 's';
  }

  function startsEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (roundStart(a[i]) !== roundStart(b[i])) return false;
    }
    return true;
  }

  /**
   * @param {object} opts
   */
  function init(opts) {
    var slug = opts.slug;
    var baseline = opts.baselineStarts.slice();
    var root = document.getElementById('chant-sync-editor');
    if (!root) return;

    var editToggle = document.getElementById('chant-sync-edit-toggle');
    var pad = document.getElementById('chant-sync-editor-pad');
    var lineMeta = document.getElementById('chant-sync-editor-line');
    var startMeta = document.getElementById('chant-sync-editor-start');
    var dirtyEl = document.getElementById('chant-sync-editor-dirty');
    var statusEl = document.getElementById('chant-sync-editor-status');
    var menuBtn = document.getElementById('chant-sync-rail-menu-btn');
    var menu = document.getElementById('chant-sync-rail-menu');
    var labels = opts.labels || {};

    var editing = false;
    var revealed = false;
    var menuOpen = false;
    var hideTimer = null;
    var dragging = false;
    var dragLastY = 0;
    var dragAccum = 0;

    var params = new URLSearchParams(window.location.search);
    if (params.get('edit') === '1' || params.get('edit') === 'true') {
      editing = true;
    }

    function setStatus(msg, isError) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.hidden = !msg;
      statusEl.setAttribute('data-error', isError ? 'true' : '');
    }

    function setRevealed(on) {
      revealed = !!on;
      root.setAttribute('data-revealed', revealed ? 'true' : '');
      if (!revealed && menuOpen) setMenuOpen(false);
    }

    function scheduleHide() {
      if (dragging || menuOpen) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!dragging && !menuOpen && !root.matches(':hover') && !(pad && pad === document.activeElement)) {
          setRevealed(false);
        }
      }, 400);
    }

    function cancelHide() {
      clearTimeout(hideTimer);
    }

    function setMenuOpen(on) {
      menuOpen = !!on;
      if (menu) menu.hidden = !menuOpen;
      if (menuBtn) menuBtn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
      if (menuOpen) {
        setRevealed(true);
        cancelHide();
      }
    }

    function updateMeta() {
      var starts = opts.getStarts();
      var idx = opts.getActiveIndex();
      if (lineMeta) {
        lineMeta.textContent =
          (labels.line || 'Line') + ' ' + (idx + 1);
      }
      if (startMeta && starts[idx] != null) {
        startMeta.textContent = formatSec(starts[idx]);
      }
      var dirty = !startsEqual(starts, baseline);
      if (dirtyEl) {
        dirtyEl.hidden = !dirty;
      }
      if (editToggle) {
        editToggle.setAttribute('aria-pressed', editing ? 'true' : 'false');
        editToggle.setAttribute('data-edit-on', editing ? 'true' : '');
      }
      document.documentElement.setAttribute(
        'data-sync-editing',
        editing ? 'true' : ''
      );
      root.hidden = !editing;
      root.setAttribute('data-editing', editing ? 'true' : '');
    }

    function applyStarts(next, persist) {
      opts.setStarts(next);
      if (persist !== false) saveDraft(slug, next);
      opts.refreshHighlight();
      updateMeta();
    }

    function doNudge(delta, quiet) {
      if (!editing) return;
      var idx = opts.getActiveIndex();
      var next = nudgeStart(opts.getStarts(), idx, delta);
      applyStarts(next, true);
      if (!quiet) {
        setStatus(formatSec(next[idx]), false);
      } else if (startMeta && next[idx] != null) {
        startMeta.textContent = formatSec(next[idx]);
      }
    }

    function setEditing(on) {
      editing = !!on;
      if (!editing) {
        setMenuOpen(false);
        setRevealed(false);
        setStatus('', false);
      }
      updateMeta();
    }

    // Restore draft
    var draft = loadDraft(slug, baseline.length);
    if (draft) {
      applyStarts(draft, false);
      setStatus(labels.draftRestored || 'Local draft restored', false);
    }

    if (editToggle) {
      editToggle.addEventListener('click', function () {
        setEditing(!editing);
        if (editing) setRevealed(true);
      });
    }

    // Reveal on hover / focus; collapse shortly after leave
    root.addEventListener('pointerenter', function () {
      if (!editing) return;
      cancelHide();
      setRevealed(true);
    });
    root.addEventListener('pointerleave', function () {
      if (!editing) return;
      scheduleHide();
    });
    if (pad) {
      pad.addEventListener('focus', function () {
        if (editing) setRevealed(true);
      });
      pad.addEventListener('blur', function () {
        scheduleHide();
      });
    }

    // Mobile: tap edge/pad toggles pin reveal
    root.addEventListener(
      'pointerup',
      function (e) {
        if (!editing) return;
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          if (menu && menu.contains(e.target)) return;
          if (menuBtn && (e.target === menuBtn || menuBtn.contains(e.target))) return;
          if (!revealed) {
            setRevealed(true);
          }
        }
      },
      true
    );

    // Scroll wheel → nudge (±0.1s per notch; shift = ±0.5)
    root.addEventListener(
      'wheel',
      function (e) {
        if (!editing) return;
        e.preventDefault();
        setRevealed(true);
        var step = e.shiftKey ? 0.5 : WHEEL_STEP;
        var delta = e.deltaY > 0 ? step : -step;
        doNudge(delta, true);
      },
      { passive: false }
    );

    // Vertical drag / press-and-hold drag on pad
    function onDragMove(e) {
      if (!dragging) return;
      var dy = e.clientY - dragLastY;
      dragLastY = e.clientY;
      // Drag up → earlier (negative start); drag down → later
      dragAccum += -dy / DRAG_PX_PER_SEC;
      if (Math.abs(dragAccum) >= 0.05) {
        var chunk = roundStart(dragAccum);
        dragAccum -= chunk;
        doNudge(chunk, true);
      }
    }

    function onDragEnd() {
      if (!dragging) return;
      dragging = false;
      root.setAttribute('data-dragging', '');
      document.removeEventListener('pointermove', onDragMove);
      document.removeEventListener('pointerup', onDragEnd);
      document.removeEventListener('pointercancel', onDragEnd);
      scheduleHide();
    }

    if (pad) {
      pad.addEventListener('pointerdown', function (e) {
        if (!editing) return;
        if (e.button != null && e.button !== 0) return;
        if (menuBtn && (e.target === menuBtn || menuBtn.contains(e.target))) return;
        if (menu && menu.contains(e.target)) return;
        if (e.target && e.target.closest && e.target.closest('[data-nudge]')) return;
        dragging = true;
        dragLastY = e.clientY;
        dragAccum = 0;
        root.setAttribute('data-dragging', 'true');
        setRevealed(true);
        cancelHide();
        try {
          pad.setPointerCapture(e.pointerId);
        } catch (err) {}
        document.addEventListener('pointermove', onDragMove);
        document.addEventListener('pointerup', onDragEnd);
        document.addEventListener('pointercancel', onDragEnd);
        e.preventDefault();
      });
    }

    root.querySelectorAll('[data-nudge]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = parseFloat(btn.getAttribute('data-nudge') || '0');
        if (!isNaN(d)) doNudge(d, false);
      });
    });

    if (menuBtn && menu) {
      menuBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        setMenuOpen(!menuOpen);
      });
      document.addEventListener('pointerdown', function (e) {
        if (!menuOpen) return;
        if (root.contains(e.target)) return;
        setMenuOpen(false);
        scheduleHide();
      });
    }

    var copyBtn = document.getElementById('chant-sync-export-copy');
    var downloadBtn = document.getElementById('chant-sync-export-download');
    var resetBtn = document.getElementById('chant-sync-editor-reset');
    var prBtn = document.getElementById('chant-sync-export-pr');

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var exp = buildExport(slug, baseline, opts.getStarts());
        var text = JSON.stringify(exp, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              setStatus(labels.copied || 'Copied JSON', false);
            },
            function () {
              setStatus(labels.copyFailed || 'Could not copy', true);
            }
          );
        } else {
          setStatus(labels.copyFailed || 'Could not copy', true);
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var exp = buildExport(slug, baseline, opts.getStarts());
        downloadJson('sync-review-' + slug + '.json', exp);
        setStatus(labels.downloaded || 'Download started', false);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        clearDraft(slug);
        applyStarts(baseline.slice(), false);
        setStatus(labels.resetDone || 'Reset to published', false);
      });
    }

    if (prBtn) {
      prBtn.addEventListener('click', function () {
        var apiOrigin = (opts.apiOrigin || '').replace(/\/$/, '');
        if (!apiOrigin) {
          setStatus(
            labels.prUnavailable ||
              'PR submit needs the contribute API. Download JSON instead.',
            true
          );
          return;
        }
        var starts = opts.getStarts().map(roundStart);
        if (startsEqual(starts, baseline)) {
          setStatus(labels.noChanges || 'No changes to submit', true);
          return;
        }
        prBtn.disabled = true;
        setStatus(labels.prSubmitting || 'Opening PR…', false);
        fetch(apiOrigin + '/api/contribute/sync', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slug, starts: starts }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { ok: res.ok, status: res.status, data: data };
            });
          })
          .then(function (result) {
            prBtn.disabled = false;
            if (result.status === 401) {
              setStatus(
                labels.prAuth ||
                  'Sign in via Contribute (GitHub) to open a sync PR.',
                true
              );
              return;
            }
            if (!result.ok) {
              setStatus(
                (result.data && (result.data.error || result.data.details)) ||
                  labels.prFailed ||
                  'PR failed',
                true
              );
              return;
            }
            var url = result.data && result.data.prUrl;
            setStatus(
              (labels.prOk || 'PR created') + (url ? ': ' + url : ''),
              false
            );
            if (url) {
              try {
                window.open(url, '_blank', 'noopener');
              } catch (e) {}
            }
          })
          .catch(function () {
            prBtn.disabled = false;
            setStatus(labels.prFailed || 'PR failed', true);
          });
      });
    }

    document.addEventListener('keydown', function (e) {
      if (!editing || isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      var delta = null;
      if (e.key === '[') delta = -0.1;
      else if (e.key === ']') delta = 0.1;
      else if (e.key === '{') delta = -0.5;
      else if (e.key === '}') delta = 0.5;
      else if (e.key === 'ArrowLeft' && e.shiftKey) delta = -1;
      else if (e.key === 'ArrowRight' && e.shiftKey) delta = 1;
      else if (e.key === 'Escape') {
        if (menuOpen) {
          setMenuOpen(false);
          e.preventDefault();
          return;
        }
        setRevealed(false);
        return;
      }

      if (delta == null) return;
      e.preventDefault();
      setRevealed(true);
      doNudge(delta, false);
    });

    var audio = document.getElementById('chant-audio');
    if (audio) {
      audio.addEventListener('timeupdate', function () {
        if (editing) updateMeta();
      });
    }

    setEditing(editing);
    updateMeta();
    if (editing) setRevealed(false);

    window.SacredChantsSyncEditor = {
      nudge: doNudge,
      setEditing: setEditing,
      isEditing: function () {
        return editing;
      },
      buildExport: function () {
        return buildExport(slug, baseline, opts.getStarts());
      },
    };
  }

  window.SacredChantsSyncEditorInit = init;
})();
