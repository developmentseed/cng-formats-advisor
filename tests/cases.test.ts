/**
 * One test per case study of the guide: the engine, with the preset inputs,
 * gives the outcome of the guide ("Where it lands").
 */
import { describe, expect, it } from 'vitest';
import { decideControl } from '../src/framework/control';
import { CASES, getCase } from '../src/framework/data/cases';
import { rank } from '../src/framework/score';
import { presetState } from '../src/framework/state';
import type { CasePresetId } from '../src/framework/data/judgements';

function run(id: CasePresetId) {
  const s = presetState(id);
  const control = decideControl(s.answers);
  const ranking = control.continuesToStage2 ? rank(s) : null;
  return { s, control, ranking, order: ranking?.candidates.map((c) => c.format) ?? [] };
}

describe('guide case studies', () => {
  it('case 1, Sentinel-2 L2A: free choice, 2D raster, COG first', () => {
    const { control, order, s } = run('case1');
    expect(control.kind).toBe('free');
    expect(s.topology).toBe('raster-2d');
    expect(order[0]).toBe('cog');
    expect(order).toContain('geozarr');
  });

  it('case 2, Sentinel-1 RTC: COG and GeoZarr on top', () => {
    const { control, order, ranking } = run('case2');
    expect(control.kind).toBe('free');
    expect(order.slice(0, 2).sort()).toEqual(['cog', 'geozarr']);
    // GeoZarr is L2: below the L3 limit, so it carries the "plan for change" warning.
    const gz = ranking!.candidates.find((c) => c.format === 'geozarr')!;
    expect(gz.warnings.some((w) => w.kind === 'maturity')).toBe(true);
  });

  it('case 3, SWOT Pixel Cloud: COPC first', () => {
    const { control, order } = run('case3');
    expect(control.kind).toBe('free');
    expect(order).toEqual(['copc', 'geoparquet']);
  });

  it('case 4, SWOT Lake Single Pass: GeoParquet first', () => {
    const { control, order } = run('case4');
    expect(control.kind).toBe('free');
    expect(order[0]).toBe('geoparquet');
    expect(order[1]).toBe('flatgeobuf');
  });

  it('case 5, SWOT Raster: COG first', () => {
    const { control, order } = run('case5');
    expect(control.kind).toBe('free');
    expect(order[0]).toBe('cog');
    expect(order[1]).toBe('geozarr');
  });

  it('case 6, frozen archive: Virtual Zarr, no Stage 2', () => {
    const { control, ranking } = run('case6');
    expect(control.kind).toBe('virtual');
    expect(control.continuesToStage2).toBe(false);
    expect(ranking).toBeNull();
  });

  it('each guide case matches its expectedTop data', () => {
    for (const c of CASES.filter((x) => x.inGuide && x.expectedTop.length)) {
      const { order } = run(c.id);
      expect(order.slice(0, c.expectedTop.length).sort()).toEqual([...c.expectedTop].sort());
    }
  });

  it('the presets that are not in the guide carry the label', () => {
    expect(getCase('s2-l2b-snow')!.inGuide).toBe(false);
    expect(getCase('new-product')!.inGuide).toBe(false);
    expect(CASES.filter((c) => c.inGuide)).toHaveLength(6);
  });

  it('cases 1 to 5 carry published measurements, case 6 has none', () => {
    for (const id of ['case1', 'case2', 'case3', 'case4', 'case5'] as const) {
      expect(getCase(id)!.measurements.length).toBeGreaterThan(0);
    }
    expect(getCase('case6')!.measurements).toHaveLength(0);
  });
});
