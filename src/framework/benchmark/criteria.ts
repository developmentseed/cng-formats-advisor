/**
 * Derived values from parsed benchmark runs: the measurements that the score
 * uses, the tier fit with the dashboard policy, and the warnings.
 */
import { tierFit, highestTier } from '../data/tiers';
import type { AnyFormatId, CandidateMeasurements, FormatId, Tier } from '../types';
import type { Metric, ParsedRun } from './parse';

function metricValue(metrics: Metric[], name: string): number | undefined {
  const m = metrics.find((x) => x.name === name);
  return m && m.value !== null ? m.value : undefined;
}

/** The display latencies: metrics named `display_<label>_latency`. */
export function displayLatencies(run: ParsedRun): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  for (const m of run.metrics) {
    const match = /^display_(.+)_latency$/.exec(m.name);
    if (match && match[1] && m.value !== null) out.push({ label: match[1], value: m.value });
  }
  return out;
}

/**
 * A metric from the condition aggregates, for roll-ups that carry read and
 * display results only in `conditions`. Prefers warm cache, one worker.
 */
function conditionValue(run: ParsedRun, phase: string, name: string | RegExp): number[] {
  const conds = run.conditions
    .filter((c) => c.phase === phase)
    .sort((a, b) => score(a) - score(b));
  for (const c of conds) {
    const vals = c.aggregate
      .filter((m) => (typeof name === 'string' ? m.name === name : name.test(m.name)))
      .map((m) => m.value)
      .filter((v): v is number => v !== null);
    if (vals.length) return vals;
  }
  return [];
  function score(c: { cache: string; concurrency: number }) {
    return (c.cache === 'warm' ? 0 : 10) + c.concurrency;
  }
}

function mean(vals: number[]): number | undefined {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
}

export interface DerivedRun {
  objectCount?: number;
  totalBytes?: number;
  meanObjectBytes?: number;
  p50ObjectBytes?: number;
  tierFit: string[];
  highestTier: string | null;
  readLatencyP50?: number;
  displayLatency?: number;
  writeThroughput?: number;
  compressionRatio?: number;
  codecs: string[];
}

export function deriveRun(run: ParsedRun, tiers: Tier[]): DerivedRun {
  const p = run.profile;
  const read = metricValue(run.metrics, 'read_latency_p50') ?? conditionValue(run, 'read', 'read_latency_p50')[0];
  const disp = displayLatencies(run).map((d) => d.value);
  const display = mean(disp.length ? disp : conditionValue(run, 'display', /^display_.+_latency$/));
  const total = p?.totalBytes ?? metricValue(run.metrics, 'total_bytes');
  const count = p?.count ?? metricValue(run.metrics, 'object_count');
  return {
    ...(count !== undefined ? { objectCount: count } : {}),
    ...(total !== undefined ? { totalBytes: total } : {}),
    ...(p ? { meanObjectBytes: p.mean, p50ObjectBytes: p.p50 } : {}),
    tierFit: p ? tierFit(p.mean, tiers) : [],
    highestTier: p ? highestTier(p.mean, tiers) : null,
    ...(read !== undefined ? { readLatencyP50: read } : {}),
    ...(display !== undefined ? { displayLatency: display } : {}),
    ...(metricValue(run.metrics, 'write_throughput') !== undefined
      ? { writeThroughput: metricValue(run.metrics, 'write_throughput') }
      : {}),
    ...(run.compressionRatio !== undefined ? { compressionRatio: run.compressionRatio } : {}),
    codecs: run.codecs,
  };
}

export function toMeasurements(d: DerivedRun): CandidateMeasurements {
  return {
    meanObjectBytes: d.meanObjectBytes,
    totalBytes: d.totalBytes,
    readLatencyP50: d.readLatencyP50,
    displayLatency: d.displayLatency,
    writeThroughput: d.writeThroughput,
  };
}

/** Group runs as arms per candidate format. Runs with an unknown format are left out. */
export function armsByFormat(runs: ParsedRun[]): Partial<Record<AnyFormatId, ParsedRun[]>> {
  const out: Partial<Record<AnyFormatId, ParsedRun[]>> = {};
  for (const r of runs) {
    if (!r.candidate) continue;
    (out[r.candidate] ??= []).push(r);
  }
  return out;
}

/**
 * The measurements for the score: one selected arm per format.
 * When no arm is selected for a format, the first arm is used.
 */
export function selectedMeasurements(
  runs: ParsedRun[],
  selection: Partial<Record<AnyFormatId, string>>,
  tiers: Tier[],
): Partial<Record<FormatId, CandidateMeasurements>> {
  const out: Partial<Record<FormatId, CandidateMeasurements>> = {};
  const arms = armsByFormat(runs);
  for (const [fmt, list] of Object.entries(arms) as [AnyFormatId, ParsedRun[]][]) {
    if (fmt === 'virtual-zarr' || !list.length) continue;
    const chosen = list.find((r) => r.id === selection[fmt]) ?? list[0]!;
    out[fmt] = toMeasurements(deriveRun(chosen, tiers));
  }
  return out;
}

/** Warnings for one run. */
export function runWarnings(run: ParsedRun): string[] {
  const w: string[] = [];
  if (!run.candidate) w.push(`Unknown format_id "${run.formatId}": not mapped to a candidate. The table shows it, the score does not use it.`);
  if (run.flags.contentSubset) w.push('Content subset: some features were dropped. A smaller size is not a like-for-like comparison.');
  if (run.flags.geometryFabricated) w.push('Geometry fabricated: placeholder geometries were written. Part of the stored size is not source bytes.');
  if (run.flags.geometrySynthesized) w.push('Geometry synthesized: some geometries were built from attribute columns.');
  if (run.flags.readSkipped) w.push('Read skipped: the read measurement failed or did not run.');
  if (run.flags.displaySkipped) w.push('Display skipped: the display measurement failed or did not run.');
  if (run.flags.writeSkipped) w.push('Write skipped for some components.');
  return w;
}

/** Warnings across all runs: runs on different datasets are not like for like. */
export function setWarnings(runs: ParsedRun[]): string[] {
  const ids = [...new Set(runs.map((r) => r.datasetId))];
  if (ids.length > 1) {
    return [`The runs use different datasets (${ids.join(', ')}). The comparison is not like for like.`];
  }
  return [];
}
