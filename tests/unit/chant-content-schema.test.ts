import { describe, it, expect } from 'vitest';
import { chantSchema } from '../../src/content/schemas/chant';

const minimalValidChant = {
  slug: 'test-chant',
  title: 'Test Chant',
  tradition: 'Hindu',
  language: 'Sanskrit',
  description: { en: 'Short description.', pt: 'Descrição curta.' },
  verses: [
    {
      order: 1,
      lines: [
        {
          start: 0,
          original: 'ॐ',
          transliteration: 'om',
          translations: { en: 'Om.', pt: 'Om.' },
        },
      ],
    },
  ],
};

describe('chantSchema (content)', () => {
  it('accepts description with es and it optional', () => {
    const withEs = {
      ...minimalValidChant,
      description: { en: 'Intro.', pt: 'Intro.', es: 'Introducción.' },
    };
    expect(chantSchema.safeParse(withEs).success).toBe(true);

    const withIt = {
      ...minimalValidChant,
      description: { en: 'Intro.', pt: 'Intro.', it: 'Introduzione.' },
    };
    expect(chantSchema.safeParse(withIt).success).toBe(true);

    const withEsIt = {
      ...minimalValidChant,
      description: { en: 'Intro.', pt: 'Intro.', es: 'Introducción.', it: 'Introduzione.' },
    };
    expect(chantSchema.safeParse(withEsIt).success).toBe(true);
  });

  it('accepts about with es and it optional', () => {
    const withAboutEsIt = {
      ...minimalValidChant,
      about: {
        en: 'About text.',
        pt: 'Texto about.',
        es: 'Texto sobre.',
        it: 'Testo about.',
      },
    };
    expect(chantSchema.safeParse(withAboutEsIt).success).toBe(true);
  });

  it('accepts verse translations with es and it', () => {
    const withVerseEsIt = {
      ...minimalValidChant,
      verses: [
        {
          order: 1,
          lines: [
            {
              start: 0,
              original: 'ॐ',
              transliteration: 'om',
              translations: { en: 'Om.', pt: 'Om.', es: 'Om.', it: 'Om.' },
            },
          ],
        },
      ],
    };
    expect(chantSchema.safeParse(withVerseEsIt).success).toBe(true);
  });

  it('accepts verse explanation with es and it', () => {
    const withExplanationEsIt = {
      ...minimalValidChant,
      verses: [
        {
          order: 1,
          lines: [{ start: 0, original: 'ॐ', transliteration: 'om', translations: { en: 'Om.', pt: 'Om.' } }],
          explanation: { en: 'Meaning.', pt: 'Significado.', es: 'Significado.', it: 'Significato.' },
        },
      ],
    };
    expect(chantSchema.safeParse(withExplanationEsIt).success).toBe(true);
  });

  it('accepts description, about, translations, explanation with hi optional', () => {
    const withHi = {
      ...minimalValidChant,
      description: { en: 'Intro.', pt: 'Intro.', hi: 'परिचय।' },
      about: { en: 'About.', pt: 'Sobre.', hi: 'विवरण।' },
      verses: [
        {
          order: 1,
          lines: [
            {
              start: 0,
              original: 'ॐ',
              transliteration: 'om',
              translations: { en: 'Om.', pt: 'Om.', hi: 'ॐ।' },
            },
          ],
          explanation: { en: 'Note.', pt: 'Nota.', hi: 'टिप्पणी।' },
        },
      ],
    };
    expect(chantSchema.safeParse(withHi).success).toBe(true);
  });
});
