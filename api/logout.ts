import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookieHeader } from './lib/session.js';

const CONTRIBUTE_ORIGIN = process.env.CONTRIBUTE_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4321');

/**
 * GET or POST /api/logout — clears session cookie and redirects to the contribute app root.
 * @param req - Vercel request (method GET or POST)
 * @param res - Vercel response; Set-Cookie clear + 302 to CONTRIBUTE_ORIGIN/contribute/
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Set-Cookie', clearSessionCookieHeader());
  res.setHeader('Location', `${CONTRIBUTE_ORIGIN}/contribute/`);
  res.status(302).end();
}
