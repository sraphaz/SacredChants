import { describe, it, expect } from 'vitest';
import {
  nudgeStart,
  roundStart,
  buildSyncReviewExport,
  applyStartsToChantVerses,
  startsEqual,
  SYNC_MIN_GAP,
} from '../../src/utils/sync-nudge';

describe('nudgeStart', () => {
  it('cascades delta from active line forward', () => {
    expect(nudgeStart([0, 10, 20, 30], 1, 0.5)).toEqual([0, 10.5, 20.5, 30.5]);
  });

  it('does not shift lines before the active index', () => {
    expect(nudgeStart([0, 10, 20], 2, -1)).toEqual([0, 10, 19]);
  });

  it('clamps effective delta against previous neighbor then cascades', () => {
    const out = nudgeStart([0, 10, 20], 1, -100);
    const expectedAt1 = roundStart(0 + SYNC_MIN_GAP);
    const effective = roundStart(expectedAt1 - 10);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(expectedAt1);
    expect(out[2]).toBe(roundStart(20 + effective));
  });

  it('does not go below zero on first line (cascades remainder)', () => {
    expect(nudgeStart([1, 10, 20], 0, -5)).toEqual([0, 9, 19]);
  });

  it('preserves relative gaps among cascaded lines', () => {
    const out = nudgeStart([0, 5, 8, 15], 1, 2);
    expect(out).toEqual([0, 7, 10, 17]);
    expect(roundStart(out[2]! - out[1]!)).toBe(3);
    expect(roundStart(out[3]! - out[2]!)).toBe(7);
  });
});

describe('buildSyncReviewExport', () => {
  it('includes diffs and anchors for apply-timestamps', () => {
    const exp = buildSyncReviewExport(
      'demo',
      [0, 10, 20],
      [0, 10.4, 20],
      '2026-01-01T00:00:00.000Z'
    );
    expect(exp.kind).toBe('sync-review');
    expect(exp.slug).toBe('demo');
    expect(exp.diffs).toEqual([{ i: 1, from: 10, to: 10.4 }]);
    expect(exp.anchors['1']).toBe(10.4);
    expect(exp.starts).toEqual([0, 10.4, 20]);
  });
});

describe('applyStartsToChantVerses', () => {
  it('writes flat starts onto sorted verses', () => {
    const chant = {
      verses: [
        { order: 2, lines: [{ start: 9 }, { start: 10 }] },
        { order: 1, lines: [{ start: 0 }] },
      ],
    };
    const out = applyStartsToChantVerses(chant, [1, 2, 3]);
    const sorted = [...out.verses].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.lines[0]!.start).toBe(1);
    expect(sorted[1]!.lines[0]!.start).toBe(2);
    expect(sorted[1]!.lines[1]!.start).toBe(3);
  });
});

describe('startsEqual', () => {
  it('compares rounded values', () => {
    expect(startsEqual([1.0001], [1.0004])).toBe(true);
    expect(startsEqual([1], [1.01])).toBe(false);
  });
});
