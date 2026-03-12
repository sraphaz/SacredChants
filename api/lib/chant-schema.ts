/**
 * Chant payload schema for contribution API.
 * Mirrors src/content/schemas/chant.ts so API can validate without importing from Astro.
 */
import { z } from 'zod';

export const chantLineSchema = z.object({
  start: z.number().min(0),
  original: z.string(),
  transliteration: z.string(),
  translations: z.object({
    pt: z.string().optional(),
    en: z.string().optional(),
  }),
});

export const chantVerseSchema = z.object({
  order: z.number().int().positive(),
  lines: z.array(chantLineSchema).min(1),
  explanation: z
    .object({
      pt: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
});

/** Accepts URL or path starting with / for audio (site resolves paths at build). */
const audioSchema = z.union([
  z.string().url(),
  z.string().min(1).refine((s) => s.startsWith('/'), { message: 'Audio must be URL or path starting with /' }),
]);

export const chantSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug: lowercase letters, numbers, hyphens only'),
  title: z.string().min(1),
  tradition: z.string().min(1),
  origin: z.string().optional(),
  language: z.string().min(1),
  script: z.string().optional(),
  description: z.object({
    en: z.string(),
    pt: z.string(),
  }),
  tags: z.array(z.string()).default([]),
  audio: audioSchema.optional(),
  duration: z.number().min(0).optional(),
  spotifyUrl: z.string().url().optional(),
  bandcampEmbedSrc: z.string().url().optional(),
  bandcampUrl: z.string().url().optional(),
  bandcampArtImage: z.string().optional(),
  about: z
    .object({
      pt: z.string().optional(),
      en: z.string().optional(),
    })
    .optional(),
  verses: z.array(chantVerseSchema),
});

export type ChantPayload = z.infer<typeof chantSchema>;
