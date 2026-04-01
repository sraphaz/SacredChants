/**
 * Discovers same-origin URLs that the current document depends on for offline rendering.
 */

const LINKED_ASSET_SELECTOR = [
  'link[rel="stylesheet"][href]',
  'link[rel="preload"][href]',
  'script[src]',
  'link[rel="icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="manifest"][href]',
].join(', ');

export function documentBaseHref() {
  const base = document.querySelector('base');
  return base?.href ? base.href : `${globalThis.location.origin}/`;
}

export function toAbsoluteUrl(maybeRelative, baseHref) {
  try {
    return new URL(maybeRelative, baseHref).href;
  } catch {
    return maybeRelative;
  }
}

export function isSameOrigin(href) {
  try {
    return new URL(href).origin === globalThis.location.origin;
  } catch {
    return false;
  }
}

export function collectDomLinkedAssetUrls(baseHref) {
  const seen = Object.create(null);
  document.querySelectorAll(LINKED_ASSET_SELECTOR).forEach((el) => {
    const raw = el.getAttribute('href') || el.getAttribute('src');
    if (!raw) return;
    const absolute = toAbsoluteUrl(raw, baseHref);
    if (!isSameOrigin(absolute)) return;
    seen[absolute] = true;
  });
  return Object.keys(seen);
}

export function collectMainImageUrls(baseHref, intoSet) {
  document.querySelectorAll('main img[src]').forEach((img) => {
    const raw = img.getAttribute('src');
    if (!raw) return;
    const absolute = toAbsoluteUrl(raw, baseHref);
    if (isSameOrigin(absolute)) intoSet.add(absolute);
  });
}

export function coreShellUrls(baseHref) {
  const names = [
    'favicon.png',
    'apple-touch-icon.png',
    'brand/icon-192.png',
    'brand/icon-512.png',
    'manifest.webmanifest',
    'sw.js',
  ];
  return names.map((name) => toAbsoluteUrl(name, baseHref));
}

/**
 * @param {HTMLButtonElement} saveButton
 */
export function resolvedPageUrlForButton(saveButton) {
  const baseHref = documentBaseHref();
  return toAbsoluteUrl(
    saveButton.getAttribute('data-page-url') || globalThis.location.href,
    baseHref
  );
}

/**
 * @param {HTMLButtonElement} saveButton
 * @returns {string[]}
 */
export function buildUrlListForSaveButton(saveButton) {
  const baseHref = documentBaseHref();
  const pageUrl = resolvedPageUrlForButton(saveButton);
  const urls = new Set();
  urls.add(pageUrl);
  collectDomLinkedAssetUrls(baseHref).forEach((u) => urls.add(u));
  coreShellUrls(baseHref).forEach((u) => urls.add(u));
  collectMainImageUrls(baseHref, urls);
  const audio = saveButton.getAttribute('data-audio-url');
  if (audio) urls.add(toAbsoluteUrl(audio, baseHref));
  return Array.from(urls);
}
