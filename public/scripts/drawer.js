/**
 * Header drawer (mobile menu): open/close, backdrop, Escape key, link click.
 * Valid locales and DOM IDs are defined in BaseLayout; this script is loaded after the header markup.
 */
(function () {
  var header = document.getElementById('sc-header');
  var toggle = document.getElementById('sc-header-menu-toggle');
  var drawer = document.getElementById('sc-header-drawer');
  var backdrop = document.getElementById('sc-header-drawer-backdrop');
  if (!header || !toggle || !drawer) return;

  function open() {
    document.body.classList.add('sc-drawer-open');
    header.classList.add('sc-header--open');
    drawer.classList.add('sc-header__drawer--open');
    if (backdrop) backdrop.classList.add('sc-header__drawer-backdrop--open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
  }

  function close() {
    document.body.classList.remove('sc-drawer-open');
    header.classList.remove('sc-header--open');
    drawer.classList.remove('sc-header__drawer--open');
    if (backdrop) backdrop.classList.remove('sc-header__drawer-backdrop--open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
  }

  toggle.addEventListener('click', function () {
    if (drawer.classList.contains('sc-header__drawer--open')) close();
    else open();
  });
  if (backdrop) backdrop.addEventListener('click', close);
  drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('sc-header__drawer--open')) close();
  });
})();
