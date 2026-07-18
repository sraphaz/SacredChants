/**
 * Slim vertical jog-slider for karaoke sync.
 * Idle: hairline edge. Hover: narrow dial. Drag thumb ↕ to nudge start.
 */
(function () {
  'use strict';

  var MIN_GAP = 0.05;
  var DRAFT_PREFIX = 'sc-sync-draft:';
  var WHEEL_STEP = 0.1;
  /** Pixels of drag per 1 second of time nudge */
  var DRAG_PX_PER_SEC = 70;
  /** Max thumb travel from center (px) for visual jog */
  var THUMB_TRAVEL = 36;

  function roundStart(sec) {
    return Math.round(sec * 1000) / 1000;
  }

  /** Cascade Δ from active index forward (j >= index). */
  function nudgeStart(starts, index, delta) {
    if (index < 0 || index >= starts.length || !isFinite(delta) || delta === 0) {
      return starts.slice();
    }
    var next = starts.slice();
    var prevMin = index > 0 ? next[index - 1] + MIN_GAP : 0;
    var effective = delta;
    var proposed = next[index] + delta;
    if (proposed < prevMin) {
      effective = prevMin - next[index];
    }
    if (index === 0 && next[0] + effective < 0) {
      effective = -next[0];
    }
    effective = roundStart(effective);
    if (effective === 0) return next;
    for (var j = index; j < next.length; j++) {
      next[j] = roundStart(Math.max(0, next[j] + effective));
    }
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

  function init(opts) {
    var slug = opts.slug;
    var baseline = opts.baselineStarts.slice();
    var root = document.getElementById('chant-sync-editor');
    if (!root) return;

    var editToggle = document.getElementById('chant-sync-edit-toggle');
    var pad = document.getElementById('chant-sync-editor-pad');
    var track = document.getElementById('chant-sync-rail-track');
    var thumb = document.getElementById('chant-sync-rail-thumb');
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
    var dragOriginY = 0;
    var dragLastY = 0;
    var dragAccum = 0;
    var thumbOffset = 0;

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

    function setThumbOffset(px, animate) {
      thumbOffset = Math.max(-THUMB_TRAVEL, Math.min(THUMB_TRAVEL, px));
      if (!thumb) return;
      if (animate) {
        thumb.style.transition = 'transform 0.22s ease';
      } else {
        thumb.style.transition = 'none';
      }
      thumb.style.transform = 'translateX(-50%) translateY(calc(-50% + ' + thumbOffset + 'px))';
    }

    function resetThumb() {
      setThumbOffset(0, true);
    }

    function setRevealed(on) {
      revealed = !!on;
      root.setAttribute('data-revealed', revealed ? 'true' : '');
      if (!revealed && menuOpen) setMenuOpen(false);
      if (!revealed && !dragging) resetThumb();
    }

    function scheduleHide() {
      if (dragging || menuOpen) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (
          !dragging &&
          !menuOpen &&
          !root.matches(':hover') &&
          !(pad && pad === document.activeElement)
        ) {
          setRevealed(false);
        }
      }, 450);
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
      var t = starts[idx];
      if (lineMeta) {
        lineMeta.textContent = String(idx + 1);
      }
      if (startMeta && t != null) {
        startMeta.textContent = formatSec(t);
      }
      if (pad && t != null) {
        pad.setAttribute('aria-valuetext', formatSec(t));
      }
      var dirty = !startsEqual(starts, baseline);
      if (dirtyEl) {
        dirtyEl.hidden = !dirty;
        root.setAttribute('data-dirty', dirty ? 'true' : '');
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
      }
    }

    function setEditing(on) {
      editing = !!on;
      if (!editing) {
        setMenuOpen(false);
        setRevealed(false);
        setStatus('', false);
        resetThumb();
      }
      updateMeta();
    }

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

    root.addEventListener(
      'pointerup',
      function (e) {
        if (!editing) return;
        if (e.pointerType === 'touch' || e.pointerType === 'pen') {
          if (menu && menu.contains(e.target)) return;
          if (menuBtn && (e.target === menuBtn || menuBtn.contains(e.target))) return;
          if (!revealed) setRevealed(true);
        }
      },
      true
    );

    // Secondary: scroll on dial
    root.addEventListener(
      'wheel',
      function (e) {
        if (!editing || !revealed) return;
        e.preventDefault();
        var step = e.shiftKey ? 0.5 : WHEEL_STEP;
        var delta = e.deltaY > 0 ? step : -step;
        doNudge(delta, true);
        // Brief visual jog in scroll direction
        setThumbOffset(e.deltaY > 0 ? 10 : -10, true);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          if (!dragging) resetThumb();
        }, 180);
      },
      { passive: false }
    );

    function onDragMove(e) {
      if (!dragging) return;
      var totalDy = e.clientY - dragOriginY;
      var stepDy = e.clientY - dragLastY;
      dragLastY = e.clientY;
      // Visual: thumb follows pull (clamped)
      setThumbOffset(totalDy, false);
      // Time: drag up (negative dy) → earlier
      dragAccum += -stepDy / DRAG_PX_PER_SEC;
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
      resetThumb();
      scheduleHide();
    }

    function startDrag(e) {
      if (!editing) return;
      if (e.button != null && e.button !== 0) return;
      if (menuBtn && (e.target === menuBtn || menuBtn.contains(e.target))) return;
      if (menu && menu.contains(e.target)) return;
      dragging = true;
      dragOriginY = e.clientY;
      dragLastY = e.clientY;
      dragAccum = 0;
      root.setAttribute('data-dragging', 'true');
      setRevealed(true);
      cancelHide();
      setThumbOffset(0, false);
      try {
        if (pad) pad.setPointerCapture(e.pointerId);
      } catch (err) {}
      document.addEventListener('pointermove', onDragMove);
      document.addEventListener('pointerup', onDragEnd);
      document.addEventListener('pointercancel', onDragEnd);
      e.preventDefault();
    }

    if (track) track.addEventListener('pointerdown', startDrag);
    if (thumb) thumb.addEventListener('pointerdown', startDrag);
    if (pad) {
      pad.addEventListener('pointerdown', function (e) {
        if (e.target === startMeta || (startMeta && startMeta.contains(e.target))) {
          startDrag(e);
        }
      });
    }

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
        // Empty apiOrigin = same-origin (PUBLIC_CONTRIBUTE_API_ORIGIN unset).
        var apiOrigin = (opts.apiOrigin || '').replace(/\/$/, '');
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
      if (e.key === 'ArrowUp') delta = -0.1;
      else if (e.key === 'ArrowDown') delta = 0.1;
      else if (e.key === '[') delta = -0.1;
      else if (e.key === ']') delta = 0.1;
      else if (e.key === '{') delta = -0.5;
      else if (e.key === '}') delta = 0.5;
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
      setThumbOffset(delta > 0 ? 8 : -8, true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!dragging) resetThumb();
      }, 180);
    });

    var audio = document.getElementById('chant-audio');
    if (audio) {
      audio.addEventListener('timeupdate', function () {
        if (editing) updateMeta();
      });
    }

    resetThumb();
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
