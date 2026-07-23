import { z } from 'zod';

/**
 * Sanskrit word glossary entry — deep / multidimensional meanings for interactive words.
 * Locale payloads: start with en + pt; other locales optional for later expansion.
 */
export const glossaryLocaleTextSchema = z.object({
  en: z.string().min(1),
  pt: z.string().min(1),
  es: z.string().optional(),
  it: z.string().optional(),
  hi: z.string().optional(),
  ar: z.string().optional(),
});

export const chantGlossaryEntrySchema = z.object({
  /** Canonical IAST lemma shown in the popover title. */
  iast: z.string().min(1),
  /** Optional Devanagari lemma. */
  original: z.string().optional(),
  /**
   * Match keys: normalized IAST forms (and optional Devanagari) that resolve to this entry.
   * Include common declined / sandhi forms used in the chant lines.
   */
  keys: z.array(z.string().min(1)).min(1),
  /** Short sense (one line). */
  brief: glossaryLocaleTextSchema,
  /** Deep / multidimensional meaning. */
  deep: glossaryLocaleTextSchema,
});

export const chantGlossarySchema = z.array(chantGlossaryEntrySchema);

export type GlossaryLocaleText = z.infer<typeof glossaryLocaleTextSchema>;
export type ChantGlossaryEntry = z.infer<typeof chantGlossaryEntrySchema>;
export type ChantGlossary = z.infer<typeof chantGlossarySchema>;
