import type { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
/** Base URL of this API (GitHub redirects here). e.g. https://api.sacredchants.org or https://xxx.vercel.app */
const API_ORIGIN = process.env.API_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * GET /api/auth/github — redirects the user to GitHub OAuth authorization.
 * Callback is API_ORIGIN/api/auth/callback. Requires GITHUB_CLIENT_ID.
 * @param req - Vercel request (GET)
 * @param res - Vercel response; 302 to GitHub or 500 if not configured
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!GITHUB_CLIENT_ID) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }
  const redirectUri = `${API_ORIGIN}/api/auth/callback`;
  const scope = 'read:user user:email';
  const state = Math.random().toString(36).slice(2);
  const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  res.setHeader('Location', url);
  res.status(302).end();
}
