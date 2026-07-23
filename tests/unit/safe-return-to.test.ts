import { describe, expect, it } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import {
  decodeOAuthState,
  encodeOAuthState,
  postLoginLocation,
} from '../../api/lib/oauth-state';
import {
  resolveApiOrigin,
  resolveContributeOrigin,
  resolveLocalRequestOrigin,
} from '../../api/lib/resolve-request-origin';
import { safeReturnOrigin, safeReturnTo } from '../../api/lib/safe-return-to';

function req(host: string, proto?: string): VercelRequest {
  return {
    headers: {
      host,
      ...(proto ? { 'x-forwarded-proto': proto } : {}),
    },
  } as VercelRequest;
}

describe('safeReturnTo', () => {
  it('allows in-site paths with query (bug report resume)', () => {
    expect(safeReturnTo('/?lang=pt&report=1', '/')).toBe('/?lang=pt&report=1');
    expect(safeReturnTo('/chants/foo/?lang=en&report=1', '/')).toBe(
      '/chants/foo/?lang=en&report=1'
    );
  });

  it('allows contribute paths (chant submission login)', () => {
    expect(safeReturnTo('/contribute/?lang=pt', '/')).toBe('/contribute/?lang=pt');
    expect(safeReturnTo('/contribute/form/', '/')).toBe('/contribute/form/');
  });

  it('rejects open redirects', () => {
    expect(safeReturnTo('//evil.test', '/')).toBe('/');
    expect(safeReturnTo('https://evil.test/', '/')).toBe('/');
  });
});

describe('safeReturnOrigin', () => {
  it('allows localhost and app origins', () => {
    expect(safeReturnOrigin('http://localhost:3000', 'https://app.sacredchants.org')).toBe(
      'http://localhost:3000'
    );
    expect(safeReturnOrigin('https://app.sacredchants.org', 'http://localhost:3000')).toBe(
      'https://app.sacredchants.org'
    );
  });

  it('rejects unknown origins', () => {
    expect(safeReturnOrigin('https://evil.test', 'https://app.sacredchants.org')).toBe(
      'https://app.sacredchants.org'
    );
  });
});

describe('resolveContributeOrigin / resolveApiOrigin (local vercel)', () => {
  it('uses localhost request host even when production CONTRIBUTE_ORIGIN is set', () => {
    const prev = process.env.CONTRIBUTE_ORIGIN;
    const prevApi = process.env.API_ORIGIN;
    process.env.CONTRIBUTE_ORIGIN = 'https://app.sacredchants.org';
    process.env.API_ORIGIN = 'https://app.sacredchants.org';
    try {
      expect(resolveLocalRequestOrigin(req('localhost:3000'))).toBe('http://localhost:3000');
      expect(resolveContributeOrigin(req('localhost:3000'))).toBe('http://localhost:3000');
      expect(resolveApiOrigin(req('localhost:3000'))).toBe('http://localhost:3000');
      expect(resolveContributeOrigin(req('127.0.0.1:3000'))).toBe('http://127.0.0.1:3000');
    } finally {
      if (prev === undefined) delete process.env.CONTRIBUTE_ORIGIN;
      else process.env.CONTRIBUTE_ORIGIN = prev;
      if (prevApi === undefined) delete process.env.API_ORIGIN;
      else process.env.API_ORIGIN = prevApi;
    }
  });

  it('falls back to env for non-local hosts', () => {
    const prev = process.env.CONTRIBUTE_ORIGIN;
    process.env.CONTRIBUTE_ORIGIN = 'https://app.sacredchants.org';
    try {
      expect(resolveContributeOrigin(req('app.sacredchants.org', 'https'))).toBe(
        'https://app.sacredchants.org'
      );
    } finally {
      if (prev === undefined) delete process.env.CONTRIBUTE_ORIGIN;
      else process.env.CONTRIBUTE_ORIGIN = prev;
    }
  });
});

describe('OAuth state round-trip (bug report must not land on /contribute/)', () => {
  it('encodes returnOrigin + home returnTo and decodes to same-page Location', () => {
    const returnTo = '/?lang=pt&report=1';
    const returnOrigin = 'http://localhost:3000';
    const state = encodeOAuthState(returnTo, returnOrigin);
    const decoded = decodeOAuthState(state, 'https://app.sacredchants.org');
    expect(decoded.returnTo).toBe(returnTo);
    expect(decoded.returnOrigin).toBe(returnOrigin);
    const location = postLoginLocation(decoded.returnOrigin, decoded.returnTo);
    expect(location).toBe('http://localhost:3000/?lang=pt&report=1');
    expect(location).not.toMatch(/\/contribute/);
  });

  it('uses returnOrigin from state even when CONTRIBUTE_ORIGIN fallback is app subdomain', () => {
    const state = encodeOAuthState('/?lang=en&report=1', 'https://app.sacredchants.org');
    const decoded = decodeOAuthState(state, 'https://app.sacredchants.org');
    expect(postLoginLocation(decoded.returnOrigin, decoded.returnTo)).toBe(
      'https://app.sacredchants.org/?lang=en&report=1'
    );
    expect(decoded.returnTo).not.toMatch(/^\/contribute/);
  });

  it('keeps contribute returnTo for form login', () => {
    const state = encodeOAuthState('/contribute/form/?lang=pt', 'https://app.sacredchants.org');
    const decoded = decodeOAuthState(state, 'http://localhost:3000');
    expect(postLoginLocation(decoded.returnOrigin, decoded.returnTo)).toBe(
      'https://app.sacredchants.org/contribute/form/?lang=pt'
    );
  });

  it('appends error on same return path (not /contribute/)', () => {
    expect(postLoginLocation('http://localhost:3000', '/?lang=pt&report=1', 'config')).toBe(
      'http://localhost:3000/?lang=pt&report=1&error=config'
    );
  });
});
