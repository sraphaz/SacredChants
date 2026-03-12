import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSession, setSessionCookieHeader } from '../lib/session.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
/** Site origin where user is sent after login (Astro app). */
const CONTRIBUTE_ORIGIN = process.env.CONTRIBUTE_ORIGIN || 'http://localhost:4321';

/**
 * GET /api/auth/callback — OAuth callback for GitHub sign-in.
 * Exchanges `code` for access token, fetches user, creates session cookie, redirects to CONTRIBUTE_ORIGIN/contribute/.
 * @param req - Vercel request; query.code = OAuth authorization code from GitHub
 * @param res - Vercel response; 302 redirect to contribute app or error=config|access_denied
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  if (!code || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    res.setHeader('Location', `${CONTRIBUTE_ORIGIN}/contribute?error=config`);
    res.status(302).end();
    return;
  }
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (tokenData.error || !tokenData.access_token) {
    res.setHeader('Location', `${CONTRIBUTE_ORIGIN}/contribute?error=access_denied`);
    res.status(302).end();
    return;
  }
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) {
    res.setHeader('Location', `${CONTRIBUTE_ORIGIN}/contribute?error=user`);
    res.status(302).end();
    return;
  }
  const user = (await userRes.json()) as { id: number; login: string; avatar_url: string | null; name: string | null };
  const sessionToken = await createSession({
    id: user.id,
    login: user.login,
    avatar_url: user.avatar_url ?? null,
    name: user.name ?? null,
  });
  res.setHeader('Set-Cookie', setSessionCookieHeader(sessionToken));
  res.setHeader('Location', `${CONTRIBUTE_ORIGIN}/contribute/`);
  res.status(302).end();
}
