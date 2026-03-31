import { describe, expect, it } from 'vitest';
import { buildCanonicalPageUrl } from '../../src/utils/offline-page-url';

describe('buildCanonicalPageUrl', () => {
  it('uses request origin', () => {
    expect(
      buildCanonicalPageUrl('https://sacredchants.org', '/chants/gayatri/', '?lang=pt')
    ).toBe('https://sacredchants.org/chants/gayatri/?lang=pt');
  });

  it('joins pathname and search', () => {
    expect(buildCanonicalPageUrl('https://example.com', '/foo', '?x=1')).toBe(
      'https://example.com/foo?x=1'
    );
  });

  it('normalizes origin without trailing slash', () => {
    expect(buildCanonicalPageUrl('http://localhost:4321', '/', '')).toBe(
      'http://localhost:4321/'
    );
  });
});
