import { z } from 'zod';

/** Single synchronized line: start time + original, transliteration, translations. */
export const chantLineSchema = z.object({
  /** Start time in seconds for audio sync (karaoke-style highlighting, scroll). */
  start: z.number().min(0),
  original: z.string(),
  transliteration: z.string(),
  translations: z.object({
    pt: z.string().optional(),
    en: z.string().optional(),
    es: z.string().optional(),
    it: z.string().optional(),
  }),
});

/** Verse: ordered group of lines (e.g. one chaupai = two lines sung sequentially). */
export const chantVerseSchema = z.object({
  order: z.number().int().positive(),
  lines: z.array(chantLineSchema).min(1),
  /** Short explanation or commentary for this verse. Optional. */
  explanation: z
    .object({
      pt: z.string().optional(),
      en: z.string().optional(),
      es: z.string().optional(),
      it: z.string().optional(),
    })
    .optional(),
});

export const chantSchema = z.object({
  slug: z.string(),
  title: z.string(),
  tradition: z.string(),
  origin: z.string().optional(),
  language: z.string(),
  script: z.string().optional(),
  /** Short intro: one line per locale. Shown in header; follows language selection. */
  description: z.object({
    en: z.string(),
    pt: z.string(),
    es: z.string().optional(),
    it: z.string().optional(),
  }),
  tags: z.array(z.string()).default([]),
  audio: z.string().url().optional(),
  /** Interpreter or performer name for the audio recording. Optional; shown when audio is set. */
  interpreter: z.string().optional(),
  /** Total duration in seconds (for reference / future UI). Optional. */
  duration: z.number().min(0).optional(),
  /** Spotify track/album URL for "Listen on Spotify". No playback sync (Spotify does not expose position). */
  spotifyUrl: z.string().url().optional(),
  /** Bandcamp embed iframe src URL. Shown as embedded player when set. */
  bandcampEmbedSrc: z.string().url().optional(),
  /** Bandcamp track/page URL for "Listen on Bandcamp" link. Optional when bandcampEmbedSrc is set. */
  bandcampUrl: z.string().url().optional(),
  /** Optional path to album art image for player bar (e.g. /images/bandcamp-hanuman-chalisa.png). When set, shown in the 2rem square instead of embed. */
  bandcampArtImage: z.string().optional(),
  /** Long "about" text: meaning, context, history. Optional. */
  about: z
    .object({
      pt: z.string().optional(),
      en: z.string().optional(),
      es: z.string().optional(),
      it: z.string().optional(),
    })
    .optional(),
  verses: z.array(chantVerseSchema),
});

export type ChantLine = z.infer<typeof chantLineSchema>;
export type ChantVerse = z.infer<typeof chantVerseSchema>;
export type Chant = z.infer<typeof chantSchema>;
