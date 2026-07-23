/**
 * CORS for credentialed browser calls from the static site (Pages) or local Astro
 * to the contribute API origin.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function allowedOrigins(): string[] {
  const fromEnv = [
    process.env.CONTRIBUTE_ORIGIN,
    process.env.SITE_ORIGIN,
    process.env.CORS_ORIGINS,
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

  return [
    ...fromEnv,
    'https://sacredchants.org',
    'https://www.sacredchants.org',
    'https://app.sacredchants.org',
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
}

/**
 * Sets CORS headers when Origin is allowed. Handles OPTIONS preflight.
 * @returns true if the request was fully handled (OPTIONS) and the handler should return.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
