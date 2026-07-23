import { safeReturnOrigin, safeReturnTo } from './safe-return-to.js';

export type OAuthReturn = { returnTo: string; returnOrigin: string };

/** Encode OAuth state: return path + allowed site origin (same browser host after login). */
export function encodeOAuthState(returnTo: string, returnOrigin: string): string {
  const payload = { r: returnTo, o: returnOrigin, n: Math.random().toString(36).slice(2) };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Decode OAuth state → safe path + allowed site origin.
 * Bug reports use home/chant paths with ?report=1; never force /contribute/.
 */
export function decodeOAuthState(
  state: string | undefined,
  fallbackOrigin: string
): OAuthReturn {
  if (typeof state !== 'string' || !state) {
    return { returnTo: '/', returnOrigin: fallbackOrigin };
  }
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      r?: unknown;
      o?: unknown;
    };
    return {
      returnTo: safeReturnTo(typeof payload?.r === 'string' ? payload.r : undefined, '/'),
      returnOrigin: safeReturnOrigin(
        typeof payload?.o === 'string' ? payload.o : undefined,
        fallbackOrigin
      ),
    };
  } catch {
    return { returnTo: '/', returnOrigin: fallbackOrigin };
  }
}

/** Final Location after login (or OAuth error) — always returnOrigin + returnTo. */
export function postLoginLocation(returnOrigin: string, returnTo: string, error?: string): string {
  if (!error) return `${returnOrigin}${returnTo}`;
  const join = returnTo.includes('?') ? '&' : '?';
  return `${returnOrigin}${returnTo}${join}error=${encodeURIComponent(error)}`;
}
