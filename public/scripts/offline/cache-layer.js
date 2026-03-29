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
 * @param {string} slug
 * @returns {string[] | null}
 */
export function readStoredUrlList(slug) {
  try {
    const raw = localStorage.getItem(storageKeyForSlug(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} slug
 * @param {string[]} urls
 */
export function writeStoredUrlList(slug, urls) {
  localStorage.setItem(storageKeyForSlug(slug), JSON.stringify(urls));
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

export function ensureServiceWorkerActivated() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  return navigator.serviceWorker.ready;
}
