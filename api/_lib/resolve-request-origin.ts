import type { VercelRequest } from '@vercel/node';

/**
 * Origin of the incoming request when Host is localhost / 127.0.0.1.
 * Used so `vercel dev` ignores production CONTRIBUTE_ORIGIN / API_ORIGIN
 * injected from the linked Vercel project.
 */
export function resolveLocalRequestOrigin(req: VercelRequest): string | null {
  const rawHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (typeof host !== 'string' || !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return null;
  }
  const rawProto = req.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(rawProto) ? rawProto[0] : rawProto)?.split(',')[0]?.trim() || 'http';
  return `${proto}://${host}`;
}

/**
 * Site origin for post-login redirects and OAuth state fallback.
 * On localhost, always the request host — never production app.sacredchants.org
 * even when the Vercel project env still has CONTRIBUTE_ORIGIN=https://app…
 */
export function resolveContributeOrigin(req: VercelRequest): string {
  const local = resolveLocalRequestOrigin(req);
  if (local) return local;
  if (process.env.CONTRIBUTE_ORIGIN) return process.env.CONTRIBUTE_ORIGIN.replace(/\/$/, '');
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/$/, '');
  return 'http://localhost:3000';
}

/**
 * API origin for GitHub OAuth redirect_uri.
 * Prefer localhost request host so callback stays on the same vercel-dev port.
 */
export function resolveApiOrigin(req: VercelRequest): string {
  const local = resolveLocalRequestOrigin(req);
  if (local) return local;
  if (process.env.API_ORIGIN) return process.env.API_ORIGIN.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
