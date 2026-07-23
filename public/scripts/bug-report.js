/**
 * Visual bug reporter: fill the form first; GitHub login only when sending.
 * Draft survives OAuth via sessionStorage + ?report=1 returnTo.
 */
(function () {
  var DRAFT_KEY = 'sc-bug-report-draft';
  var cfg = window.__SC_BUG_REPORT__ || { apiOrigin: '', basePath: '/' };
  /** Empty = same-origin. On pure Astro (:4321) with no PUBLIC_CONTRIBUTE_API_ORIGIN, use local vercel. */
  var apiBase = (function resolveApiBase() {
    var configured = (cfg.apiOrigin || '').replace(/\/$/, '');
    if (configured) return configured;
    try {
      var port = String(window.location.port || '');
      if (port === '4321' || port === '4322') return 'http://localhost:3000';
    } catch (e) {}
    return '';
  })();
  var openBtn = document.getElementById('sc-bug-report-open');
  var dialog = document.getElementById('sc-bug-report-dialog');
  var authBox = document.getElementById('sc-bug-report-auth');
  var signIn = document.getElementById('sc-bug-report-signin');
  var titleInput = document.getElementById('sc-bug-report-title');
  var descInput = document.getElementById('sc-bug-report-description');
  var selectBtn = document.getElementById('sc-bug-report-select');
  var fileInput = document.getElementById('sc-bug-report-file');
  var uploadBtn = document.getElementById('sc-bug-report-upload');
  var clearBtn = document.getElementById('sc-bug-report-clear-image');
  var submitBtn = document.getElementById('sc-bug-report-submit');
  var closeBtn = document.getElementById('sc-bug-report-close');
  var cancelBtn = document.getElementById('sc-bug-report-cancel');
  var statusEl = document.getElementById('sc-bug-report-status');
  var previewWrap = document.getElementById('sc-bug-report-preview-wrap');
  var previewImg = document.getElementById('sc-bug-report-preview');
  var cropHint = document.getElementById('sc-bug-report-crop-hint');
  var cropOverlay = document.getElementById('sc-bug-report-crop-overlay');
  var cropBox = document.getElementById('sc-bug-report-crop-box');
  var i18nEl = document.getElementById('sc-bug-report-i18n');

  if (!openBtn || !dialog) return;

  var labels = {};
  try {
    labels = JSON.parse(i18nEl && i18nEl.textContent ? i18nEl.textContent : '{}');
  } catch (e) {
    labels = {};
  }

  var imageBase64 = null;
  var imageMime = null;
  var imageDataUrl = null;
  var selection = null;
  var cropState = null;
  var pickingFile = false;
  var suppressCloseReset = false;
  var pendingAutoSubmit = false;
  var blockSubmitUntil = 0;
  var draft = { title: '', description: '' };

  function uiLocale() {
    return (
      (document.documentElement.dataset && document.documentElement.dataset.locale) || 'en'
    );
  }

  function t(key) {
    var loc = uiLocale();
    var pack = labels[loc] || labels.en || {};
    return pack[key] || (labels.en && labels.en[key]) || key;
  }

  function apiUrl(path) {
    return (apiBase || '') + path;
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('sc-bug-report-status--error', !!isError);
  }

  function syncDraftFromInputs() {
    draft.title = titleInput ? titleInput.value : '';
    draft.description = descInput ? descInput.value : '';
  }

  function applyDraftToInputs() {
    if (titleInput) titleInput.value = draft.title;
    if (descInput) descInput.value = draft.description;
  }

  function setPreview(dataUrl, alt) {
    if (!previewWrap || !previewImg) return;
    if (!dataUrl) {
      previewWrap.hidden = true;
      previewImg.removeAttribute('src');
      if (clearBtn) clearBtn.hidden = true;
      return;
    }
    previewImg.src = dataUrl;
    previewImg.alt = alt || t('previewAlt');
    previewWrap.hidden = false;
    if (clearBtn) clearBtn.hidden = false;
  }

  function clearImage() {
    imageBase64 = null;
    imageMime = null;
    imageDataUrl = null;
    selection = null;
    if (fileInput) fileInput.value = '';
    setPreview(null);
  }

  function resetReport() {
    draft = { title: '', description: '' };
    clearImage();
    applyDraftToInputs();
    setStatus('');
    if (authBox) authBox.hidden = true;
    pendingAutoSubmit = false;
  }

  function saveDraftToStorage(opts) {
    syncDraftFromInputs();
    var payload = {
      title: draft.title,
      description: draft.description,
      imageBase64: imageBase64,
      imageMime: imageMime,
      imageDataUrl: imageDataUrl,
      selection: selection,
      autoSubmit: !!(opts && opts.autoSubmit),
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      // Quota: drop image and retry text-only
      try {
        payload.imageBase64 = null;
        payload.imageMime = null;
        payload.imageDataUrl = null;
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        return true;
      } catch (e2) {
        return false;
      }
    }
  }

  function loadDraftFromStorage() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(DRAFT_KEY);
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function applyStoredDraft(stored) {
    if (!stored || typeof stored !== 'object') return;
    draft.title = typeof stored.title === 'string' ? stored.title : '';
    draft.description = typeof stored.description === 'string' ? stored.description : '';
    applyDraftToInputs();
    if (stored.imageBase64 && stored.imageMime) {
      imageBase64 = stored.imageBase64;
      imageMime = stored.imageMime;
      imageDataUrl = stored.imageDataUrl || null;
      selection = stored.selection || null;
      if (imageDataUrl) setPreview(imageDataUrl, t('previewAlt'));
    }
    pendingAutoSubmit = !!stored.autoSubmit;
  }

  function returnToPath() {
    var url = new URL(window.location.href);
    url.searchParams.set('report', '1');
    return url.pathname + url.search + url.hash;
  }

  function authUrl() {
    return (
      apiUrl('/api/auth/github') +
      '?returnTo=' +
      encodeURIComponent(returnToPath()) +
      '&returnOrigin=' +
      encodeURIComponent(window.location.origin)
    );
  }

  function showLoginPrompt() {
    if (authBox) authBox.hidden = false;
    if (signIn) signIn.href = authUrl();
    setStatus(t('needLogin'), true);
  }

  function hideLoginPrompt() {
    if (authBox) authBox.hidden = true;
  }

  function blockAccidentalSubmit(ms) {
    blockSubmitUntil = Date.now() + (ms || 1000);
    if (submitBtn) {
      submitBtn.disabled = true;
      setTimeout(function () {
        if (Date.now() >= blockSubmitUntil && submitBtn && !pickingFile) {
          submitBtn.disabled = false;
        }
      }, (ms || 1000) + 20);
    }
  }

  function isSubmitBlocked() {
    return pickingFile || Date.now() < blockSubmitUntil;
  }

  function isDiscardBlocked() {
    return pickingFile || Date.now() < blockSubmitUntil;
  }

  function goToGitHubLogin() {
    if (isSubmitBlocked()) return;
    saveDraftToStorage({ autoSubmit: true });
    window.location.href = authUrl();
  }

  function ensureDialogOpen() {
    if (dialog.open) return;
    suppressCloseReset = true;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    applyDraftToInputs();
    if (imageDataUrl) setPreview(imageDataUrl, t('previewAlt'));
    setTimeout(function () {
      suppressCloseReset = false;
    }, 0);
  }

  function openDialog(opts) {
    var fresh = opts && opts.fresh;
    if (fresh) resetReport();
    else applyDraftToInputs();
    if (imageDataUrl) setPreview(imageDataUrl, t('previewAlt'));
    else if (fresh) setPreview(null);
    hideLoginPrompt();
    setStatus('');
    ensureDialogOpen();
  }

  function closeDialog(opts) {
    if (isDiscardBlocked() && (!opts || opts.discard !== false)) {
      // Ignore accidental cancel/close right after file pick / crop.
      return;
    }
    var discard = !opts || opts.discard !== false;
    pickingFile = false;
    suppressCloseReset = true;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    endCrop();
    if (discard) {
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      resetReport();
    }
    setTimeout(function () {
      suppressCloseReset = false;
    }, 0);
  }

  function captureScriptUrl() {
    var base = cfg.basePath || '/';
    if (base.charAt(base.length - 1) !== '/') base += '/';
    return base + 'scripts/modern-screenshot.min.js';
  }

  function isBugReportUiNode(node) {
    if (!node || node.nodeType !== 1) return false;
    var id = node.id || '';
    if (
      id === 'sc-bug-report-crop-overlay' ||
      id === 'sc-bug-report-dialog' ||
      id === 'sc-bug-report-open' ||
      id === 'sc-bug-report-file' ||
      id === 'sc-bug-report-i18n'
    ) {
      return true;
    }
    var cls = node.classList;
    return !!(
      cls &&
      (cls.contains('sc-bug-report-crop') ||
        cls.contains('sc-bug-report-fab') ||
        cls.contains('sc-bug-report-dialog'))
    );
  }

  /**
   * Capture page pixels. Prefer modern-screenshot (handles color-mix / color()).
   * html2canvas 1.4.x throws on CSS color() and is not used.
   * Tests may stub window.modernScreenshot.domToCanvas.
   */
  function loadCaptureLib() {
    if (window.modernScreenshot && typeof window.modernScreenshot.domToCanvas === 'function') {
      return Promise.resolve(window.modernScreenshot);
    }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-sc-bug-capture="1"]');
      if (existing) {
        existing.addEventListener('load', function () {
          if (window.modernScreenshot && window.modernScreenshot.domToCanvas) {
            resolve(window.modernScreenshot);
          } else {
            reject(new Error('modern-screenshot missing'));
          }
        });
        existing.addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.src = captureScriptUrl();
      s.async = true;
      s.setAttribute('data-sc-bug-capture', '1');
      s.onload = function () {
        if (window.modernScreenshot && window.modernScreenshot.domToCanvas) {
          resolve(window.modernScreenshot);
        } else {
          reject(new Error('modern-screenshot missing'));
        }
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function cssColorForCapture(value, fallback) {
    if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return fallback;
    if (value.indexOf('color(srgb') === 0) {
      var m = value.match(
        /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/
      );
      if (m) {
        var r = Math.round(parseFloat(m[1]) * 255);
        var g = Math.round(parseFloat(m[2]) * 255);
        var b = Math.round(parseFloat(m[3]) * 255);
        var a = m[4] !== undefined ? parseFloat(m[4]) : 1;
        return a < 1
          ? 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
          : 'rgb(' + r + ',' + g + ',' + b + ')';
      }
    }
    return value;
  }

  function capturePageCanvas(lib) {
    var scale = Math.min(2, window.devicePixelRatio || 1);
    var bg = cssColorForCapture(
      window.getComputedStyle(document.body).backgroundColor,
      '#ffffff'
    );
    return lib
      .domToCanvas(document.documentElement, {
        scale: scale,
        backgroundColor: bg,
        filter: function (node) {
          return !isBugReportUiNode(node);
        },
      })
      .then(function (canvas) {
        return { canvas: canvas, scale: scale };
      });
  }

  function startCrop() {
    if (!cropOverlay || !cropBox) return;
    syncDraftFromInputs();
    saveDraftToStorage({ autoSubmit: false });
    suppressCloseReset = true;
    blockAccidentalSubmit(800);
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    cropOverlay.hidden = false;
    cropOverlay.setAttribute('aria-hidden', 'false');
    if (cropHint) cropHint.hidden = false;
    cropBox.hidden = true;
    cropState = { dragging: false, x0: 0, y0: 0, x1: 0, y1: 0 };
    document.body.classList.add('sc-bug-report-cropping');
    setTimeout(function () {
      suppressCloseReset = false;
    }, 0);
  }

  function endCrop() {
    if (!cropOverlay || !cropBox) return;
    cropOverlay.hidden = true;
    cropOverlay.setAttribute('aria-hidden', 'true');
    cropBox.hidden = true;
    cropState = null;
    document.body.classList.remove('sc-bug-report-cropping');
    if (cropHint) cropHint.hidden = true;
  }

  function updateCropBox() {
    if (!cropState || !cropBox) return;
    var x = Math.min(cropState.x0, cropState.x1);
    var y = Math.min(cropState.y0, cropState.y1);
    var w = Math.abs(cropState.x1 - cropState.x0);
    var h = Math.abs(cropState.y1 - cropState.y0);
    cropBox.hidden = w < 2 || h < 2;
    cropBox.style.left = x + 'px';
    cropBox.style.top = y + 'px';
    cropBox.style.width = w + 'px';
    cropBox.style.height = h + 'px';
  }

  function resumeAfterCapture() {
    blockAccidentalSubmit(1200);
    // Keep modal from eating the synthetic click; restore preview explicitly.
    suppressCloseReset = true;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    applyDraftToInputs();
    if (imageDataUrl) setPreview(imageDataUrl, t('previewAlt'));
    hideLoginPrompt();
    setTimeout(function () {
      suppressCloseReset = false;
    }, 50);
  }

  function finishCrop() {
    if (!cropState) return;
    var x = Math.min(cropState.x0, cropState.x1);
    var y = Math.min(cropState.y0, cropState.y1);
    var w = Math.abs(cropState.x1 - cropState.x0);
    var h = Math.abs(cropState.y1 - cropState.y0);
    endCrop();
    if (w < 8 || h < 8) {
      resumeAfterCapture();
      setStatus('');
      return;
    }
    setStatus(t('capturing') || t('submitting'));
    // Prevent dialog close/cancel from wiping the draft while capture is async.
    blockAccidentalSubmit(2500);
    loadCaptureLib()
      .then(function (lib) {
        return capturePageCanvas(lib);
      })
      .then(function (shot) {
        var scale = shot.scale;
        var canvas = shot.canvas;
        // Selection uses viewport (client) coords; canvas is document-rooted.
        var sx = Math.round((x + window.scrollX) * scale);
        var sy = Math.round((y + window.scrollY) * scale);
        var sw = Math.round(w * scale);
        var sh = Math.round(h * scale);
        if (sx < 0) {
          sw += sx;
          sx = 0;
        }
        if (sy < 0) {
          sh += sy;
          sy = 0;
        }
        sw = Math.min(sw, Math.max(0, canvas.width - sx));
        sh = Math.min(sh, Math.max(0, canvas.height - sy));
        if (sw < 1 || sh < 1) {
          throw new Error('crop out of bounds');
        }
        var out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        var ctx = out.getContext('2d');
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        return out;
      })
      .then(function (out) {
        var dataUrl = out.toDataURL('image/png');
        var comma = dataUrl.indexOf(',');
        imageMime = 'image/png';
        imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        imageDataUrl = dataUrl;
        selection = { x: x, y: y, width: w, height: h };
        saveDraftToStorage({ autoSubmit: false });
        resumeAfterCapture();
        setStatus('');
      })
      .catch(function () {
        resumeAfterCapture();
        setStatus(t('errorGeneric'), true);
      });
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve({
          mime: file.type || 'image/png',
          base64: comma >= 0 ? result.slice(comma + 1) : result,
          dataUrl: result,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function beginFilePick() {
    syncDraftFromInputs();
    pickingFile = true;
    if (submitBtn) submitBtn.disabled = true;
  }

  function finishFilePick() {
    pickingFile = false;
    blockAccidentalSubmit(900);
  }

  function submitReport() {
    if (isSubmitBlocked()) return;
    syncDraftFromInputs();
    var title = draft.title.trim();
    var description = draft.description.trim();
    if (!title) {
      setStatus(t('titleField'), true);
      if (titleInput) titleInput.focus();
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    setStatus(t('submitting'));
    hideLoginPrompt();

    var payload = {
      title: title,
      description: description,
      pageUrl: window.location.href.replace(/([?&])report=1(&|$)/, '$1').replace(/[?&]$/, ''),
      locale: uiLocale(),
      userAgent: navigator.userAgent || '',
      viewport:
        Math.round(window.innerWidth) + '×' + Math.round(window.innerHeight),
    };
    if (imageBase64 && imageMime) {
      payload.imageBase64 = imageBase64;
      payload.imageMime = imageMime;
    }
    if (selection) payload.selection = selection;

    fetch(apiUrl('/api/contribute/report'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return { res: res, data: data };
          });
      })
      .then(function (out) {
        if (submitBtn) submitBtn.disabled = false;
        if (out.res.status === 401) {
          showLoginPrompt();
          return;
        }
        if (out.res.status === 404 || out.res.status === 0) {
          setStatus(t('errorNoApi') || t('errorGeneric'), true);
          return;
        }
        if (!out.res.ok) {
          var detail =
            (out.data && (out.data.details || out.data.error || out.data.hint)) ||
            t('errorGeneric');
          setStatus(detail, true);
          return;
        }
        var url = out.data && out.data.issueUrl;
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch (e) {}
        resetReport();
        applyDraftToInputs();
        setStatus(t('success') + (url ? ' — ' + t('successLink') : ''));
        if (url && statusEl) {
          statusEl.innerHTML = '';
          var span = document.createElement('span');
          span.textContent = t('success') + ' ';
          var a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = t('successLink');
          statusEl.appendChild(span);
          statusEl.appendChild(a);
        }
      })
      .catch(function () {
        if (submitBtn) submitBtn.disabled = false;
        setStatus(t('errorNoApi') || t('errorGeneric'), true);
      });
  }

  function cleanReportQuery() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has('report')) return;
      url.searchParams.delete('report');
      var next = url.pathname + url.search + url.hash;
      window.history.replaceState({}, '', next);
    } catch (e) {}
  }

  function resumeAfterOAuth() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e) {
      return;
    }
    if (params.get('report') !== '1') return;
    var stored = loadDraftFromStorage();
    cleanReportQuery();
    if (stored) applyStoredDraft(stored);
    openDialog({ fresh: false });
    if (pendingAutoSubmit) {
      pendingAutoSubmit = false;
      setTimeout(function () {
        submitReport();
      }, 50);
    }
  }

  openBtn.addEventListener('click', function (ev) {
    ev.preventDefault();
    openDialog({ fresh: false });
  });

  var form = document.getElementById('sc-bug-report-form');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
    });
  }

  if (titleInput) titleInput.addEventListener('input', syncDraftFromInputs);
  if (descInput) descInput.addEventListener('input', syncDraftFromInputs);

  if (closeBtn) {
    closeBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isDiscardBlocked()) return;
      closeDialog({ discard: true });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isDiscardBlocked()) return;
      closeDialog({ discard: true });
    });
  }

  dialog.addEventListener('cancel', function (ev) {
    ev.preventDefault();
    if (pickingFile || isDiscardBlocked()) return;
    closeDialog({ discard: true });
  });

  dialog.addEventListener('close', function () {
    if (suppressCloseReset || pickingFile || cropState) return;
    syncDraftFromInputs();
  });

  if (signIn) {
    signIn.addEventListener('click', function (ev) {
      ev.preventDefault();
      goToGitHubLogin();
    });
  }

  if (selectBtn) {
    selectBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      startCrop();
    });
  }

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      beginFilePick();
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      finishFilePick();
      if (!file) {
        resumeAfterCapture();
        return;
      }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        resumeAfterCapture();
        setStatus(t('errorGeneric'), true);
        return;
      }
      setStatus(t('capturing') || '');
      fileToBase64(file).then(function (parsed) {
        imageBase64 = parsed.base64;
        imageMime = parsed.mime;
        imageDataUrl = parsed.dataUrl;
        selection = null;
        saveDraftToStorage({ autoSubmit: false });
        resumeAfterCapture();
        setStatus('');
      });
    });
  }

  window.addEventListener('focus', function () {
    if (!pickingFile) return;
    setTimeout(function () {
      if (!pickingFile) return;
      if (fileInput && fileInput.files && fileInput.files.length) return;
      finishFilePick();
      resumeAfterCapture();
    }, 400);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      clearImage();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (isSubmitBlocked()) return;
      submitReport();
    });
  }

  if (cropOverlay) {
    cropOverlay.addEventListener('pointerdown', function (ev) {
      if (!cropState) return;
      cropState.dragging = true;
      cropState.x0 = cropState.x1 = ev.clientX;
      cropState.y0 = cropState.y1 = ev.clientY;
      updateCropBox();
      try {
        cropOverlay.setPointerCapture(ev.pointerId);
      } catch (e) {}
    });
    cropOverlay.addEventListener('pointermove', function (ev) {
      if (!cropState || !cropState.dragging) return;
      cropState.x1 = ev.clientX;
      cropState.y1 = ev.clientY;
      updateCropBox();
    });
    cropOverlay.addEventListener('pointerup', function (ev) {
      if (!cropState || !cropState.dragging) return;
      cropState.dragging = false;
      cropState.x1 = ev.clientX;
      cropState.y1 = ev.clientY;
      finishCrop();
    });
    cropOverlay.addEventListener('pointercancel', function () {
      endCrop();
      resumeAfterCapture();
    });
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && cropState) {
      endCrop();
      resumeAfterCapture();
    }
  });

  resumeAfterOAuth();
})();
