import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOctokit } from '../lib/github.js';
import { getSessionCookie, verifySession } from '../lib/session.js';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sraphaz';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'SacredChants';

/**
 * POST /api/contribute/close — closes a contribution PR if the authenticated user is the author.
 * Body: { prNumber: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const prNumber = typeof (body as { prNumber?: number }).prNumber === 'number' ? (body as { prNumber: number }).prNumber : null;
  if (prNumber == null || prNumber < 1) {
    return res.status(400).json({ error: 'prNumber is required and must be a positive number' });
  }

  try {
    const octokit = getOctokit();
    const { data: pr } = await octokit.rest.pulls.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      pull_number: prNumber,
    });

    if (pr.state !== 'open') {
      return res.status(400).json({ error: 'PR is not open', details: 'Only open PRs can be closed.' });
    }

    const authorLogin = pr.user?.login;
    if (authorLogin !== user.login) {
      return res.status(403).json({ error: 'Forbidden', details: 'Only the PR author can close this PR.' });
    }

    await octokit.rest.pulls.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      pull_number: prNumber,
      state: 'closed',
    });

    return res.status(200).json({ ok: true, message: 'PR closed', prNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to close PR';
    return res.status(500).json({ error: message });
  }
}
