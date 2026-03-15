/**
 * Initializes theme and locale from localStorage and URL.
 * Runs once on load; applies theme/reading preferences and syncs ?lang= with data-locale.
 */
(function () {
  var STORAGE_PREFIX = 'sacred-chants-';
  var root = document.documentElement;

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

  function resolveLocaleFromUrlAndStorage() {
    var savedLang = localStorage.getItem(STORAGE_PREFIX + 'lang');
    var urlSearchParams = new URLSearchParams(window.location.search);
    var urlLang = urlSearchParams.get('lang');

    if (savedLang && !urlLang) {
      urlSearchParams.set('lang', savedLang);
      var queryString = urlSearchParams.toString();
      var newUrl = window.location.pathname + (queryString ? '?' + queryString : '') + (window.location.hash || '');
      if (newUrl !== window.location.pathname + (window.location.search || '') + (window.location.hash || '')) {
        window.location.replace(newUrl);
        return;
      }
    }

    var allowedLocales = ['en', 'pt', 'pt-br', 'es', 'it'];
    var normalizedLang = urlLang === 'pt-br' ? 'pt' : urlLang;
    if (urlLang && allowedLocales.indexOf(urlLang) !== -1) {
      try {
        localStorage.setItem(STORAGE_PREFIX + 'lang', normalizedLang);
      } catch (e) {}
    }

    var locale =
      urlLang === 'pt-br' || urlLang === 'pt'
        ? 'pt'
        : urlLang === 'es'
          ? 'es'
          : urlLang === 'it'
            ? 'it'
            : savedLang === 'pt'
              ? 'pt'
              : savedLang === 'es'
                ? 'es'
                : savedLang === 'it'
                  ? 'it'
                  : 'en';

    root.dataset.locale = locale;
    root.lang = locale;

    /* URL wins: if page has ?lang=, ensure data-locale matches so the correct .locale-* block is shown (es vs it). */
    if (urlLang && allowedLocales.indexOf(urlLang) !== -1) {
      var urlLocale = urlLang === 'pt-br' ? 'pt' : urlLang;
      root.dataset.locale = urlLocale;
      root.lang = urlLocale;
    }
  }

  applyThemeFromStorage();
  resolveLocaleFromUrlAndStorage();
})();
