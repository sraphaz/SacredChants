import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'sc_session';
const DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id: number;
  login: string;
  avatar_url: string | null;
  name: string | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error('SESSION_SECRET or GITHUB_CLIENT_SECRET must be set');
  return new TextEncoder().encode(secret);
}

export async function createSession(user: SessionUser, maxAge: number = DEFAULT_MAX_AGE): Promise<string> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret());
  return token;
}

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

export function setSessionCookieHeader(token: string, maxAge: number = DEFAULT_MAX_AGE): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
