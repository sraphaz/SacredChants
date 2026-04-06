/**
 * Locale select: persist choice in localStorage, update URL and reload.
 * Valid locales come from data-supported-locales on the select (synced from i18n/strings SUPPORTED_LOCALES).
 */
(function () {
  var STORAGE_LANG_KEY = 'sacred-chants-lang';

  function onLocaleChange() {
    var lang = this.value;
    try {
      if (lang === 'en') localStorage.removeItem(STORAGE_LANG_KEY);
      else localStorage.setItem(STORAGE_LANG_KEY, lang);
    } catch (e) {}
    var params = new URLSearchParams(window.location.search);
    if (lang === 'en') params.delete('lang');
    else params.set('lang', lang);
    var qs = params.toString();
    var url = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
    window.location.href = url;
  }

  var sel = document.getElementById('sc-locale-select');
  var selDrawer = document.getElementById('sc-locale-select-drawer');
  var valid =
    sel && sel.getAttribute('data-supported-locales')
      ? JSON.parse(sel.getAttribute('data-supported-locales'))
      : ['en', 'pt', 'es', 'it', 'hi'];
  var locale = document.documentElement.dataset.locale;
  if (!locale || valid.indexOf(locale) === -1) locale = 'en';

  if (sel) {
    if (valid.indexOf(sel.value) === -1) sel.value = 'en';
    else if (sel.value !== locale) sel.value = locale;
  }
  if (selDrawer) {
    if (valid.indexOf(selDrawer.value) === -1) selDrawer.value = 'en';
    else if (selDrawer.value !== locale) selDrawer.value = locale;
  }
  if (sel) sel.addEventListener('change', onLocaleChange);
  if (selDrawer) selDrawer.addEventListener('change', onLocaleChange);
})();
