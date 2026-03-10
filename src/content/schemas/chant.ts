import { z } from 'zod';

export const chantVerseSchema = z.object({
  order: z.number().int().positive(),
  original: z.string(),
  transliteration: z.string(),
  translations: z.object({
    pt: z.string().optional(),
    en: z.string().optional(),
  }),
});

export const chantSchema = z.object({
  slug: z.string(),
  title: z.string(),
  tradition: z.string(),
  origin: z.string().optional(),
  language: z.string(),
  script: z.string().optional(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  audio: z.string().url().optional(),
  bandcampTrackId: z.number().int().positive().optional(),
  bandcampTrackUrl: z.string().url().optional(),
  bandcampFallbackLabel: z.string().optional(),
  verses: z.array(chantVerseSchema),
});

export type ChantVerse = z.infer<typeof chantVerseSchema>;
export type Chant = z.infer<typeof chantSchema>;
