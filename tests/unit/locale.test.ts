import { describe, it, expect } from 'vitest';
import { getLocaleFromUrl, langQuery } from '../../src/i18n/strings';

function params(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

describe('getLocaleFromUrl', () => {
  it('returns en when no lang param', () => {
    expect(getLocaleFromUrl(params(''))).toBe('en');
    expect(getLocaleFromUrl(params('foo=bar'))).toBe('en');
  });

  it('returns en for invalid or unknown lang', () => {
    expect(getLocaleFromUrl(params('lang=fr'))).toBe('en');
    expect(getLocaleFromUrl(params('lang=de'))).toBe('en');
    expect(getLocaleFromUrl(params('lang='))).toBe('en');
  });

  it('returns pt for lang=pt and lang=pt-br', () => {
    expect(getLocaleFromUrl(params('lang=pt'))).toBe('pt');
    expect(getLocaleFromUrl(params('lang=pt-br'))).toBe('pt');
    expect(getLocaleFromUrl(params('lang=PT'))).toBe('pt');
    expect(getLocaleFromUrl(params('lang=PT-BR'))).toBe('pt');
  });

  it('returns es for lang=es', () => {
    expect(getLocaleFromUrl(params('lang=es'))).toBe('es');
    expect(getLocaleFromUrl(params('lang=ES'))).toBe('es');
  });

  it('returns it for lang=it', () => {
    expect(getLocaleFromUrl(params('lang=it'))).toBe('it');
    expect(getLocaleFromUrl(params('lang=IT'))).toBe('it');
  });
});

describe('langQuery', () => {
  it('returns empty string for en (default, no query)', () => {
    expect(langQuery('en')).toBe('');
  });

  it('returns ?lang= for pt, es, it', () => {
    expect(langQuery('pt')).toBe('?lang=pt');
    expect(langQuery('es')).toBe('?lang=es');
    expect(langQuery('it')).toBe('?lang=it');
  });
});
