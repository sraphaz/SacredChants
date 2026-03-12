import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionCookie, verifySession } from './lib/session.js';

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
