## Summary

<!-- One or two sentences: what this PR does and why it matters. Be specific. -->

## Description

<!-- Detailed description. Include: -->

- **What changed:** files touched, new/updated content or behavior.
- **Why:** reason for the change (e.g. new chant, bug fix, doc update).
- **Context (for new chants):** tradition, language, source or attribution, and how you verified the content (e.g. from a published source, teacher, community).

## Type of change

- [ ] New chant (content only)
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor / code quality

## For new chants only

- **Title (as in JSON):**
- **Tradition:**
- **Language:**
- **Origin / source (if any):**
- **Audio:** none / URL / file in `public/audio/`

## How to verify

<!-- How a reviewer can check that this is correct. E.g.: -->

- [ ] Build passes: `npm run build`
- [ ] New chant: preview the chant page and check title, tradition, verses, and (if any) audio
- [ ] Other changes: describe steps to test (e.g. "Go to /contribute, submit form, confirm PR is created")

## Checklist

- [ ] For new chants: JSON is in `src/content/chants/` and follows the schema in `src/content/schemas/chant.ts`
- [ ] Build passes locally (`npm run build`)
- [ ] No unrelated changes included
- [ ] Description above is filled (summary, what changed, why, how to verify)

## Optional

- [ ] Screenshot or preview link (e.g. Vercel deploy) for UI changes
