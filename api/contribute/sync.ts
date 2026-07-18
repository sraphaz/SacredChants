import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chantSchema } from '../lib/chant-schema.js';
import { getSessionCookie, verifySession } from '../lib/session.js';
import { createSyncUpdatePR, getOctokit } from '../lib/github.js';
import { applyStartsToChantVerses } from '../lib/sync-nudge.js';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sraphaz';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'SacredChants';

export const config = { maxDuration: 30 };

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug);
}

/**
 * POST /api/contribute/sync — timestamps-only PR for an existing chant.
 * Body: { slug: string, starts: number[] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getSessionCookie(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const user = await verifySession(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });

  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const raw = body as Record<string, unknown>;
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
  const starts = Array.isArray(raw.starts)
    ? raw.starts.map((n) => Number(n))
    : null;

  if (!slug || !isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid slug' });
  }
  if (!starts || !starts.length || starts.some((n) => !Number.isFinite(n) || n < 0)) {
    return res.status(400).json({ error: 'Invalid starts array' });
  }

  let chantJsonRaw: string;
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `src/content/chants/${slug}.json`,
      ref: 'main',
    });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
      return res.status(404).json({ error: 'Chant not found in repository' });
    }
    chantJsonRaw = Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load chant';
    return res.status(500).json({ error: 'Failed to load chant from GitHub', details: message });
  }

  let chantParsed: unknown;
  try {
    chantParsed = JSON.parse(chantJsonRaw);
  } catch {
    return res.status(500).json({ error: 'Chant JSON in repo is invalid' });
  }

  // Validate shape, but keep the raw repo object so Zod strip does not drop
  // locales/metadata (es/it/hi/ar, interpreter, etc.) from the timestamps-only PR.
  const validated = chantSchema.safeParse(chantParsed);
  if (!validated.success) {
    return res.status(500).json({ error: 'Chant schema validation failed for repo file' });
  }

  type ChantWithVerses = {
    title?: string;
    verses: Array<{ order: number; lines: Array<{ start: number }> }>;
  };
  if (
    !chantParsed ||
    typeof chantParsed !== 'object' ||
    !Array.isArray((chantParsed as ChantWithVerses).verses)
  ) {
    return res.status(500).json({ error: 'Chant JSON in repo is missing verses' });
  }

  let updated: ChantWithVerses;
  try {
    updated = applyStartsToChantVerses(chantParsed as ChantWithVerses, starts);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not apply starts';
    return res.status(400).json({ error: message });
  }

  const revalidated = chantSchema.safeParse(updated);
  if (!revalidated.success) {
    return res.status(400).json({
      error: 'Updated chant failed validation',
      details: revalidated.error.flatten().fieldErrors,
    });
  }

  const chantJson = JSON.stringify(updated, null, 2) + '\n';
  const contributeOrigin = process.env.CONTRIBUTE_ORIGIN || 'https://app.sacredchants.org';
  const title =
    typeof updated.title === 'string' && updated.title
      ? updated.title
      : validated.data.title;
  const changed = starts
    .map((to, i) => {
      const flatBefore = validated.data.verses
        .slice()
        .sort((a, b) => a.order - b.order)
        .flatMap((v) => v.lines.map((l) => l.start));
      const from = flatBefore[i];
      if (from == null || Math.round(from * 1000) === Math.round(to * 1000)) return null;
      return `- Line ${i}: ${from} → ${to}`;
    })
    .filter(Boolean);

  const prBody = [
    '## Summary',
    '',
    `Karaoke timestamp sync for **${title}** (\`${slug}\`) by @${user.login}.`,
    '',
    '## Changes',
    '',
    changed.length ? changed.join('\n') : '- Starts updated (see JSON diff).',
    '',
    '## How to verify',
    '',
    `- [ ] Open \`/chants/${slug}?sync=1&edit=1\` and listen through corrected sections.`,
    '- [ ] Run `npm run build`.',
    '',
    `Submitted via [Sacred Chants sync editor](${contributeOrigin}/chants/${slug}?edit=1).`,
    '',
  ].join('\n');

  try {
    const result = await createSyncUpdatePR({
      title: `Sync: ${title} timestamps by @${user.login}`,
      body: prBody,
      slug,
      chantJson,
    });
    return res.status(201).json({
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      branch: result.branch,
      message: 'Sync pull request created successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create PR';
    return res.status(500).json({
      error: 'Failed to create sync pull request',
      details: message,
    });
  }
}
