/**
 * The decision state, and its round trip through the URL hash (the share link).
 * Uploaded benchmark data is NOT in the state: it stays in the browser memory.
 */
import { BLANK_ANSWERS, getCase } from './data/cases';
import { INTENTS } from './data/intents';
import { BENCHMARK_TERMS, DEFAULT_INPUTS, PRESET_INPUTS, type CasePresetId } from './data/judgements';
import { CNES_TIERS, normalizeTiers } from './data/tiers';
import { BENCHMARK_CRITERIA } from './score';
import type {
  Answer,
  BenchmarkCriterion,
  ControlAnswers,
  Importance,
  Intent,
  MaturityLevel,
  ParserFormat,
  ProcessingMode,
  ScoreInputs,
  Tier,
  TierPolicy,
  TierPolicyKind,
  Topology,
} from './types';

export interface AppState extends ScoreInputs {
  preset: CasePresetId | null;
  answers: ControlAnswers;
  /** Thresholds for the custom tier policy, kept when you switch policy. */
  customTiers: Tier[];
}

const MiB = 1024 * 1024;

export const DEFAULT_CUSTOM_TIERS: Tier[] = [{ name: 'tier 1', minObjectBytes: 64 * MiB }];

function policy(kind: TierPolicyKind, custom: Tier[]): TierPolicy {
  if (kind === 'cnes') return { kind, tiers: CNES_TIERS };
  if (kind === 'custom') return { kind, tiers: normalizeTiers(custom) };
  return { kind: 'none', tiers: [] };
}

function zeroBench(): Record<BenchmarkCriterion, number> {
  const w = BENCHMARK_TERMS.defaultWeight.value;
  return { storage: w, read: w, display: w, write: w };
}

export function defaultState(): AppState {
  return {
    preset: null,
    answers: { ...BLANK_ANSWERS },
    topology: DEFAULT_INPUTS.topology.value,
    intentWeights: { ...DEFAULT_INPUTS.intentWeights.value },
    processingMode: DEFAULT_INPUTS.processingMode.value,
    minMaturity: DEFAULT_INPUTS.minMaturity.value,
    encodingImportance: DEFAULT_INPUTS.encodingImportance.value,
    tierPolicy: policy('none', DEFAULT_CUSTOM_TIERS),
    customTiers: DEFAULT_CUSTOM_TIERS,
    benchmarkWeights: zeroBench(),
  };
}

export function presetState(id: CasePresetId): AppState {
  const c = getCase(id);
  const p = PRESET_INPUTS[id];
  const base = defaultState();
  if (!c) return base;
  return {
    ...base,
    preset: id,
    answers: { ...c.answers },
    topology: p.topology.value,
    intentWeights: { ...p.intentWeights.value },
    processingMode: p.processingMode.value,
    minMaturity: p.minMaturity.value,
    encodingImportance: p.encodingImportance.value,
    tierPolicy: policy(c.tierPolicy, base.customTiers),
  };
}

export function withTierPolicy(s: AppState, kind: TierPolicyKind, custom: Tier[] = s.customTiers): AppState {
  return { ...s, customTiers: custom, tierPolicy: policy(kind, custom) };
}

/* ---------- hash encoding ---------- */

const TOPO: Record<string, Topology> = { r2: 'raster-2d', nd: 'nd-cube', pc: 'point-cloud', vt: 'vector' };
const TOPO_INV = Object.fromEntries(Object.entries(TOPO).map(([k, v]) => [v, k])) as Record<Topology, string>;
const IMP: Record<string, Importance> = { l: 'low', m: 'medium', h: 'high' };
const PM: Record<string, ProcessingMode> = { f: 'on-the-fly', b: 'batched' };
const PARSERS: ParserFormat[] = ['netcdf4', 'hdf5', 'grib2', 'tiff', 'fits', 'other'];
const PRESETS = Object.keys(PRESET_INPUTS) as CasePresetId[];

const ANSWER_KEYS: [keyof ControlAnswers, string][] = [
  ['existingData', 'ex'],
  ['mandate', 'md'],
  ['canReprocess', 'rp'],
  ['canRepackage', 'rk'],
  ['chunkedInternally', 'ck'],
  ['workableChunkSize', 'cs'],
  ['existingUsers', 'eu'],
];

function inv<T extends string>(map: Record<string, T>, v: T): string {
  return Object.keys(map).find((k) => map[k] === v) ?? '';
}

function clampWeight(n: number): number {
  return Number.isFinite(n) ? Math.min(3, Math.max(0, Math.round(n))) : 0;
}

export function stateToHash(s: AppState): string {
  const q = new URLSearchParams();
  q.set('v', '1');
  if (s.preset) q.set('p', s.preset);
  for (const [key, short] of ANSWER_KEYS) {
    const v = s.answers[key] as Answer;
    if (v !== null) q.set(short, v ? '1' : '0');
  }
  if (s.answers.sourceFormat) q.set('sf', s.answers.sourceFormat);
  if (s.topology) q.set('t', TOPO_INV[s.topology]);
  q.set('w', INTENTS.map((i) => s.intentWeights[i]).join('.'));
  q.set('pm', inv(PM, s.processingMode));
  q.set('mm', String(s.minMaturity));
  q.set('ei', inv(IMP, s.encodingImportance));
  q.set('tp', s.tierPolicy.kind);
  if (s.tierPolicy.kind === 'custom') {
    q.set('tc', s.tierPolicy.tiers.map((t) => `${encodeURIComponent(t.name)}:${t.minObjectBytes}`).join(','));
  }
  const bw = BENCHMARK_CRITERIA.map((c) => s.benchmarkWeights[c]);
  if (bw.some((w) => w > 0)) q.set('bw', bw.join('.'));
  return '#' + q.toString();
}

/** Parse a hash. Unknown or bad values fall back to the defaults. */
export function hashToState(hash: string): AppState | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const q = new URLSearchParams(raw);
  if (q.get('v') !== '1') return null;
  const s = defaultState();

  const p = q.get('p');
  if (p && (PRESETS as string[]).includes(p)) s.preset = p as CasePresetId;

  for (const [key, short] of ANSWER_KEYS) {
    const v = q.get(short);
    if (v === '1' || v === '0') (s.answers as unknown as Record<string, Answer>)[key] = v === '1';
  }
  const sf = q.get('sf');
  if (sf && (PARSERS as string[]).includes(sf)) s.answers.sourceFormat = sf as ParserFormat;

  const t = q.get('t');
  if (t && TOPO[t]) s.topology = TOPO[t]!;

  const w = q.get('w')?.split('.').map(Number);
  if (w && w.length === INTENTS.length) {
    INTENTS.forEach((i: Intent, idx) => (s.intentWeights[i] = clampWeight(w[idx]!)));
  }
  const pm = q.get('pm');
  if (pm && PM[pm]) s.processingMode = PM[pm]!;
  const mm = Number(q.get('mm'));
  if ([1, 2, 3, 4, 5].includes(mm)) s.minMaturity = mm as MaturityLevel;
  const ei = q.get('ei');
  if (ei && IMP[ei]) s.encodingImportance = IMP[ei]!;

  const tp = q.get('tp');
  if (tp === 'custom') {
    const tiers = (q.get('tc') ?? '')
      .split(',')
      .map((part) => {
        const idx = part.lastIndexOf(':');
        return { name: decodeURIComponent(part.slice(0, idx)), minObjectBytes: Number(part.slice(idx + 1)) };
      });
    const valid = normalizeTiers(tiers);
    return withTierPolicy({ ...s, ...benchFrom(q) }, 'custom', valid.length ? valid : DEFAULT_CUSTOM_TIERS);
  }
  if (tp === 'cnes' || tp === 'none') return withTierPolicy({ ...s, ...benchFrom(q) }, tp);
  return { ...s, ...benchFrom(q) };
}

function benchFrom(q: URLSearchParams): Pick<AppState, 'benchmarkWeights'> {
  const bw = q.get('bw')?.split('.').map(Number);
  const out = zeroBench();
  if (bw && bw.length === BENCHMARK_CRITERIA.length) {
    BENCHMARK_CRITERIA.forEach((c, i) => (out[c] = clampWeight(bw[i]!)));
  }
  return { benchmarkWeights: out };
}
