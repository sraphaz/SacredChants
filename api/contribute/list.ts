import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getOctokit } from '../lib/github.js';
import { getSessionCookie, verifySession } from '../lib/session.js';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sraphaz';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'SacredChants';

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

  try {
    const octokit = getOctokit();
    const { data: pulls } = await octokit.rest.pulls.list({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'all',
      sort: 'created',
      direction: 'desc',
      per_page: 50,
    });

    const contributionPRs = pulls.filter(
      (pr) =>
        pr.labels?.some((l) => (typeof l === 'object' ? l.name : l) === 'contribution') &&
        (pr.body?.includes(`@${user.login}`) || pr.body?.includes(`Contributed by @${user.login}`))
    );

    const list = contributionPRs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged_at != null,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      headRef: pr.head?.ref,
    }));

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({ contributions: list });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list PRs';
    return res.status(500).json({ error: message });
  }
}
