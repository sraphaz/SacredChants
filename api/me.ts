import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionCookie, verifySession } from './lib/session.js';

/**
 * GET /api/me — returns the current authenticated user (id, login, avatar_url, name).
 * Requires valid session cookie from GitHub OAuth.
 * @param req - Vercel request (must include session cookie)
 * @param res - Vercel response; 200 with user object or 401 if not authenticated
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const token = getSessionCookie(req);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = await verifySession(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    id: user.id,
    login: user.login,
    avatar_url: user.avatar_url,
    name: user.name,
  });
}
