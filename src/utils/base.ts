/**
 * Base URL utilities for the site. Single source of truth for FULL_BASE
 * (origin + base path) used in layouts and pages. Aligns with Clean Code
 * DRY and Design Patterns Facade.
 */

const BASE = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
  ? (import.meta.env.BASE_URL as string)
  : '/';

/** Base path with trailing slash (e.g. '/' or '/base/'). Use for pathname logic. */
export const getBasePath = (): string =>
  BASE.endsWith('/') ? BASE : BASE + '/';

/**
 * Returns the full base URL of the site (origin + base path).
 * Use for absolute hrefs (e.g. /chants/, /knowledge/).
 *
 * @param url - Typically Astro.url or request URL (must have .origin)
 * @returns e.g. "https://example.com/" or "https://example.com/base/"
 */
export function getFullBase(url: { origin: string }): string {
  const basePath = getBasePath();
  const path = basePath.startsWith('/') ? basePath : '/' + basePath;
  return url.origin + path;
}
