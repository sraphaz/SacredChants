import { describe, it, expect } from 'vitest';
import { chantSchema } from '../../api/lib/chant-schema';

const minimalValidChant = {
  slug: 'my-chant',
  title: 'My Chant',
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
          transliteration: 'oṃ',
          translations: { en: 'Om.', pt: 'Om.' },
        },
      ],
    },
  ],
};

describe('chantSchema', () => {
  it('accepts minimal valid payload', () => {
    const result = chantSchema.safeParse(minimalValidChant);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.slug).toBe('my-chant');
  });

  it('accepts slug with hyphens and numbers', () => {
    const payload = { ...minimalValidChant, slug: 'chant-42' };
    expect(chantSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects slug with uppercase', () => {
    const payload = { ...minimalValidChant, slug: 'My-Chant' };
    const result = chantSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects slug with spaces or special chars', () => {
    expect(chantSchema.safeParse({ ...minimalValidChant, slug: 'my chant' }).success).toBe(false);
    expect(chantSchema.safeParse({ ...minimalValidChant, slug: 'my_chant' }).success).toBe(false);
  });

  it('rejects empty slug', () => {
    expect(chantSchema.safeParse({ ...minimalValidChant, slug: '' }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(chantSchema.safeParse({ ...minimalValidChant, title: '' }).success).toBe(false);
    expect(chantSchema.safeParse({ ...minimalValidChant, tradition: '' }).success).toBe(false);
    expect(chantSchema.safeParse({ ...minimalValidChant, language: '' }).success).toBe(false);
    const { description: _, ...noDesc } = minimalValidChant;
    expect(chantSchema.safeParse(noDesc).success).toBe(false);
  });

  it('accepts empty verses array (schema allows)', () => {
    expect(chantSchema.safeParse({ ...minimalValidChant, verses: [] }).success).toBe(true);
  });

  it('rejects verse with empty lines', () => {
    const payload = {
      ...minimalValidChant,
      verses: [{ order: 1, lines: [] }],
    };
    expect(chantSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects line with negative start', () => {
    const payload = {
      ...minimalValidChant,
      verses: [
        {
          order: 1,
          lines: [
            {
              start: -1,
              original: 'ॐ',
              transliteration: 'oṃ',
              translations: { en: 'Om.', pt: 'Om.' },
            },
          ],
        },
      ],
    };
    expect(chantSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts optional audio as URL', () => {
    const payload = { ...minimalValidChant, audio: 'https://example.com/chant.mp3' };
    expect(chantSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts optional audio as path', () => {
    const payload = { ...minimalValidChant, audio: '/audio/chant.mp3' };
    expect(chantSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects invalid audio (not URL nor path)', () => {
    expect(chantSchema.safeParse({ ...minimalValidChant, audio: 'not-a-url' }).success).toBe(false);
    expect(chantSchema.safeParse({ ...minimalValidChant, audio: 'relative/path.mp3' }).success).toBe(false);
  });

  it('accepts tags array and defaults to empty', () => {
    const withTags = { ...minimalValidChant, tags: ['mantra', 'shiva'] };
    expect(chantSchema.safeParse(withTags).success).toBe(true);
    const noTags = { ...minimalValidChant };
    const result = chantSchema.safeParse(noTags);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual([]);
  });

  it('accepts optional about, origin, script', () => {
    const payload = {
      ...minimalValidChant,
      origin: 'India',
      script: 'Devanagari',
      about: { en: 'Long about text.', pt: 'Texto about longo.' },
    };
    expect(chantSchema.safeParse(payload).success).toBe(true);
  });
});
