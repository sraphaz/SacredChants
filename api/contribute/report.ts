import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadLocalEnv } from '../_lib/load-local-env.js';
import { getSessionCookie, verifySession } from '../_lib/session.js';
import { createBugReportIssue } from '../_lib/github.js';
import { applyCors } from '../_lib/cors.js';


const MAX_TITLE = 120;
const MAX_DESCRIPTION = 8000;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const config = { maxDuration: 30 };

type Selection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function escapeMd(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

function buildIssueBody(opts: {
  description: string;
  pageUrl: string;
  locale: string;
  userAgent: string;
  viewport: string;
  selection: Selection | null;
  reporterLogin: string;
}): string {
  const lines: string[] = [
    '## Description',
    '',
    escapeMd(opts.description) || '_No description provided._',
    '',
    '## Environment',
    '',
    `- **Page:** ${opts.pageUrl || '—'}`,
    `- **Locale:** ${opts.locale || '—'}`,
    `- **Viewport:** ${opts.viewport || '—'}`,
    `- **User-Agent:** \`${(opts.userAgent || '—').replace(/`/g, "'")}\``,
    `- **Reporter:** @${opts.reporterLogin}`,
    '',
  ];

  if (opts.selection) {
    const s = opts.selection;
    lines.push('## Selection');
    lines.push('');
    lines.push(
      `- Region (CSS px): x=${Math.round(s.x)}, y=${Math.round(s.y)}, w=${Math.round(s.width)}, h=${Math.round(s.height)}`
    );
    lines.push('');
  }

  lines.push('## Agent queue');
  lines.push('');
  lines.push(
    'Labeled `agent-queue` for automated or assisted follow-up. Pick up with:'
  );
  lines.push('');
  lines.push('```bash');
  lines.push('gh issue list --label agent-queue --state open');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * POST /api/contribute/report — creates a GitHub bug issue from the visual reporter.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  loadLocalEnv();
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
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

  const raw = (body ?? {}) as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const pageUrl = typeof raw.pageUrl === 'string' ? raw.pageUrl.trim() : '';
  const locale = typeof raw.locale === 'string' ? raw.locale.trim() : '';
  const userAgent = typeof raw.userAgent === 'string' ? raw.userAgent.trim() : '';
  const viewport = typeof raw.viewport === 'string' ? raw.viewport.trim() : '';
  const imageBase64 = typeof raw.imageBase64 === 'string' ? raw.imageBase64 : undefined;
  const imageMime = typeof raw.imageMime === 'string' ? raw.imageMime : undefined;

  let selection: Selection | null = null;
  if (raw.selection && typeof raw.selection === 'object') {
    const s = raw.selection as Record<string, unknown>;
    const x = Number(s.x);
    const y = Number(s.y);
    const width = Number(s.width);
    const height = Number(s.height);
    if ([x, y, width, height].every((n) => Number.isFinite(n))) {
      selection = { x, y, width, height };
    }
  }

  if (!title || title.length > MAX_TITLE) {
    return res.status(400).json({
      error: 'Title is required (max 120 characters)',
    });
  }
  if (description.length > MAX_DESCRIPTION) {
    return res.status(400).json({
      error: 'Description is too long',
    });
  }

  if (imageBase64 || imageMime) {
    if (!imageBase64 || !imageMime || !ALLOWED_MIME.has(imageMime)) {
      return res.status(400).json({
        error: 'Image must be PNG, JPEG, or WebP',
      });
    }
    const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({
        error: 'Image is too large (max 1.5 MB)',
      });
    }
  }

  const issueTitle = title.startsWith('[Bug]') ? title : `[Bug] ${title}`;
  const issueBody = buildIssueBody({
    description,
    pageUrl,
    locale,
    userAgent,
    viewport,
    selection,
    reporterLogin: user.login,
  });

  try {
    const result = await createBugReportIssue({
      title: issueTitle,
      body: issueBody,
      reporterLogin: user.login,
      ...(imageBase64 && imageMime ? { imageBase64, imageMime } : {}),
    });

    return res.status(201).json({
      issueNumber: result.issueNumber,
      issueUrl: result.issueUrl,
      message: 'Issue created successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create issue';
    const status =
      err && typeof err === 'object' && 'status' in err
        ? (err as { status: number }).status
        : 0;
    const lower = message.toLowerCase();
    const isForbidden =
      status === 403 ||
      /forbidden|resource not accessible|insufficient/i.test(lower);
    const isBadCreds =
      status === 401 || /bad credentials|requires authentication/i.test(lower);
    return res.status(500).json({
      error: 'Failed to create issue',
      details: message,
      hint: isBadCreds
        ? 'GITHUB_TOKEN in .env.local is invalid or expired (not the OAuth user token). Use a classic/fine-grained PAT with repo + Issues write, or refresh via `gh auth token`, then restart `npm run dev:vercel`.'
        : isForbidden
          ? 'GITHUB_TOKEN needs Issues (Read and write) and Contents (Read and write). See docs/DEPLOY-VERCEL-APP.md.'
          : undefined,
    });
  }
}
