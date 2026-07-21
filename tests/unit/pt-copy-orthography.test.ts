import { describe, expect, it } from 'vitest';
import { ui } from '../../src/i18n/strings';

/** PT UI copy uses Brazilian orthography for common ct/cç forms (issue #67). */
const FORBIDDEN_PT_FRAGMENTS = [
  'perspetiv',
  'registos',
  'aceder',
  'secção',
  'quotidiana',
  'objectivo',
  'contacto',
  'colectivo',
  'activado',
  'activar',
] as const;

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      collectStrings(child, out);
    }
  }
  return out;
}

describe('pt UI orthography', () => {
  it('home manifesto uses perspectivas (not perspetivas)', () => {
    expect(ui.pt.home.manifestoP2).toContain('perspectivas');
    expect(ui.pt.home.manifestoP2).not.toMatch(/perspetiv/);
  });

  it('avoids common EP-only fragments in pt UI strings', () => {
    const all = collectStrings(ui.pt).join('\n');
    for (const fragment of FORBIDDEN_PT_FRAGMENTS) {
      expect(all.toLowerCase(), `unexpected fragment: ${fragment}`).not.toContain(
        fragment.toLowerCase()
      );
    }
  });
});
