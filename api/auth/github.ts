import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadLocalEnv } from '../lib/load-local-env.js';
import { encodeOAuthState } from '../lib/oauth-state.js';
import { resolveApiOrigin, resolveContributeOrigin } from '../lib/resolve-request-origin.js';
import { safeReturnOrigin, safeReturnTo } from '../lib/safe-return-to.js';

/**
 * GET /api/auth/github — redirects the user to GitHub OAuth authorization.
 * Query: returnTo (optional path), returnOrigin (optional site origin for post-login redirect).
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  loadLocalEnv();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  if (!githubClientId) {
    return res.status(500).json({
      error: 'GitHub OAuth not configured',
      hint: 'Set GITHUB_CLIENT_ID in .env.local (local OAuth App) and restart npm run dev:vercel',
    });
  }
  const contributeOrigin = resolveContributeOrigin(req);
  const returnTo = safeReturnTo(
    typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined,
    '/'
  );
  const returnOrigin = safeReturnOrigin(
    typeof req.query.returnOrigin === 'string' ? req.query.returnOrigin : undefined,
    contributeOrigin
  );
  const redirectUri = `${resolveApiOrigin(req)}/api/auth/callback`;
  const scope = 'read:user user:email';
  const state = encodeOAuthState(returnTo, returnOrigin);
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(githubClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  res.setHeader('Location', url);
  res.status(302).end();
}
