import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadLocalEnv } from '../_lib/load-local-env.js';
import { createSession, setSessionCookieHeader } from '../_lib/session.js';
import { decodeOAuthState, postLoginLocation } from '../_lib/oauth-state.js';
import { resolveContributeOrigin } from '../_lib/resolve-request-origin.js';

/**
 * GET /api/auth/callback — OAuth callback for GitHub sign-in.
 * Redirects to returnOrigin + returnTo from state (same page the user started from).
 * Never defaults bug-report returns to /contribute/.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  loadLocalEnv();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const { returnTo, returnOrigin } = decodeOAuthState(
    typeof req.query.state === 'string' ? req.query.state : undefined,
    resolveContributeOrigin(req)
  );

  // GitHub may bounce here with ?error=… (e.g. redirect_uri_mismatch) when the
  // registered callback matches but the requested redirect_uri does not.
  // The "Be careful! The redirect_uri is not associated…" page is shown by
  // GitHub itself and never hits this handler — fix OAuth App callback / use a local app.
  const oauthError = typeof req.query.error === 'string' ? req.query.error : null;
  if (oauthError) {
    const mapped =
      oauthError === 'redirect_uri_mismatch' ? 'redirect_uri' : oauthError;
    res.setHeader('Location', postLoginLocation(returnOrigin, returnTo, mapped));
    res.status(302).end();
    return;
  }

  if (!code || !githubClientId || !githubClientSecret) {
    res.setHeader('Location', postLoginLocation(returnOrigin, returnTo, 'config'));
    res.status(302).end();
    return;
  }
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (tokenData.error || !tokenData.access_token) {
    res.setHeader('Location', postLoginLocation(returnOrigin, returnTo, 'access_denied'));
    res.status(302).end();
    return;
  }
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userRes.ok) {
    res.setHeader('Location', postLoginLocation(returnOrigin, returnTo, 'user'));
    res.status(302).end();
    return;
  }
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    avatar_url: string | null;
    name: string | null;
  };
  const sessionToken = await createSession({
    id: user.id,
    login: user.login,
    avatar_url: user.avatar_url ?? null,
    name: user.name ?? null,
  });
  res.setHeader('Set-Cookie', setSessionCookieHeader(sessionToken));
  res.setHeader('Location', postLoginLocation(returnOrigin, returnTo));
  res.status(302).end();
}
