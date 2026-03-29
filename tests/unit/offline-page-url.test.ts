import { describe, expect, it } from 'vitest';
import { buildCanonicalPageUrl } from '../../src/utils/offline-page-url';

describe('buildCanonicalPageUrl', () => {
  it('uses Astro site origin when provided', () => {
    const site = new URL('https://sacredchants.org/base/');
    expect(
      buildCanonicalPageUrl(site, '/chants/gayatri/', '?lang=pt')
    ).toBe('https://sacredchants.org/chants/gayatri/?lang=pt');
  });

  it('joins pathname and search only', () => {
    const site = new URL('https://example.com');
    expect(buildCanonicalPageUrl(site, '/foo', '?x=1')).toBe(
      'https://example.com/foo?x=1'
    );
  });
});
