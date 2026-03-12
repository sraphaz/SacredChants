import type { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
/** Base URL of this API (GitHub redirects here). e.g. https://api.sacredchants.org or https://xxx.vercel.app */
const API_ORIGIN = process.env.API_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/** Allowed redirect path after login: must start with /contribute and contain no protocol (no //). */
function safeReturnTo(returnTo: string | undefined): string {
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/contribute') || returnTo.includes('//')) {
    return '/contribute/';
  }
  return returnTo.startsWith('/contribute/') || returnTo === '/contribute' ? returnTo : '/contribute/';
}

/** Encode state for GitHub OAuth: includes returnTo so callback can redirect user to the page they wanted. */
function encodeState(returnTo: string): string {
  const payload = { r: returnTo, n: Math.random().toString(36).slice(2) };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * GET /api/auth/github — redirects the user to GitHub OAuth authorization.
 * Query: returnTo (optional) — path to redirect after login, e.g. /contribute/form/. Must start with /contribute.
 * Callback is API_ORIGIN/api/auth/callback. Requires GITHUB_CLIENT_ID.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }
  const returnTo = safeReturnTo(typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined);
  const redirectUri = `${API_ORIGIN}/api/auth/callback`;
  const scope = 'read:user user:email';
  const state = encodeState(returnTo);
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  res.setHeader('Location', url);
  res.status(302).end();
}
