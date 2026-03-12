import type { VercelRequest, VercelResponse } from '@vercel/node';
import { chantSchema } from '../lib/chant-schema.js';
import { getSessionCookie, verifySession } from '../lib/session.js';
import { createContributionPR } from '../lib/github.js';
import type { z } from 'zod';

type Chant = z.infer<typeof chantSchema>;

/**
 * Escapes a string for safe use inside Markdown inline code (backticks).
 * Escapes backslash and backtick, and normalizes newlines to space.
 * @param s - Raw string (e.g. verse line or translation)
 * @returns Escaped string safe for wrapping in `...`
 */
function escapeForInlineCode(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\n/g, ' ');
}

/**
 * Escapes a string for safe use in a Markdown table cell.
 * Escapes backslash first, then pipe; newlines become space.
 * @param s - Raw string (e.g. title, tradition, description)
 * @returns Escaped string safe for use between | delimiters
 */
function escapeTableCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Formats chant payload as Markdown for the contribution PR body.
 * Outputs metadata table, description, about (if present), and all verses with
 * original, transliteration, and translations per line.
 * @param chant - Validated chant payload (schema-inferred type)
 * @returns Markdown string for the "Conteúdo adicionado pelo contribuidor" section
 */
function formatChantContentAsMarkdown(chant: Chant): string {
  const lines: string[] = [];

  lines.push('### Metadados');
  lines.push('');
  lines.push('| Campo | Valor |');
  lines.push('|-------|-------|');
  lines.push(`| **Título** | ${escapeTableCell(chant.title)} |`);
  lines.push(`| **Slug** | \`${chant.slug}\` |`);
  lines.push(`| **Tradição** | ${escapeTableCell(chant.tradition)} |`);
  lines.push(`| **Língua** | ${escapeTableCell(chant.language)} |`);
  lines.push(`| **Origem** | ${escapeTableCell(chant.origin ?? '—')} |`);
  if (chant.script) lines.push(`| **Script** | ${escapeTableCell(chant.script)} |`);
  if (chant.tags.length) lines.push(`| **Tags** | ${escapeTableCell(chant.tags.join(', '))} |`);
  if (chant.audio) lines.push(`| **Áudio** | ${chant.audio} |`);
  if (chant.duration != null) lines.push(`| **Duração** | ${chant.duration}s |`);

  lines.push('');
  lines.push('### Descrição (intro)');
  lines.push('');
  lines.push('- **EN:** ' + escapeTableCell(chant.description.en));
  lines.push('- **PT:** ' + escapeTableCell(chant.description.pt));

  if (chant.about?.en || chant.about?.pt) {
    lines.push('');
    lines.push('### About (contexto / significado)');
    lines.push('');
    if (chant.about.en) lines.push('**EN:**\n\n' + chant.about.en);
    if (chant.about.pt) lines.push('**PT:**\n\n' + chant.about.pt);
  }

  lines.push('');
  lines.push('### Versos');
  lines.push('');

  for (const verse of chant.verses) {
    lines.push(`#### Verso ${verse.order}`);
    lines.push('');
    for (let i = 0; i < verse.lines.length; i++) {
      const line = verse.lines[i];
      lines.push(`**Linha ${i + 1}** (start: ${line.start}s)`);
      lines.push('');
      lines.push('- **Original:** `' + escapeForInlineCode(line.original) + '`');
      if (line.transliteration) lines.push('- **Transliteração:** `' + escapeForInlineCode(line.transliteration) + '`');
      if (line.translations.pt) lines.push('- **PT:** `' + escapeForInlineCode(line.translations.pt) + '`');
      if (line.translations.en) lines.push('- **EN:** `' + escapeForInlineCode(line.translations.en) + '`');
      lines.push('');
    }
    if (verse.explanation?.pt || verse.explanation?.en) {
      lines.push('*Explicação do verso:*');
      if (verse.explanation.pt) lines.push('- PT: ' + verse.explanation.pt);
      if (verse.explanation.en) lines.push('- EN: ' + verse.explanation.en);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export const config = { maxDuration: 30 };

/**
 * POST /api/contribute/submit — creates a GitHub PR from a validated chant submission.
 * Requires authenticated session (GitHub OAuth). Body must be valid chant JSON (chantSchema).
 * Creates a branch, adds src/content/chants/{slug}.json, opens a PR with a detailed body.
 * @param req - Vercel request; body = chant JSON
 * @param res - Vercel response; 201 with prNumber, prUrl, branch on success
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

  const raw = body as Record<string, unknown>;
  const audioBase64 = typeof raw.audioBase64 === 'string' ? raw.audioBase64 : undefined;
  const audioFilename = typeof raw.audioFilename === 'string' ? raw.audioFilename : undefined;
  const bodyForSchema = { ...raw };
  delete (bodyForSchema as Record<string, unknown>).audioBase64;
  delete (bodyForSchema as Record<string, unknown>).audioFilename;

  const parsed = chantSchema.safeParse(bodyForSchema);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  let chant = parsed.data;
  if (audioBase64 && audioFilename) {
    chant = { ...chant, audio: `/audio/${audioFilename}` };
  }
  const chantJson = JSON.stringify(chant, null, 2);
  const contributeOrigin = process.env.CONTRIBUTE_ORIGIN || 'https://app.sacredchants.org';

  const contentAddedMd = formatChantContentAsMarkdown(chant);

  const prBody = [
    '## Summary',
    '',
    `New chant: **${chant.title}** (\`${chant.slug}\`). Contributed by @${user.login} via the [contribute form](${contributeOrigin}/contribute/).`,
    '',
    '## Description',
    '',
    '- **What changed:** New JSON file in `src/content/chants/' + chant.slug + '.json`.',
    '- **Why:** Contribution submitted through the web form.',
    `- **Contributed by:** @${user.login}`,
    '',
    '---',
    '',
    '## Conteúdo adicionado pelo contribuidor',
    '',
    'Conteúdo submetido através do formulário de contribuição, formatado em Markdown para revisão:',
    '',
    contentAddedMd,
    '',
    '---',
    '',
    '## Type of change',
    '',
    '- [x] New chant (content only)',
    '',
    '## For new chants only',
    '',
    `- **Title (as in JSON):** ${chant.title}`,
    `- **Tradition:** ${chant.tradition}`,
    `- **Language:** ${chant.language}`,
    `- **Origin / source (if any):** ${chant.origin ?? '—'}`,
    `- **Audio:** ${chant.audio ? chant.audio : 'none'}`,
    '',
    '## How to verify',
    '',
    '- [ ] Run `npm run build` and confirm it passes.',
    '- [ ] Preview the chant page and check title, tradition, verses, and (if any) audio.',
    '',
    '## Checklist',
    '',
    '- [x] JSON is in `src/content/chants/` and follows the schema.',
    '- [ ] Build passes locally (`npm run build`).',
    '- [x] No unrelated changes.',
    '- [x] Description above is filled.',
    '',
  ].join('\n');

  try {
    const result = await createContributionPR({
      title: `Contribution: ${chant.title} by @${user.login}`,
      body: prBody,
      slug: chant.slug,
      chantJson,
      ...(audioBase64 && audioFilename && { audioBase64, audioFilename }),
    });

    return res.status(201).json({
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      branch: result.branch,
      message: 'Pull request created successfully',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create PR';
    const isConfig = /GITHUB_TOKEN|required for PR/i.test(message);
    return res.status(500).json({
      error: 'Failed to create pull request',
      details: message,
      hint: isConfig ? 'Check that GITHUB_TOKEN is set in Vercel Environment Variables (repo scope).' : undefined,
    });
  }
}
