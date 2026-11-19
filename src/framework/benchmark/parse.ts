/**
 * Validate and normalize a `result.json` from `cng-benchmark run --output`.
 * Schema: BenchmarkRun in src/cng_benchmark/models.py of
 * developmentseed/cng-formats-benchmark. A product-set roll-up has the same schema.
 *
 * Hand-written type guards, no schema library. The file stays in the browser.
 */
import { formatFromBenchmarkId } from '../data/formats';
import type { AnyFormatId } from '../types';

export interface HistogramBin {
  lower: number;
  upper: number;
  count: number;
}

export interface ObjectProfile {
  count: number;
  totalBytes: number;
  mean: number;
  p50: number;
  p90?: number;
  minBytes?: number;
  maxBytes?: number;
  histogram: HistogramBin[];
  /** As the harness computed it, with the tier policy of the run. */
  tierFit: string[];
  highestTier: string | null;
}

export interface Metric {
  name: string;
  /** `null` when the harness wrote a non-finite value (JSON has no Infinity). */
  value: number | null;
  unit?: string;
}

export interface ConditionSummary {
  phase: string;
  cache: string;
  concurrency: number;
  replicates: number;
  aggregate: Metric[];
}

export interface RunFlags {
  contentSubset: boolean;
  geometryFabricated: boolean;
  geometrySynthesized: boolean;
  readSkipped: boolean;
  displaySkipped: boolean;
  writeSkipped: boolean;
}

export interface ParsedRun {
  /** Unique id in the session: file name plus index in the file. */
  id: string;
  fileName: string;
  timestamp: string;
  datasetId: string;
  formatId: string;
  candidate: AnyFormatId | null;
  scope?: string;
  profile: ObjectProfile | null;
  metrics: Metric[];
  layoutKinds: string[];
  codecs: string[];
  /**
   * Compression ratio of the whole run: bytes before compression / stored bytes,
   * over the layouts that report a ratio. A plain mean of the per-object ratios
   * is wrong: a few tiny, very compressible objects (masks) dominate it.
   */
  compressionRatio?: number;
  conditions: ConditionSummary[];
  flags: RunFlags;
  armLabel: string;
}

export type ParseResult =
  | { ok: true; run: ParsedRun }
  | { ok: false; fileName: string; error: string };

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

class ParseError extends Error {}

function req<T>(ok: boolean, value: T, msg: string): T {
  if (!ok) throw new ParseError(msg);
  return value;
}

function reqString(o: Obj, key: string, where: string): string {
  const v = o[key];
  return req(typeof v === 'string' && v.trim() !== '', v as string, `${where}: "${key}" must be a non-empty string.`);
}

function reqNum(o: Obj, key: string, where: string): number {
  const v = o[key];
  return req(num(v), v as number, `${where}: "${key}" must be a number.`);
}

function optNum(o: Obj, key: string): number | undefined {
  const v = o[key];
  return num(v) ? v : undefined;
}

function parseMetric(v: unknown, where: string): Metric {
  req(isObj(v), null, `${where}: each metric must be an object.`);
  const o = v as Obj;
  const name = reqString(o, 'name', where);
  const value = o.value;
  req(value === null || num(value), null, `${where}: metric "${name}" must have a number value.`);
  const unit = typeof o.unit === 'string' ? o.unit : undefined;
  return { name, value: value as number | null, ...(unit ? { unit } : {}) };
}

function parseProfile(v: unknown): ObjectProfile | null {
  if (v === null || v === undefined) return null;
  req(isObj(v), null, '"object_profile" must be an object or null.');
  const o = v as Obj;
  const w = 'object_profile';
  const histogram = Array.isArray(o.histogram) ? o.histogram : [];
  return {
    count: reqNum(o, 'count', w),
    totalBytes: reqNum(o, 'total_bytes', w),
    mean: reqNum(o, 'mean', w),
    p50: num(o.p50) ? o.p50 : reqNum(o, 'median', w),
    p90: optNum(o, 'p90'),
    minBytes: optNum(o, 'min_bytes'),
    maxBytes: optNum(o, 'max_bytes'),
    histogram: histogram
      .filter(isObj)
      .filter((b) => num(b.lower) && num(b.upper) && num(b.count))
      .map((b) => ({ lower: b.lower as number, upper: b.upper as number, count: b.count as number })),
    tierFit: Array.isArray(o.tier_fit) ? o.tier_fit.filter((t): t is string => typeof t === 'string') : [],
    highestTier: typeof o.highest_tier === 'string' ? o.highest_tier : null,
  };
}

function parseConditions(v: unknown): ConditionSummary[] {
  if (v === undefined || v === null) return [];
  req(Array.isArray(v), null, '"conditions" must be a list.');
  return (v as unknown[]).map((c, i) => {
    const w = `conditions[${i}]`;
    req(isObj(c), null, `${w} must be an object.`);
    const o = c as Obj;
    const aggregate = Array.isArray(o.aggregate) ? o.aggregate.map((m, j) => parseMetric(m, `${w}.aggregate[${j}]`)) : [];
    return {
      phase: reqString(o, 'phase', w),
      cache: typeof o.cache === 'string' ? o.cache : 'unknown',
      concurrency: num(o.concurrency) ? o.concurrency : 1,
      replicates: Array.isArray(o.replicates) ? o.replicates.length : 0,
      aggregate,
    };
  });
}

function parseOne(v: unknown, fileName: string, index: number, total: number): ParsedRun {
  req(isObj(v), null, 'The file must hold a BenchmarkRun JSON object.');
  const o = v as Obj;
  const where = 'BenchmarkRun';
  const datasetId = reqString(o, 'dataset_id', where);
  const formatId = reqString(o, 'format_id', where);
  const timestamp = reqString(o, 'timestamp', where);
  const params = isObj(o.params) ? o.params : {};
  const metricsRaw = o.metrics ?? [];
  req(Array.isArray(metricsRaw), null, '"metrics" must be a list.');
  const metrics = (metricsRaw as unknown[]).map((m, i) => parseMetric(m, `metrics[${i}]`));
  const layoutsRaw = o.object_layouts ?? [];
  req(Array.isArray(layoutsRaw), null, '"object_layouts" must be a list.');
  const layouts = (layoutsRaw as unknown[]).filter(isObj);
  req(layouts.length === (layoutsRaw as unknown[]).length, null, 'Each item of "object_layouts" must be an object.');

  const codecs = [...new Set(layouts.map((l) => l.codec).filter((c): c is string => typeof c === 'string'))];
  const rated = layouts.filter((l) => num(l.compression_ratio) && l.compression_ratio > 0 && num(l.size_bytes) && l.size_bytes > 0);
  const storedBytes = rated.reduce((a, l) => a + (l.size_bytes as number), 0);
  const rawBytes = rated.reduce((a, l) => a + (l.size_bytes as number) * (l.compression_ratio as number), 0);
  const names = new Set(metrics.map((m) => m.name));
  const flags: RunFlags = {
    contentSubset: layouts.some((l) => l.content_subset === true),
    geometryFabricated: layouts.some((l) => l.geometry_fabricated === true),
    geometrySynthesized: layouts.some((l) => l.geometry_synthesized === true),
    readSkipped: names.has('read_skipped'),
    displaySkipped: names.has('display_skipped'),
    writeSkipped: names.has('write_skipped'),
  };
  const scope = typeof params.scope === 'string' ? params.scope : undefined;
  const candidate = formatFromBenchmarkId(formatId);
  const armLabel = buildArmLabel({ formatId, codecs, params, scope, timestamp, fileName, index, total });

  return {
    id: `${fileName}#${index}`,
    fileName,
    timestamp,
    datasetId,
    formatId,
    candidate,
    scope,
    profile: parseProfile(o.object_profile),
    metrics,
    layoutKinds: [...new Set(layouts.map((l) => l.kind).filter((k): k is string => typeof k === 'string'))],
    codecs,
    ...(storedBytes > 0 ? { compressionRatio: rawBytes / storedBytes } : {}),
    conditions: parseConditions(o.conditions),
    flags,
    armLabel,
  };
}

/**
 * A label that tells two arms apart without the file name: real runs are all
 * named result.json. Example: "geozarr · zstd · no pyramid · roll-up of 16 · 2026-08-14 11:35".
 */
function buildArmLabel(a: {
  formatId: string;
  codecs: string[];
  params: Obj;
  scope?: string;
  timestamp: string;
  fileName: string;
  index: number;
  total: number;
}): string {
  const parts: string[] = [a.formatId];
  if (a.codecs.length) parts.push(a.codecs.join('+'));
  const ml = a.params.multiscale_levels;
  if (ml === 0) parts.push('no pyramid');
  else if (ml !== undefined && ml !== null) parts.push('pyramid');
  if (a.scope === 'rollup') {
    const n = a.params.product_count;
    parts.push(num(n) ? `roll-up of ${n}` : 'roll-up');
  }
  const t = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(a.timestamp);
  parts.push(t ? `${t[1]} ${t[2]}` : a.timestamp);
  const base = a.fileName.split('/').pop() ?? a.fileName;
  if (base !== 'result.json') parts.push(base);
  if (a.total > 1) parts.push(`#${a.index + 1}`);
  return parts.join(' · ');
}

/** Parse the text of one file. A file can hold one run or a list of runs. */
export function parseBenchmarkText(text: string, fileName: string): ParseResult[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [{ ok: false, fileName, error: `Not valid JSON: ${(e as Error).message}` }];
  }
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return [{ ok: false, fileName, error: 'The file holds an empty list.' }];
  return items.map((item, i) => {
    try {
      return { ok: true as const, run: parseOne(item, fileName, i, items.length) };
    } catch (e) {
      if (e instanceof ParseError) {
        const prefix = items.length > 1 ? `Item ${i + 1}: ` : '';
        return { ok: false as const, fileName, error: prefix + e.message };
      }
      throw e;
    }
  });
}
