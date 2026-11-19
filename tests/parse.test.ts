import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveRun, armsByFormat, runWarnings, selectedMeasurements, setWarnings } from '../src/framework/benchmark/criteria';
import { parseBenchmarkText, type ParsedRun } from '../src/framework/benchmark/parse';
import { CNES_TIERS } from '../src/framework/data/tiers';

const MiB = 1024 * 1024;
const fx = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const ok = (name: string): ParsedRun => {
  const [r] = parseBenchmarkText(fx(name), name);
  if (!r || !r.ok) throw new Error(`fixture ${name} did not parse: ${r && !r.ok ? r.error : ''}`);
  return r.run;
};

describe('benchmark parser', () => {
  it('parses a valid result.json', () => {
    const run = ok('cog-zstd.json');
    expect(run.formatId).toBe('cog');
    expect(run.candidate).toBe('cog');
    expect(run.datasetId).toBe('synthetic-raster');
    expect(run.profile!.count).toBe(10);
    expect(run.profile!.mean).toBe(40 * MiB);
    expect(run.codecs).toEqual(['zstd']);
    expect(run.compressionRatio).toBe(2.1);
    expect(run.armLabel).toContain('zstd');
  });

  it('derives the criteria, with the tier fit computed again from the mean', () => {
    const d = deriveRun(ok('cog-zstd.json'), CNES_TIERS);
    expect(d.objectCount).toBe(10);
    expect(d.totalBytes).toBe(400 * MiB);
    expect(d.readLatencyP50).toBe(0.12);
    expect(d.displayLatency).toBeCloseTo(0.25);
    expect(d.writeThroughput).toBe(20 * MiB);
    expect(d.tierFit).toEqual(['warm']);
    expect(d.highestTier).toBe('warm');
    expect(deriveRun(ok('cog-zstd.json'), [{ name: 'big', minObjectBytes: 64 * MiB }]).tierFit).toEqual([]);
  });

  it('gives a clear error for a bad file', () => {
    const [r] = parseBenchmarkText(fx('bad-missing-format.json'), 'bad.json');
    expect(r!.ok).toBe(false);
    expect(!r!.ok && r!.error).toMatch(/format_id/);
    const [j] = parseBenchmarkText('{not json', 'x.json');
    expect(!j!.ok && j!.error).toMatch(/Not valid JSON/);
    const [m] = parseBenchmarkText('{"timestamp":"t","dataset_id":"d","format_id":"cog","metrics":[{"name":"x","value":"fast"}]}', 'm.json');
    expect(!m!.ok && m!.error).toMatch(/metric "x"/);
  });

  it('two runs of one format are two arms; the selection picks one', () => {
    const zstd = ok('cog-zstd.json');
    const deflate = ok('cog-deflate.json');
    const gz = ok('geozarr.json');
    const arms = armsByFormat([zstd, deflate, gz]);
    expect(arms.cog!.map((r) => r.id)).toEqual([zstd.id, deflate.id]);
    const first = selectedMeasurements([zstd, deflate, gz], {}, CNES_TIERS);
    expect(first.cog!.totalBytes).toBe(400 * MiB);
    const chosen = selectedMeasurements([zstd, deflate, gz], { cog: deflate.id }, CNES_TIERS);
    expect(chosen.cog!.totalBytes).toBe(410 * MiB);
    expect(chosen.geozarr!.meanObjectBytes).toBe(8 * MiB);
  });

  it('warns on content subsets, synthesized geometry, skipped reads and mixed datasets', () => {
    const fgb = ok('flatgeobuf-subset.json');
    const w = runWarnings(fgb).join(' ');
    expect(w).toMatch(/Content subset/);
    expect(w).toMatch(/Geometry synthesized/);
    expect(w).toMatch(/Read skipped/);
    expect(fgb.metrics.find((m) => m.name === 'read_decoded_throughput')!.value).toBeNull();
    expect(setWarnings([fgb, ok('cog-zstd.json')]).join(' ')).toMatch(/not like for like/);
    expect(setWarnings([ok('cog-zstd.json'), ok('geozarr.json')])).toEqual([]);
  });

  it('reads a product-set roll-up: read and display from the warm, one-worker condition', () => {
    const roll = ok('rollup.json');
    expect(roll.scope).toBe('rollup');
    expect(roll.armLabel).toContain('roll-up');
    const d = deriveRun(roll, CNES_TIERS);
    expect(d.readLatencyP50).toBe(0.5);
    expect(d.displayLatency).toBeCloseTo(0.3);
    expect(d.tierFit).toEqual(['warm', 'cold']);
    expect(d.objectCount).toBe(30);
  });

  it('a file can hold a list of runs', () => {
    const list = JSON.stringify([JSON.parse(fx('cog-zstd.json')), JSON.parse(fx('geozarr.json'))]);
    const rs = parseBenchmarkText(list, 'list.json');
    expect(rs.map((r) => r.ok)).toEqual([true, true]);
    const ids = rs.map((r) => (r.ok ? r.run.id : ''));
    expect(new Set(ids).size).toBe(2);
  });

  it('an unknown format_id parses, with a warning', () => {
    const [r] = parseBenchmarkText('{"timestamp":"t","dataset_id":"d","format_id":"tiledb"}', 'u.json');
    expect(r!.ok && r!.run.candidate).toBeNull();
    expect(r!.ok && runWarnings(r!.run).join(' ')).toMatch(/Unknown format_id/);
  });
});
