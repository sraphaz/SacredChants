import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'sc_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** User data stored in the session JWT and exposed to API handlers. */
export interface SessionUser {
  id: number;
  login: string;
  avatar_url: string | null;
  name: string | null;
}

/** Returns the key used to sign/verify JWTs (from SESSION_SECRET or GITHUB_CLIENT_SECRET). */
function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error('SESSION_SECRET or GITHUB_CLIENT_SECRET must be set');
  return new TextEncoder().encode(secret);
}

/**
 * Creates a signed JWT containing the user payload, valid for maxAge seconds.
 * @param user - User to encode in the token
 * @param maxAge - Token TTL in seconds (default 7 days)
 * @returns Signed JWT string
 */
export async function createSession(user: SessionUser, maxAge: number = DEFAULT_MAX_AGE): Promise<string> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret());
  return token;
}

/**
 * Verifies and decodes a session JWT; returns null if invalid or expired.
 * @param token - JWT string (e.g. from cookie)
 * @returns SessionUser or null
 */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = payload.id as number;
    const login = payload.login as string;
    if (!id || !login) return null;
    return {
      id,
      login,
      avatar_url: (payload.avatar_url as string) ?? null,
      name: (payload.name as string) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Reads the session cookie from a request (Vercel cookies API or Cookie header).
 * @param req - Request with cookies or headers
 * @returns Cookie value or undefined
 */
export function getSessionCookie(req: {
  cookies?: { get?: (n: string) => { value?: string }; [key: string]: unknown };
  headers?: { cookie?: string; [key: string]: unknown };
}): string | undefined {
  const c = req.cookies as Record<string, unknown> | undefined;
  if (c && typeof c[COOKIE_NAME] === 'string') return c[COOKIE_NAME] as string;
  if (c && typeof c.get === 'function') {
    const cookie = (c.get as (n: string) => { value?: string })(COOKIE_NAME);
    if (cookie?.value) return cookie.value;
  }
  const cookieHeader = req.headers?.cookie ?? (req.headers as Record<string, string>)?.['cookie'];
  if (typeof cookieHeader !== 'string') return undefined;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1].trim() : undefined;
}

/**
 * Builds the Set-Cookie header value for a new session.
 * @param token - JWT string
 * @param maxAge - Max-Age in seconds (default 7 days)
 * @returns Set-Cookie header value
 */
export function setSessionCookieHeader(token: string, maxAge: number = DEFAULT_MAX_AGE): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

/** Returns the Set-Cookie header value that clears the session cookie. */
export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
