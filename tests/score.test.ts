import { describe, expect, it } from 'vitest';
import { FAMILIES } from '../src/framework/data/families';
import { CNES_TIER_POLICY } from '../src/framework/data/tiers';
import { maturityValue, rank } from '../src/framework/score';
import { defaultState } from '../src/framework/state';
import type { ScoreInputs } from '../src/framework/types';

const MiB = 1024 * 1024;

function inputs(over: Partial<ScoreInputs> = {}): ScoreInputs {
  return { ...defaultState(), ...over };
}

describe('Stage 2: score', () => {
  it('needs a topology', () => {
    expect(rank(inputs({ topology: null }))).toBeNull();
  });

  it('ranks every member of the family: no format is removed', () => {
    for (const fam of Object.values(FAMILIES)) {
      const r = rank(inputs({ topology: fam.topology }))!;
      expect(r.candidates.map((c) => c.format).sort()).toEqual([...fam.members].sort());
      expect(r.candidates.map((c) => c.rank)).toEqual(fam.members.map((_, i) => i + 1));
    }
  });

  it('the term points add up to the score, between 0 and 100', () => {
    const r = rank(inputs({ topology: 'vector' }))!;
    for (const c of r.candidates) {
      const sum = c.terms.reduce((s, t) => s + t.points, 0);
      expect(sum).toBeCloseTo(c.score, 6);
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it('maturity: full value at or above the limit, a penalty below it, never a veto', () => {
    expect(maturityValue(5, 3)).toBe(1);
    expect(maturityValue(3, 3)).toBe(1);
    expect(maturityValue(2, 3)).toBe(0.5);
    expect(maturityValue(2, 5)).toBe(0);
    expect(maturityValue(null, 3)).toBeNull();
    const r = rank(inputs({ topology: 'raster-2d', minMaturity: 5 }))!;
    const gz = r.candidates.find((c) => c.format === 'geozarr')!;
    expect(gz.warnings.some((w) => w.kind === 'maturity' && /Plan for change/.test(w.text))).toBe(true);
  });

  it('a format that the guide does not rate takes the family mean (neutral), and a warning', () => {
    const r = rank(inputs({ topology: 'raster-2d', minMaturity: 3 }))!;
    const pm = r.candidates.find((c) => c.format === 'pmtiles')!;
    // Rated members: COG L5 -> 1, GeoZarr L2 -> 0.5. Mean 0.75.
    expect(pm.terms.find((t) => t.kind === 'maturity')!.value).toBe(0.75);
    // Rated members: COG crs-only 0.5, GeoZarr first-class 1. Mean 0.75.
    expect(pm.terms.find((t) => t.kind === 'encoding')!.value).toBe(0.75);
    expect(pm.warnings.some((w) => w.kind === 'maturity-not-rated')).toBe(true);
  });

  it('encoding importance moves first-class encoding up', () => {
    const lo = rank(inputs({ topology: 'nd-cube', encodingImportance: 'low' }))!;
    const hi = rank(inputs({ topology: 'nd-cube', encodingImportance: 'high' }))!;
    const gap = (r: typeof lo) =>
      r.candidates.find((c) => c.format === 'geozarr')!.score - r.candidates.find((c) => c.format === 'cog')!.score;
    expect(gap(hi)).toBeGreaterThan(gap(lo));
  });

  it('a zero intent fit gives a warning, not a removal', () => {
    const r = rank(inputs({ topology: 'raster-2d', intentWeights: { archive: 0, processing: 3, visualization: 0, distribution: 0, fusion: 0 } }))!;
    const pm = r.candidates.find((c) => c.format === 'pmtiles')!;
    expect(pm.warnings.some((w) => w.kind === 'low-fit')).toBe(true);
    expect(r.candidates).toHaveLength(3);
  });

  it('object size: no term without benchmark data', () => {
    const r = rank(inputs({ topology: 'raster-2d', tierPolicy: CNES_TIER_POLICY }))!;
    expect(r.candidates[0]!.terms.some((t) => t.kind === 'object-size')).toBe(false);
  });

  it('object size: tier fit from the mean object size, left out where there is no data', () => {
    const r = rank(inputs({ topology: 'raster-2d', tierPolicy: CNES_TIER_POLICY }), {
      cog: { meanObjectBytes: 57 * MiB },
      geozarr: { meanObjectBytes: 10.4 * MiB },
    })!;
    const term = (f: string) => r.candidates.find((c) => c.format === f)!.terms.find((t) => t.kind === 'object-size')!;
    expect(term('cog').value).toBe(0.5);
    expect(term('geozarr').value).toBe(0);
    expect(term('pmtiles').value).toBeNull();
    expect(r.candidates.find((c) => c.format === 'geozarr')!.warnings.some((w) => w.kind === 'tier')).toBe(true);
  });

  it('benchmark criteria: off by default, relative to the best when on', () => {
    const m = { cog: { totalBytes: 100, readLatencyP50: 0.2, writeThroughput: 10 }, geozarr: { totalBytes: 125, readLatencyP50: 0.1, writeThroughput: 20 } };
    const off = rank(inputs({ topology: 'nd-cube' }), m)!;
    expect(off.candidates[0]!.terms.some((t) => t.kind.startsWith('bench:'))).toBe(false);
    const on = rank(inputs({ topology: 'nd-cube', benchmarkWeights: { storage: 1, read: 1, display: 1, write: 1 } }), m)!;
    const t = (f: string, k: string) => on.candidates.find((c) => c.format === f)!.terms.find((x) => x.kind === k)?.value;
    expect(t('cog', 'bench:storage')).toBe(1);
    expect(t('geozarr', 'bench:storage')).toBe(0.8);
    expect(t('cog', 'bench:read')).toBe(0.5);
    expect(t('geozarr', 'bench:write')).toBe(1);
    expect(t('cog', 'bench:write')).toBe(0.5);
    expect(t('co-hdf5', 'bench:storage')).toBeNull();
    // Display has no data for any candidate: the term is not active.
    expect(t('cog', 'bench:display')).toBeUndefined();
  });

  it('a measured criterion with data for only one candidate is not in the score, with a note', () => {
    const r = rank(inputs({ topology: 'raster-2d', benchmarkWeights: { storage: 0, read: 0, display: 2, write: 0 } }), {
      geozarr: { displayLatency: 0.259 },
      cog: { totalBytes: 100 },
    })!;
    expect(r.candidates.every((c) => !c.terms.some((t) => t.kind === 'bench:display'))).toBe(true);
    expect(r.measureNotes.join(' ')).toMatch(/only GeoZarr \(Zarr v3\) has data/);
  });

  it('flags close scores', () => {
    const r = rank(inputs({ topology: 'point-cloud', intentWeights: { archive: 1, processing: 1, visualization: 1, distribution: 1, fusion: 1 } }))!;
    expect(typeof r.close).toBe('boolean');
  });

  it('gives the processing layout advice when processing is weighted', () => {
    const b = rank(inputs({ topology: 'nd-cube', processingMode: 'batched' }))!;
    expect(b.notes.join(' ')).toMatch(/large shards or row groups/);
    const f = rank(inputs({ topology: 'nd-cube', processingMode: 'on-the-fly' }))!;
    expect(f.notes.join(' ')).toMatch(/small chunks/);
  });
});
