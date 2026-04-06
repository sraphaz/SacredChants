import { describe, it, expect } from 'vitest';
import { getLocaleFromUrl, langQuery, LANG_PARAM_TO_LOCALE } from '../../src/i18n/strings';

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

  it('returns hi for lang=hi', () => {
    expect(getLocaleFromUrl(params('lang=hi'))).toBe('hi');
    expect(getLocaleFromUrl(params('lang=HI'))).toBe('hi');
  });

  it('returns ar for lang=ar', () => {
    expect(getLocaleFromUrl(params('lang=ar'))).toBe('ar');
    expect(getLocaleFromUrl(params('lang=AR'))).toBe('ar');
  });
});

describe('LANG_PARAM_TO_LOCALE', () => {
  it('maps canonical and alias params in one place', () => {
    expect(LANG_PARAM_TO_LOCALE['pt']).toBe('pt');
    expect(LANG_PARAM_TO_LOCALE['pt-br']).toBe('pt');
    expect(LANG_PARAM_TO_LOCALE['en']).toBe('en');
    expect(LANG_PARAM_TO_LOCALE['hi']).toBe('hi');
    expect(LANG_PARAM_TO_LOCALE['ar']).toBe('ar');
  });
});

describe('langQuery', () => {
  it('returns empty string for en (default, no query)', () => {
    expect(langQuery('en')).toBe('');
  });

  it('returns ?lang= for pt, es, it, hi, ar', () => {
    expect(langQuery('pt')).toBe('?lang=pt');
    expect(langQuery('es')).toBe('?lang=es');
    expect(langQuery('it')).toBe('?lang=it');
    expect(langQuery('hi')).toBe('?lang=hi');
    expect(langQuery('ar')).toBe('?lang=ar');
  });
});
