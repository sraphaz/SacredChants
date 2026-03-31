/**
 * Cache API + localStorage bundle index. No UI concerns.
 */

import {
  OFFLINE_CACHE_NAME,
  OFFLINE_CACHE_NAME_PATTERN,
  BUNDLE_STORAGE_KEY_PREFIX,
} from './constants.js';

export async function deleteStaleOfflineCaches() {
  if (!('caches' in globalThis)) return;
  const keys = await caches.keys();
  const deletions = keys
    .filter((name) => OFFLINE_CACHE_NAME_PATTERN.test(name) && name !== OFFLINE_CACHE_NAME)
    .map((name) => caches.delete(name));
  await Promise.all(deletions);
}

/**
 * @param {string} slug
 */
export function storageKeyForSlug(slug) {
  return `${BUNDLE_STORAGE_KEY_PREFIX}${slug}`;
}

/**
 * @typedef {{ documentUrl: string | null; urls: string[] | null }} StoredBundle
 */

/**
 * Reads bundle index: v2 `{ documentUrl, urls }` or legacy `string[]` (urls only).
 * @param {string} slug
 * @returns {StoredBundle}
 */
export function readStoredBundle(slug) {
  try {
    const raw = localStorage.getItem(storageKeyForSlug(slug));
    if (!raw) return { documentUrl: null, urls: null };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { documentUrl: null, urls: parsed };
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.urls)) {
      const documentUrl =
        typeof parsed.documentUrl === 'string' && parsed.documentUrl.length > 0
          ? parsed.documentUrl
          : null;
      return { documentUrl, urls: parsed.urls };
    }
    return { documentUrl: null, urls: null };
  } catch {
    return { documentUrl: null, urls: null };
  }
}

/**
 * @param {string} slug
 * @returns {string[] | null}
 */
export function readStoredUrlList(slug) {
  return readStoredBundle(slug).urls;
}

/**
 * @param {string} slug
 * @param {string} documentUrl canonical page URL (search/hash) used when caching
 * @param {string[]} urls
 */
export function writeStoredBundle(slug, documentUrl, urls) {
  localStorage.setItem(
    storageKeyForSlug(slug),
    JSON.stringify({ documentUrl, urls })
  );
}

/**
 * URLs from `urls` that are not listed in any other stored bundle (avoids deleting shared assets).
 * @param {string} removedSlug
 * @param {string[]} urls
 * @returns {string[]}
 */
export function urlsSafeToRemoveFromCache(removedSlug, urls) {
  if (!urls?.length) return [];
  const referencedElsewhere = new Set();
  for (const other of listStoredOfflineSlugs()) {
    if (other === removedSlug) continue;
    const list = readStoredUrlList(other);
    if (!list) continue;
    for (const u of list) referencedElsewhere.add(u);
  }
  return urls.filter((u) => !referencedElsewhere.has(u));
}

/**
 * @param {string} slug
 */
export function clearStoredUrlList(slug) {
  localStorage.removeItem(storageKeyForSlug(slug));
}

/**
 * @returns {string[]} slugs that have a bundle index (may include __chants-index__)
 */
export function listStoredOfflineSlugs() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(BUNDLE_STORAGE_KEY_PREFIX)) {
        out.push(key.slice(BUNDLE_STORAGE_KEY_PREFIX.length));
      }
    }
  } catch {
    return out;
  }
  return out;
}

function requestOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

function isRequestSameOrigin(url) {
  return requestOrigin(url) === globalThis.location.origin;
}

/**
 * @param {string} url
 */
async function fetchAndStore(cache, url) {
  if (isRequestSameOrigin(url)) {
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) return { url, ok: false };
      await cache.put(url, response.clone());
      return { url, ok: true };
    } catch {
      return { url, ok: false };
    }
  }

  try {
    const corsResponse = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (corsResponse.ok) {
      await cache.put(url, corsResponse.clone());
      return { url, ok: true };
    }
  } catch {
    /* not CORS-accessible */
  }

  try {
    const opaque = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
    await cache.put(url, opaque.clone());
    return { url, ok: true };
  } catch {
    return { url, ok: false };
  }
}

/**
 * @param {string[]} urls
 * @param {string} pageUrl
 * @returns {Promise<{ documentCached: boolean; failedCount: number }>}
 */
export async function storeUrlsInOfflineCache(urls, pageUrl) {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const results = await Promise.all(urls.map((u) => fetchAndStore(cache, u)));
  const failedCount = results.filter((r) => !r.ok).length;
  const matched = await cache.match(pageUrl);
  return {
    documentCached: Boolean(matched),
    failedCount,
  };
}

/**
 * @param {string[]} urls
 */
export async function deleteUrlsFromOfflineCache(urls) {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  await Promise.all(urls.map((u) => cache.delete(u)));
}

const SW_READY_TIMEOUT_MS = 12_000;

/**
 * Waits for an active service worker, but does not block the UI indefinitely.
 */
export function ensureServiceWorkerActivated() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => {
      setTimeout(resolve, SW_READY_TIMEOUT_MS);
    }),
  ]).then(() => undefined);
}
