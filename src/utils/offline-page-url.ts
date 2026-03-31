/**
 * Absolute URL for the current path+search using the request origin (e.g. `Astro.url.origin`).
 * Ties offline cache keys to the environment that served the page (localhost vs production).
 */

export function buildCanonicalPageUrl(
  requestOrigin: string,
  pathname: string,
  search: string
): string {
  const base = requestOrigin.endsWith('/') ? requestOrigin : `${requestOrigin}/`;
  return new URL(pathname + search, base).href;
}
