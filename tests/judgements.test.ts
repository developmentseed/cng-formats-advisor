import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASES } from '../src/framework/data/cases';
import { FORMATS } from '../src/framework/data/formats';
import { REF } from '../src/framework/data/guide';
import { INTENTS } from '../src/framework/data/intents';
import { INTENT_FIT, PRESET_INPUTS } from '../src/framework/data/judgements';
import type { FormatId } from '../src/framework/types';

const refUrls = new Set(Object.values(REF).map((r) => r.url));

describe('judgements', () => {
  it('every cell of the intent-fit matrix has a value 0-3, a reason and a guide link', () => {
    const formats = Object.keys(FORMATS).filter((f) => f !== 'virtual-zarr') as FormatId[];
    for (const f of formats) {
      for (const i of INTENTS) {
        const cell = INTENT_FIT[f][i];
        expect([0, 1, 2, 3]).toContain(cell.value);
        expect(cell.why.length).toBeGreaterThan(10);
        expect(refUrls.has(cell.ref.url)).toBe(true);
      }
    }
  });

  it('every preset input has a citation', () => {
    for (const p of Object.values(PRESET_INPUTS)) {
      for (const v of Object.values(p)) {
        expect(v.why.length).toBeGreaterThan(3);
        expect(refUrls.has(v.ref.url)).toBe(true);
      }
    }
  });

  it('the guide maturity table: COG L5, GeoParquet L4, COPC L4, FlatGeobuf L3, GeoZarr L2; PMTiles and CO-HDF5 not rated', () => {
    expect(FORMATS.cog.maturity).toBe(5);
    expect(FORMATS.geoparquet.maturity).toBe(4);
    expect(FORMATS.copc.maturity).toBe(4);
    expect(FORMATS.flatgeobuf.maturity).toBe(3);
    expect(FORMATS.geozarr.maturity).toBe(2);
    expect(FORMATS.pmtiles.maturity).toBeNull();
    expect(FORMATS['co-hdf5'].maturity).toBeNull();
  });
});

/**
 * Optional check against the guide source: set CNG_GUIDE_DIR to a checkout of
 * cloud-optimized-geospatial-formats-guide. Every published number must be in
 * case-studies.qmd.
 */
const guideDir = process.env.CNG_GUIDE_DIR;
const casesFile = guideDir ? join(guideDir, 'decision-framework', 'case-studies.qmd') : '';

describe.skipIf(!guideDir || !existsSync(casesFile))('published measurements against the guide source', () => {
  it('every number of every published arm is in case-studies.qmd', () => {
    const text = readFileSync(casesFile, 'utf8');
    const missing: string[] = [];
    const check = (n: number, where: string) => {
      const forms = [String(n), n.toLocaleString('en-US')];
      if (!forms.some((f) => text.includes(f))) missing.push(`${where}: ${n}`);
    };
    for (const c of CASES) {
      for (const m of c.measurements) {
        if (m.totalSize) check(m.totalSize.value, `${c.id} ${m.label} total`);
        if (m.objectCount !== undefined) check(m.objectCount, `${c.id} ${m.label} count`);
        if (m.meanObjectSize) check(m.meanObjectSize.value, `${c.id} ${m.label} mean`);
        for (const note of m.notes ?? []) {
          for (const num of note.match(/\d[\d,]*(\.\d+)?/g) ?? []) {
            if (!text.includes(num)) missing.push(`${c.id} ${m.label} note: ${num}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
