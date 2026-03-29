/**
 * Canonical absolute URL for offline bundles (stable across build hosts when `site` is set).
 */

export function buildCanonicalPageUrl(
  site: URL | undefined,
  pathname: string,
  search: string
): string {
  const originAndPath = site ?? new URL('https://example.com');
  return new URL(pathname + search, originAndPath).href;
}
