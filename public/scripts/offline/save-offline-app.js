/**
 * Wires save/remove offline toggles to the cache layer. One reason to change: UX rules for this feature.
 */

import {
  buildUrlListForSaveButton,
  resolvedPageUrlForButton,
} from './document-assets.js';
import {
  clearStoredUrlList,
  deleteStaleOfflineCaches,
  deleteUrlsFromOfflineCache,
  ensureServiceWorkerActivated,
  readStoredUrlList,
  storeUrlsInOfflineCache,
  writeStoredUrlList,
} from './cache-layer.js';

const SAVED = 'true';

function slugFromButton(button) {
  return button.getAttribute('data-slug') || '';
}

function messageForLocale(button, kind) {
  const locale = document.documentElement.dataset.locale || 'en';
  const direct = button.getAttribute(`data-offline-${kind}-${locale}`);
  if (direct) return direct;
  return button.getAttribute(`data-offline-${kind}-en`) || '';
}

function setSavedAppearance(button, saved) {
  button.setAttribute('data-saved', saved ? SAVED : 'false');
  button.setAttribute('aria-pressed', saved ? SAVED : 'false');
}

function setBusyAppearance(button, busy) {
  button.disabled = busy;
  if (busy) button.setAttribute('data-busy', SAVED);
  else button.removeAttribute('data-busy');
}

function setFeedback(button, text) {
  const id = button.getAttribute('aria-describedby');
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
}

function clearFeedbackSoon(button, ms) {
  globalThis.setTimeout(() => setFeedback(button, ''), ms);
}

async function saveBundle(button) {
  const slug = slugFromButton(button);
  const urls = buildUrlListForSaveButton(button);
  const pageUrl = resolvedPageUrlForButton(button);
  setBusyAppearance(button, true);
  setFeedback(button, '');
  try {
    await ensureServiceWorkerActivated();
    const { documentCached, failedCount } = await storeUrlsInOfflineCache(urls, pageUrl);
    if (!documentCached) {
      setFeedback(button, messageForLocale(button, 'fail'));
      clearFeedbackSoon(button, 6000);
      return;
    }
    writeStoredUrlList(slug, urls);
    setSavedAppearance(button, true);
    if (failedCount > 0) {
      setFeedback(button, messageForLocale(button, 'partial'));
      clearFeedbackSoon(button, 8000);
    }
  } catch {
    setFeedback(button, messageForLocale(button, 'fail'));
    clearFeedbackSoon(button, 6000);
  } finally {
    setBusyAppearance(button, false);
  }
}

async function removeBundle(button) {
  const slug = slugFromButton(button);
  const urls = readStoredUrlList(slug);
  setBusyAppearance(button, true);
  setFeedback(button, '');
  try {
    if (urls?.length) await deleteUrlsFromOfflineCache(urls);
    clearStoredUrlList(slug);
    setSavedAppearance(button, false);
  } finally {
    setBusyAppearance(button, false);
  }
}

function restoreSavedAppearance(button) {
  const slug = slugFromButton(button);
  if (readStoredUrlList(slug)) setSavedAppearance(button, true);
}

function onToggleClick(button) {
  if (button.getAttribute('data-saved') === SAVED) {
    void removeBundle(button);
    return;
  }
  void saveBundle(button);
}

/**
 * @param {HTMLButtonElement} button
 */
function bindSaveOfflineButton(button) {
  restoreSavedAppearance(button);
  button.addEventListener('click', () => onToggleClick(button));
}

export async function initSaveOfflineControls() {
  if (!('caches' in globalThis)) return;
  await deleteStaleOfflineCaches();
  document.querySelectorAll('[data-save-offline]').forEach((el) => {
    if (el instanceof HTMLButtonElement) bindSaveOfflineButton(el);
  });
}
