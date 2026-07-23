/**
 * Practice rail: loop until off, pause after 108 playthroughs, one-click restart.
 * Depends on #chant-audio and optional window.SacredChantsLyricSync.
 */
(function (global) {
  'use strict';

  var LOOP_KEY = 'chant-practice-loop';
  var DEFAULT_MALA = 108;

  function $(id) {
    return document.getElementById(id);
  }

  function uiLocale() {
    return (
      (document.documentElement.dataset && document.documentElement.dataset.locale) ||
      'en'
    );
  }

  function attrLabel(el, prefix) {
    if (!el) return '';
    var loc = uiLocale();
    return (
      el.getAttribute(prefix + '-' + loc) ||
      el.getAttribute(prefix + '-en') ||
      ''
    );
  }

  function init() {
    var audio = $('chant-audio');
    var rail = $('chant-practice-rail');
    var loopBtn = $('chant-practice-loop');
    var restartBtn = $('chant-practice-restart');
    var countEl = $('chant-practice-count');
    var statusEl = $('chant-practice-status');
    var list = $('chant-verses-list');
    if (!audio || !rail || !loopBtn || !restartBtn || !countEl) return;

    var malaTarget =
      parseInt(rail.getAttribute('data-mala-target') || String(DEFAULT_MALA), 10) ||
      DEFAULT_MALA;
    var count = 0;
    var loopOn = false;

    function getSyncApi() {
      return global.SacredChantsLyricSync || null;
    }

    function readLoopPref() {
      try {
        return localStorage.getItem(LOOP_KEY) === 'true';
      } catch (e) {
        return false;
      }
    }

    function writeLoopPref(on) {
      try {
        localStorage.setItem(LOOP_KEY, on ? 'true' : 'false');
      } catch (e) {}
    }

    function updateCountUi() {
      countEl.setAttribute('data-count', String(count));
      var num = countEl.querySelector('.chant-practice-rail__count-num');
      var target = countEl.querySelector('.chant-practice-rail__count-target');
      if (num) num.textContent = String(count);
      if (target) target.textContent = String(malaTarget);
      countEl.classList.toggle('chant-practice-rail__count--active', loopOn);
      countEl.setAttribute(
        'aria-label',
        count + ' / ' + malaTarget
      );
    }

    function setLoopUi(on) {
      loopOn = !!on;
      loopBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      loopBtn.classList.toggle('chant-practice-rail__btn--on', on);
      rail.setAttribute('data-loop', on ? 'true' : '');
      var label = attrLabel(rail, 'data-loop-label');
      if (label) loopBtn.setAttribute('aria-label', label);
      updateCountUi();
      if (!on) {
        hideStatus();
        setEndAffordance(audio.ended || nearEnd());
      } else {
        setEndAffordance(false);
      }
    }

    function hideStatus() {
      if (statusEl) statusEl.hidden = true;
      rail.removeAttribute('data-mala-complete');
    }

    function showMalaComplete() {
      if (statusEl) statusEl.hidden = false;
      rail.setAttribute('data-mala-complete', 'true');
    }

    function nearEnd() {
      if (!list) return false;
      var blocks = list.querySelectorAll('.verse-block[data-sync-index]');
      if (!blocks.length) return false;
      var last = blocks[blocks.length - 1];
      return last.classList.contains('verse-block--active');
    }

    function setEndAffordance(show) {
      var highlight = !!show && !loopOn;
      restartBtn.classList.toggle('chant-practice-rail__btn--emphasize', highlight);
      rail.classList.toggle('chant-practice-rail--end', highlight);
    }

    function goToStartLine(scroll) {
      var api = getSyncApi();
      if (api && typeof api.goToLine === 'function') {
        api.goToLine(0, !!scroll);
      }
    }

    function restart(play) {
      hideStatus();
      setEndAffordance(false);
      try {
        audio.currentTime = 0;
      } catch (e) {}
      goToStartLine(true);
      if (play !== false) {
        var p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      }
    }

    function onEnded() {
      if (!loopOn) {
        setEndAffordance(true);
        return;
      }
      count += 1;
      updateCountUi();
      if (count >= malaTarget) {
        showMalaComplete();
        setEndAffordance(false);
        return;
      }
      hideStatus();
      try {
        audio.currentTime = 0;
      } catch (e) {}
      goToStartLine(true);
      var p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    }

    function onTimeUpdate() {
      if (loopOn) return;
      if (audio.ended) {
        setEndAffordance(true);
        return;
      }
      var api = getSyncApi();
      var lineCount =
        api && typeof api.getLineCount === 'function' ? api.getLineCount() : 0;
      var active =
        api && typeof api.getActiveIndex === 'function'
          ? api.getActiveIndex()
          : -1;
      if (lineCount > 0 && active === lineCount - 1) {
        setEndAffordance(true);
      } else if (!audio.ended) {
        setEndAffordance(false);
      }
    }

    loopBtn.addEventListener('click', function () {
      var next = !loopOn;
      if (!next) {
        count = 0;
        updateCountUi();
        hideStatus();
      }
      setLoopUi(next);
      writeLoopPref(next);
    });

    restartBtn.addEventListener('click', function () {
      restart(true);
    });

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', function () {
      if (!audio.ended) setEndAffordance(false);
      hideStatus();
    });
    audio.addEventListener('timeupdate', onTimeUpdate);

    setLoopUi(readLoopPref());
    updateCountUi();

    global.SacredChantsPractice = {
      restart: restart,
      getCount: function () {
        return count;
      },
      getMalaTarget: function () {
        return malaTarget;
      },
      isLoopOn: function () {
        return loopOn;
      },
      setLoop: function (on) {
        setLoopUi(!!on);
        writeLoopPref(!!on);
      },
      /** Test / debug helper */
      _setCount: function (n) {
        count = Math.max(0, Number(n) || 0);
        updateCountUi();
      },
      _setMalaTarget: function (n) {
        malaTarget = Math.max(1, Number(n) || DEFAULT_MALA);
        rail.setAttribute('data-mala-target', String(malaTarget));
        updateCountUi();
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
