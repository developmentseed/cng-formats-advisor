/**
 * The runs bundled with the case studies (public/runs, from
 * scripts/extract-runs.mjs) must parse, and must give the numbers that the
 * guide publishes for the same arms.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveRun } from '../src/framework/benchmark/criteria';
import { parseBenchmarkText, type ParsedRun } from '../src/framework/benchmark/parse';
import { CNES_TIERS } from '../src/framework/data/tiers';

const MiB = 1024 * 1024;
const runs = (id: string): ParsedRun[] => {
  const text = readFileSync(join(__dirname, '..', 'public', 'runs', `${id}.json`), 'utf8');
  return parseBenchmarkText(text, `${id}.json`).map((r) => {
    if (!r.ok) throw new Error(r.error);
    return r.run;
  });
};
const arm = (id: string, label: string) => {
  const r = runs(id).find((x) => x.armLabel === label);
  if (!r) throw new Error(`no arm ${label} in ${id}`);
  return { run: r, d: deriveRun(r, CNES_TIERS) };
};
const mib = (b: number | undefined) => Math.round(((b ?? 0) / MiB) * 10) / 10;

describe('runs bundled with the case studies', () => {
  it('case 1: totals and object counts of the guide', () => {
    expect(Math.round(mib(arm('case1', 'COG, Deflate').d.totalBytes))).toBe(25998);
    expect(Math.round(mib(arm('case1', 'Zarr, no pyramid').d.totalBytes))).toBe(19432);
    const gz = arm('case1', 'GeoZarr, with pyramid').d;
    expect(Math.round(mib(gz.totalBytes))).toBe(26026);
    expect(gz.objectCount).toBe(2510);
    expect(mib(gz.meanObjectBytes)).toBe(10.4);
    expect(gz.tierFit).toEqual([]);
  });

  it('case 2: totals, object counts and the tier drop of the pyramid', () => {
    expect(Math.round(mib(arm('case2', 'COG, Deflate').d.totalBytes))).toBe(16498);
    const flat = arm('case2', 'Zarr, no pyramid').d;
    expect(Math.round(mib(flat.totalBytes))).toBe(12344);
    expect(flat.objectCount).toBe(80);
    expect(flat.tierFit).toEqual(['warm', 'cold']);
    const gz = arm('case2', 'GeoZarr, with pyramid').d;
    expect(Math.round(mib(gz.totalBytes))).toBe(15867);
    expect(gz.objectCount).toBe(480);
    expect(Math.round(mib(gz.meanObjectBytes))).toBe(33);
    expect(gz.tierFit).toEqual(['warm']);
  });

  it('case 3: COPC, six granules, 3518.6 MiB, both tiers, query 3.3 s to 3.8 s', () => {
    const { run, d } = arm('case3', 'COPC, 6 granules');
    expect(d.objectCount).toBe(6);
    expect(mib(d.totalBytes)).toBe(3518.6);
    expect(Math.round(mib(d.meanObjectBytes))).toBe(586);
    expect(d.tierFit).toEqual(['warm', 'cold']);
    expect(d.readLatencyP50).toBeGreaterThanOrEqual(3.3);
    expect(d.readLatencyP50).toBeLessThanOrEqual(3.8);
    expect(run.codecs).toEqual(['laszip']);
  });

  it('case 4: GeoParquet, two passes, 35.6 MiB', () => {
    const { d } = arm('case4', 'GeoParquet, 2 passes');
    expect(d.objectCount).toBe(2);
    expect(mib(d.totalBytes)).toBe(35.6);
  });

  it('every bundled run says where it comes from, and keeps no product ids', () => {
    for (const id of ['case1', 'case2', 'case3', 'case4']) {
      const text = readFileSync(join(__dirname, '..', 'public', 'runs', `${id}.json`), 'utf8');
      expect(text).not.toMatch(/product_ids|SENTINEL2A_|S1A_|SWOT_L2_HR_|"pattern"/);
      for (const r of runs(id)) expect(r.source).toMatch(/cng-formats-benchmark/);
    }
  });
});
