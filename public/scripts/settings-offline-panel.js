/**
 * Renders the list of offline bundle slugs on the settings page.
 */

import { listStoredOfflineSlugs } from './offline/cache-layer.js';
import { documentBaseHref, toAbsoluteUrl } from './offline/document-assets.js';

function chantPathForSlug(slug) {
  if (slug === '__chants-index__') return 'chants/';
  return `chants/${slug}/`;
}

function localizedChantsIndexLabel() {
  const locale = document.documentElement.dataset.locale || 'en';
  const root = document.getElementById('settings-offline-chants-index-label');
  if (!root) return 'All chants (list)';
  const span =
    root.querySelector('.locale-' + locale) || root.querySelector('.locale-en');
  return span && span.textContent ? span.textContent.trim() : 'All chants (list)';
}

function linkLabelForSlug(slug) {
  if (slug === '__chants-index__') return localizedChantsIndexLabel();
  return slug;
}

export function renderOfflineSavedList(listEl, emptyEl, baseHref) {
  if (!listEl || !emptyEl) return;
  const slugs = listStoredOfflineSlugs().sort();
  listEl.innerHTML = '';
  if (slugs.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;
  listEl.hidden = false;
  const ul = document.createElement('ul');
  ul.className = 'settings-offline-list space-y-2 text-sm';
  slugs.forEach((slugItem) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = toAbsoluteUrl(chantPathForSlug(slugItem), baseHref);
    a.textContent = linkLabelForSlug(slugItem);
    a.className = 'underline hover:opacity-90';
    a.style.color = 'var(--sc-text-muted)';
    li.appendChild(a);
    ul.appendChild(li);
  });
  listEl.appendChild(ul);
}

export function initSettingsOfflinePanel() {
  const listEl = document.getElementById('settings-offline-saved-list');
  const emptyEl = document.getElementById('settings-offline-empty');
  const unsupportedEl = document.getElementById('settings-offline-unsupported');
  if (!listEl || !emptyEl) return;
  if (!('caches' in globalThis)) {
    if (unsupportedEl) unsupportedEl.hidden = false;
    emptyEl.hidden = true;
    listEl.hidden = true;
    return;
  }
  if (unsupportedEl) unsupportedEl.hidden = true;
  renderOfflineSavedList(listEl, emptyEl, documentBaseHref());
}

void initSettingsOfflinePanel();
