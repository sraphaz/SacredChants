/**
 * Initializes theme and locale from localStorage and URL.
 * Runs once on load; applies theme/reading preferences and syncs ?lang= with data-locale.
 * URL allowlist / aliases: window.__SC_LOCALE_URL__ from sc-locale-url-data.js (generated from locale-url-contract.json).
 */
(function () {
  var STORAGE_PREFIX = 'sacred-chants-';
  var root = document.documentElement;

  var bundle =
    typeof globalThis !== 'undefined' && globalThis.__SC_LOCALE_URL__
      ? globalThis.__SC_LOCALE_URL__
      : null;

  var FALLBACK_ALLOWED_RAW = ['en', 'pt', 'pt-br', 'es', 'it', 'hi', 'ar'];
  var FALLBACK_PARAM_TO_CANONICAL = {
    en: 'en',
    pt: 'pt',
    'pt-br': 'pt',
    es: 'es',
    it: 'it',
    hi: 'hi',
    ar: 'ar',
  };

  var allowedLocales = bundle && bundle.allowedRaw ? bundle.allowedRaw : FALLBACK_ALLOWED_RAW;
  var paramToCanonical =
    bundle && bundle.paramToCanonical ? bundle.paramToCanonical : FALLBACK_PARAM_TO_CANONICAL;

  function applyThemeFromStorage() {
    root.dataset.theme = localStorage.getItem(STORAGE_PREFIX + 'theme') || 'dark';
    root.dataset.fontSize = localStorage.getItem(STORAGE_PREFIX + 'fontSize') || 'medium';
    root.dataset.fontFamily = localStorage.getItem(STORAGE_PREFIX + 'fontFamily') || 'sans';
    root.dataset.spacing = localStorage.getItem(STORAGE_PREFIX + 'spacing') || 'normal';
    var verseTint = localStorage.getItem(STORAGE_PREFIX + 'verseTint') || 'default';
    if (verseTint) root.dataset.verseTint = verseTint;
    var textColor = localStorage.getItem(STORAGE_PREFIX + 'textColor') || 'default';
    if (textColor) root.dataset.textColor = textColor;
    var bg = localStorage.getItem(STORAGE_PREFIX + 'bg') || 'default';
    if (bg) root.dataset.bg = bg;
  }

  function normalizeUrlLangParam(raw) {
    return raw ? String(raw).toLowerCase() : null;
  }

  function isUrlLangAllowed(normalized) {
    return normalized != null && allowedLocales.indexOf(normalized) !== -1;
  }

  /** Canonical locale for storage (always pt, never pt-br). */
  function canonicalForStorage(normalizedUrlLang) {
    var c = paramToCanonical[normalizedUrlLang];
    return c || (normalizedUrlLang === 'pt-br' ? 'pt' : normalizedUrlLang);
  }

  function localeFromSavedOnly(savedLang) {
    if (savedLang === 'pt') return 'pt';
    if (savedLang === 'es') return 'es';
    if (savedLang === 'it') return 'it';
    if (savedLang === 'hi') return 'hi';
    if (savedLang === 'ar') return 'ar';
    return 'en';
  }

  function applyDocumentDirection(locale) {
    root.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }

  function resolveLocaleFromUrlAndStorage() {
    var savedLang = localStorage.getItem(STORAGE_PREFIX + 'lang');
    var urlSearchParams = new URLSearchParams(window.location.search);
    var urlLang = urlSearchParams.get('lang');
    var normalizedUrlLang = normalizeUrlLangParam(urlLang);

    if (savedLang && !normalizedUrlLang) {
      urlSearchParams.set('lang', savedLang);
      var queryString = urlSearchParams.toString();
      var newUrl = window.location.pathname + (queryString ? '?' + queryString : '') + (window.location.hash || '');
      if (newUrl !== window.location.pathname + (window.location.search || '') + (window.location.hash || '')) {
        window.location.replace(newUrl);
        return;
      }
    }

    if (normalizedUrlLang && isUrlLangAllowed(normalizedUrlLang)) {
      try {
        localStorage.setItem(STORAGE_PREFIX + 'lang', canonicalForStorage(normalizedUrlLang));
      } catch (e) {}
    }

    var locale = localeFromSavedOnly(savedLang);
    root.dataset.locale = locale;
    root.lang = locale;
    applyDocumentDirection(locale);

    if (normalizedUrlLang && isUrlLangAllowed(normalizedUrlLang)) {
      var urlLocale = paramToCanonical[normalizedUrlLang] || (normalizedUrlLang === 'pt-br' ? 'pt' : normalizedUrlLang);
      root.dataset.locale = urlLocale;
      root.lang = urlLocale;
      applyDocumentDirection(urlLocale);
    }
  }

  applyThemeFromStorage();
  resolveLocaleFromUrlAndStorage();
})();
