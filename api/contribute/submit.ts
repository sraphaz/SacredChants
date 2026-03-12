import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chantSchema } from '../lib/chant-schema';
import { getSessionCookie, verifySession } from '../lib/session';
import { createContributionPR } from '../lib/github';

export const config = { maxDuration: 30 };

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

  const parsed = chantSchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const chant = parsed.data;
  const chantJson = JSON.stringify(chant, null, 2);

  try {
    const result = await createContributionPR({
      title: `Contribution: ${chant.title} by @${user.login}`,
      body: `## Contribution\n\n- **Chant:** ${chant.title} (\`${chant.slug}\`)\n- **Contributed by:** @${user.login}\n- **Tradition:** ${chant.tradition}\n- **Language:** ${chant.language}\n\nThis PR was created from the [contribute form](${process.env.CONTRIBUTE_ORIGIN || ''}/contribute/). Please review the content and merge when ready.`,
      slug: chant.slug,
      chantJson,
    });

    return res.status(201).json({
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      branch: result.branch,
      message: 'Pull request created successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create PR';
    return res.status(500).json({ error: 'Failed to create pull request', details: message });
  }
}
