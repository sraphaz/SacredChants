## Fix: English reverts to Portuguese; Spanish/Italian show no subtitles

### Problem (production)

1. **Select English → reverts to Portuguese**  
   User selects Portuguese (works). Then selects English; the page reloads without `?lang=` but immediately redirects back to `?lang=pt`, so the site stays in Portuguese.

2. **Select Spanish → no subtitles**  
   On a chant page with `?lang=es`, verse translations (subtitles) do not appear.

3. **Select Italian → no subtitles**  
   Same on chant pages with `?lang=it`: no verse translation text is shown.

### Root causes

**1. English reverting to Portuguese**  
   When the user chooses English, the app navigates to the current pathname with no `?lang=` (intended). On load, `init-theme-locale.js` runs and sees:
   - `savedLang = localStorage.getItem('sacred-chants-lang')` → still `'pt'` (never updated when switching to EN)
   - `urlLang` → missing (no query param)  
   So it treats “restore saved language” and redirects to `?lang=pt`. The locale choice was not persisted for English before navigating.

**2. No subtitles for ES/IT**  
   Chant JSON only has `translations` (and `explanation`) for `en` and `pt`. In `ChantVerse.astro`, a `<p class="locale-es">` (or `locale-it`) was rendered only when `line.translations[loc]` existed. For ES/IT that is usually undefined, so no such elements were in the DOM. With `[data-locale="es"]` (or `it`), CSS hides `.locale-en` and `.locale-pt`, so the only blocks that would show (`.locale-es` / `.locale-it`) were never rendered → no subtitles.

### Changes

#### `src/layouts/BaseLayout.astro`
- **Persist chosen language before navigation**  
  In the locale `<select>` change handler, before setting `window.location.href`, the chosen `lang` is written to localStorage with the same key used by the init script (`sacred-chants-lang`). So when the user selects English, the next page load sees `savedLang === 'en'` and no longer redirects to `?lang=pt`.

#### `src/components/ChantVerse.astro`
- **Fallback for verse translations**  
  For each locale (`en`, `pt`, `es`, `it`), the displayed text is now:
  - `line.translations[loc] ?? line.translations.en ?? line.translations.pt ?? ''`
  so ES/IT show English (or Portuguese) when their own translation is missing. A `<p class="locale-{loc}">` is rendered whenever this text is non-empty, so with `?lang=es` or `?lang=it` the verse block always has visible content (either native or fallback).
- **Fallback for verse explanation**  
  The same logic is applied to `verse.explanation`: `explanation[loc] ?? explanation.en ?? explanation.pt ?? ''`, so explanations also appear for ES/IT when the chant only has en/pt.

#### `e2e/locale.spec.ts`
- **Select PT then EN stays on English**  
  Opens `/?lang=pt`, selects English in the combobox, then asserts: `data-locale="en"`, select value `en`, and URL does not contain `?lang=pt`.
- **Chant with `?lang=es` shows subtitles**  
  Opens `/chants/gayatri/?lang=es` and asserts the first `.verse-block .translations .locale-es` is visible and non-empty.
- **Chant with `?lang=it` shows subtitles**  
  Same for `/chants/gayatri/?lang=it` and `.locale-it`.

### How to verify

- **Unit:** `npm run test`
- **E2E:** `npm run test:e2e -- e2e/locale.spec.ts`
- **Manual:** Select PT, then select EN → page should stay in English; open a chant, select ES or IT → verse translations (and explanations) should appear (fallback to EN/PT when ES/IT are not in the content).

### Impact

- Fixes production bugs: English no longer reverts to Portuguese; Spanish and Italian chant pages always show verse text (with fallback when needed).
- No breaking changes: URL and locale behaviour remain the same; only bug behaviour and missing fallbacks are fixed.
