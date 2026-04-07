import { describe, it, expect } from 'vitest';
import {
  lineTranslationForLocale,
  verseExplanationForLocale,
  descriptionForLocale,
  chantMetaDescription,
} from '../../src/utils/chant-page';

const translations = {
  en: 'English line',
  pt: 'Linha PT',
  it: 'It line',
  hi: '',
  ar: '',
};

describe('lineTranslationForLocale', () => {
  it('does not fall back to English for hi when hi is missing', () => {
    expect(lineTranslationForLocale(translations, 'hi')).toBe('');
  });

  it('does not fall back to English for ar when ar is missing', () => {
    expect(lineTranslationForLocale(translations, 'ar')).toBe('');
  });

  it('returns hi text when present', () => {
    expect(
      lineTranslationForLocale({ ...translations, hi: 'हि' }, 'hi')
    ).toBe('हि');
  });

  it('falls back to English for es when es is missing', () => {
    expect(lineTranslationForLocale(translations, 'es')).toBe('English line');
  });
});

describe('verseExplanationForLocale', () => {
  const exp = {
    en: 'E',
    pt: 'P',
    hi: '',
    ar: '',
  };

  it('does not fall back for hi', () => {
    expect(verseExplanationForLocale(exp, 'hi')).toBe('');
  });

  it('falls back en then pt for pt when needed', () => {
    expect(verseExplanationForLocale({ en: 'Only en' }, 'pt')).toBe('Only en');
  });
});

describe('descriptionForLocale', () => {
  const desc = {
    en: 'En desc',
    pt: 'Pt desc',
    hi: '',
    ar: '',
  };

  it('returns empty for hi when hi missing', () => {
    expect(descriptionForLocale(desc, 'hi')).toBe('');
  });

  it('falls back for es', () => {
    expect(descriptionForLocale(desc, 'es')).toBe('En desc');
  });
});

describe('chantMetaDescription', () => {
  const desc = {
    en: 'Meta en',
    pt: 'Meta pt',
    hi: '',
    ar: '',
  };

  it('does not use English for hi locale when hi empty', () => {
    expect(chantMetaDescription(desc, 'hi')).toBe('');
  });

  it('uses locale chain when not hi/ar', () => {
    expect(chantMetaDescription(desc, 'es')).toBe('Meta en');
  });
});
