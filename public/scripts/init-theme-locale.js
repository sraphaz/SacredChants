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
      window.location.replace(window.location.pathname + (queryString ? '?' + queryString : ''));
      return;
    }

    var allowedLocales = ['en', 'pt', 'pt-br', 'es', 'it'];
    if (urlLang && allowedLocales.indexOf(urlLang) !== -1) {
      try {
        localStorage.setItem(STORAGE_PREFIX + 'lang', urlLang === 'pt-br' ? 'pt' : urlLang);
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
  }

  applyThemeFromStorage();
  resolveLocaleFromUrlAndStorage();
})();
