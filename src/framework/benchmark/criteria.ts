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

const DISPLAY_RE = /^display_(.+)_latency$/;

function displayFrom(metrics: Metric[]): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  for (const m of metrics) {
    const match = DISPLAY_RE.exec(m.name);
    if (match && match[1] && m.value !== null) out.push({ label: match[1], value: m.value });
  }
  return out;
}

/**
 * The display latency per scenario: metrics named `display_<label>_latency`.
 * A roll-up carries them only in the display condition (warm, one worker first).
 */
export function displayLatencies(run: ParsedRun): { label: string; value: number }[] {
  const top = displayFrom(run.metrics);
  if (top.length) return top;
  const cond = run.conditions
    .filter((c) => c.phase === 'display')
    .sort((a, b) => (a.cache === 'warm' ? 0 : 10) + a.concurrency - ((b.cache === 'warm' ? 0 : 10) + b.concurrency))[0];
  return cond ? displayFrom(cond.aggregate) : [];
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
  /** Mean over all the display scenarios of this run. */
  displayLatency?: number;
  /** Display latency per scenario label. */
  displayByLabel: Record<string, number>;
  writeThroughput?: number;
  compressionRatio?: number;
  codecs: string[];
}

export function deriveRun(run: ParsedRun, tiers: Tier[]): DerivedRun {
  const p = run.profile;
  const read = metricValue(run.metrics, 'read_latency_p50') ?? conditionValue(run, 'read', 'read_latency_p50')[0];
  const scenarios = displayLatencies(run);
  const display = mean(scenarios.map((d) => d.value));
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
    displayByLabel: Object.fromEntries(scenarios.map((d) => [d.label, d.value])),
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
  const derived: Partial<Record<FormatId, DerivedRun>> = {};
  const arms = armsByFormat(runs);
  for (const [fmt, list] of Object.entries(arms) as [AnyFormatId, ParsedRun[]][]) {
    if (fmt === 'virtual-zarr' || !list.length) continue;
    const chosen = list.find((r) => r.id === selection[fmt]) ?? list[0]!;
    derived[fmt] = deriveRun(chosen, tiers);
    out[fmt] = toMeasurements(derived[fmt]!);
  }
  // Display: compare like for like, on the scenarios that every measured arm shares.
  const withDisplay = (Object.keys(derived) as FormatId[]).filter((f) => Object.keys(derived[f]!.displayByLabel).length);
  if (withDisplay.length >= 2) {
    const common = Object.keys(derived[withDisplay[0]!]!.displayByLabel).filter((label) =>
      withDisplay.every((f) => label in derived[f]!.displayByLabel),
    );
    for (const f of withDisplay) {
      const vals = common.map((label) => derived[f]!.displayByLabel[label]!);
      out[f] = { ...out[f], displayLatency: mean(vals), displayScenarios: common.length };
    }
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

/** Same run: same dataset, format, timestamp, scope, codecs and total size. */
function runKey(r: ParsedRun): string {
  return [r.datasetId, r.formatId, r.timestamp, r.scope ?? '', r.codecs.join('+'), r.profile?.totalBytes ?? ''].join('|');
}

/**
 * Add uploaded runs to the current list. Each new run gets a unique id (many
 * files have the same name, result.json). A run that is already in the list
 * (same dataset, format, timestamp, scope, codecs and size) is replaced, not duplicated.
 */
export function mergeRuns(prev: ParsedRun[], incoming: ParsedRun[], uploadSeq: number): ParsedRun[] {
  const fresh = incoming.map((r, i) => ({ ...r, id: `u${uploadSeq}-${i}` }));
  const keys = new Set(fresh.map(runKey));
  const seen = new Set<string>();
  const unique = fresh.filter((r) => {
    const k = runKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return [...prev.filter((r) => !keys.has(runKey(r))), ...unique];
}
