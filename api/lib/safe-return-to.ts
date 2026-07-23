/**
 * Safe post-login redirect path for GitHub OAuth.
 * Allows in-site paths (chants, contribute, report return, etc.); rejects open redirects.
 */
export function safeReturnTo(returnTo: string | undefined, fallback = '/'): string {
  if (typeof returnTo !== 'string' || !returnTo) return fallback;
  const trimmed = returnTo.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('://')) return fallback;
  if (/[\u0000-\u001f]/.test(trimmed)) return fallback;
  // Disallow backslash tricks / encoded hosts
  if (trimmed.includes('\\')) return fallback;
  return trimmed;
}

/**
 * Allowed post-login site origins (Pages, app subdomain, local vercel/astro).
 * Prevents open redirects when returnOrigin is passed in OAuth state.
 */
export function safeReturnOrigin(
  returnOrigin: string | undefined,
  fallback: string
): string {
  if (typeof returnOrigin !== 'string' || !returnOrigin) return fallback;
  let origin: string;
  try {
    origin = new URL(returnOrigin).origin;
  } catch {
    return fallback;
  }

  const allowed = new Set(
    [
      fallback,
      process.env.CONTRIBUTE_ORIGIN,
      process.env.SITE_ORIGIN,
      process.env.API_ORIGIN,
      'https://sacredchants.org',
      'https://www.sacredchants.org',
      'https://app.sacredchants.org',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map((v) => {
        try {
          return new URL(v).origin;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
  );

  return allowed.has(origin) ? origin : fallback;
}
