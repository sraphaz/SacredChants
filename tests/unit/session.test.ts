import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  verifySession,
  getSessionCookie,
  setSessionCookieHeader,
  clearSessionCookieHeader,
  type SessionUser,
} from '../../api/lib/session';

const testUser: SessionUser = {
  id: 123,
  login: 'testuser',
  avatar_url: 'https://github.com/test.png',
  name: 'Test User',
};

describe('session', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, SESSION_SECRET: 'test-secret-for-unit-tests' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('createSession and verifySession', () => {
    it('creates a token and verifies to same user', async () => {
      const token = await createSession(testUser);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);

      const user = await verifySession(token);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(testUser.id);
      expect(user?.login).toBe(testUser.login);
      expect(user?.avatar_url).toBe(testUser.avatar_url);
      expect(user?.name).toBe(testUser.name);
    });

    it('returns null for invalid token', async () => {
      const user = await verifySession('invalid.jwt.token');
      expect(user).toBeNull();
    });

    it('returns null for tampered token', async () => {
      const token = await createSession(testUser);
      const tampered = token.slice(0, -5) + 'xxxxx';
      const user = await verifySession(tampered);
      expect(user).toBeNull();
    });

    it('accepts user with null avatar and name', async () => {
      const minimalUser: SessionUser = { id: 1, login: 'min', avatar_url: null, name: null };
      const token = await createSession(minimalUser);
      const user = await verifySession(token);
      expect(user?.login).toBe('min');
      expect(user?.avatar_url).toBeNull();
      expect(user?.name).toBeNull();
    });
  });

  describe('getSessionCookie', () => {
    it('reads from cookies object by key', () => {
      const req = { cookies: { sc_session: 'abc123' } };
      expect(getSessionCookie(req)).toBe('abc123');
    });

    it('reads from cookies.get() when present', () => {
      const req = { cookies: { get: (name: string) => (name === 'sc_session' ? { value: 'xyz' } : undefined) } };
      expect(getSessionCookie(req)).toBe('xyz');
    });

    it('reads from Cookie header', () => {
      const req = { headers: { cookie: 'other=1; sc_session=header-token; foo=2' } };
      expect(getSessionCookie(req)).toBe('header-token');
    });

    it('returns undefined when no cookie', () => {
      expect(getSessionCookie({})).toBeUndefined();
      expect(getSessionCookie({ headers: {} })).toBeUndefined();
    });
  });

  describe('setSessionCookieHeader', () => {
    it('returns Set-Cookie header with token', () => {
      const header = setSessionCookieHeader('my-jwt');
      expect(header).toContain('sc_session=my-jwt');
      expect(header).toContain('HttpOnly');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      expect(header).toContain('Max-Age=');
    });
  });

  describe('clearSessionCookieHeader', () => {
    it('returns Set-Cookie header that clears session', () => {
      const header = clearSessionCookieHeader();
      expect(header).toContain('sc_session=;');
      expect(header).toContain('Max-Age=0');
    });
  });
});
