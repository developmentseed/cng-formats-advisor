/**
 * Stage 2, refinement: a transparent weighted score with a visible breakdown.
 *
 * score = 100 * sum(weight * value) / sum(weight), over the terms that have a
 * value for this candidate. Each value is between 0 and 1. A term with no
 * measurement is left out of the mean and the card says so. A maturity or
 * encoding term that the guide does not rate takes the mean value of the rated
 * candidates in the family (neutral). No format is removed: all family members
 * are ranked.
 */
import { FAMILIES } from './data/families';
import { FORMATS, MATURITY_SCALE } from './data/formats';
import { REF } from './data/guide';
import { INTENTS, INTENT_LABEL, INTENT_NOTES, PROCESSING_LAYOUT_ADVICE } from './data/intents';
import {
  CLOSE_MARGIN,
  ENCODING_TERM,
  INTENT_FIT,
  MATURITY_TERM,
  OBJECT_SIZE_TERM,
} from './data/judgements';
import { tierFit } from './data/tiers';
import type {
  BenchmarkCriterion,
  CandidateMeasurements,
  FormatId,
  RankedCandidate,
  Ranking,
  ScoreInputs,
  ScoreTerm,
  Warning,
} from './types';

export const BENCHMARK_CRITERIA: BenchmarkCriterion[] = ['storage', 'read', 'display', 'write'];

export const BENCHMARK_LABEL: Record<BenchmarkCriterion, string> = {
  storage: 'Storage volume',
  read: 'Read latency',
  display: 'Display latency',
  write: 'Write throughput',
};

type Measures = Partial<Record<FormatId, CandidateMeasurements>>;

interface BenchSpec {
  key: keyof CandidateMeasurements;
  lowerIsBetter: boolean;
  unitText: (v: number) => string;
}

const BENCH_SPEC: Record<BenchmarkCriterion, BenchSpec> = {
  storage: { key: 'totalBytes', lowerIsBetter: true, unitText: (v) => formatBytes(v) },
  read: { key: 'readLatencyP50', lowerIsBetter: true, unitText: (v) => `${v.toFixed(3)} s (p50)` },
  display: { key: 'displayLatency', lowerIsBetter: true, unitText: (v) => `${v.toFixed(3)} s (mean)` },
  write: { key: 'writeThroughput', lowerIsBetter: false, unitText: (v) => `${formatBytes(v)}/s` },
};

export function formatBytes(n: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let v = n;
  let i = 0;
  while (Math.abs(v) >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function maturityValue(level: number | null, minLevel: number): number | null {
  if (level === null) return null;
  if (level >= minLevel) return 1;
  return Math.max(0, 1 - MATURITY_TERM.penaltyPerLevel.value * (minLevel - level));
}

function encodingValue(format: FormatId): number | null {
  const cls = FORMATS[format].encoding;
  return cls === 'not-rated' ? null : ENCODING_TERM.value[cls].value;
}

function fmtValue(v: number | null): string {
  return v === null ? 'none' : v.toFixed(2);
}

export function rank(inputs: ScoreInputs, measures: Measures = {}): Ranking | null {
  if (inputs.topology === null) return null;
  const family = FAMILIES[inputs.topology];
  const members = family.members;

  // Object size: an absolute tier fit, active when at least one candidate has a mean object size.
  const tiers = inputs.tierPolicy.tiers;
  const sizeActive = tiers.length > 0 && members.some((f) => isNum(measures[f]?.meanObjectBytes));
  // Measured criteria are relative to the best candidate: a comparison needs two or more candidates with data.
  const withData = (c: BenchmarkCriterion) => members.filter((f) => isNum(measures[f]?.[BENCH_SPEC[c].key]));
  const benchActive = BENCHMARK_CRITERIA.filter((c) => inputs.benchmarkWeights[c] > 0 && withData(c).length >= 2);
  const measureNotes = BENCHMARK_CRITERIA.filter((c) => inputs.benchmarkWeights[c] > 0 && withData(c).length < 2).map(
    (c) => {
      const only = withData(c);
      return only.length === 1
        ? `${BENCHMARK_LABEL[c]} is not in the score: only ${FORMATS[only[0]!].name} has data, and a comparison needs two or more formats.`
        : `${BENCHMARK_LABEL[c]} is not in the score: no candidate of this family has data.`;
    },
  );
  // Neutral value for a term that the guide does not rate: the mean of the rated members.
  const rated = (vals: (number | null)[]) => {
    const ok = vals.filter((v): v is number => v !== null);
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
  };
  const neutralMaturity = rated(members.map((f) => maturityValue(FORMATS[f].maturity, inputs.minMaturity)));
  const neutralEncoding = rated(members.map((f) => encodingValue(f)));

  const best: Partial<Record<BenchmarkCriterion, number>> = {};
  for (const c of benchActive) {
    const spec = BENCH_SPEC[c];
    const vals = members.map((f) => measures[f]?.[spec.key]).filter(isNum).filter((v) => v > 0);
    if (vals.length) best[c] = spec.lowerIsBetter ? Math.min(...vals) : Math.max(...vals);
  }

  const scored = members.map((format, order) => {
    const info = FORMATS[format];
    const m = measures[format] ?? {};
    const terms: Omit<ScoreTerm, 'points'>[] = [];
    const warnings: Warning[] = [];

    for (const intent of INTENTS) {
      const w = inputs.intentWeights[intent];
      if (w <= 0) continue;
      const fit = INTENT_FIT[format][intent];
      terms.push({
        kind: `intent:${intent}`,
        label: INTENT_LABEL[intent],
        weight: w,
        value: fit.value / 3,
        explanation: `Fit ${fit.value} of 3. ${fit.why}`,
        ref: fit.ref,
      });
      if (fit.value === 0) {
        warnings.push({
          kind: 'low-fit',
          text: `The guide text points away from ${info.name} for ${INTENT_LABEL[intent].toLowerCase()}.`,
          ref: fit.ref,
        });
      }
    }

    const mv = info.maturity === null ? neutralMaturity : maturityValue(info.maturity, inputs.minMaturity);
    terms.push({
      kind: 'maturity',
      label: 'Ecosystem maturity',
      weight: MATURITY_TERM.weight.value,
      value: mv,
      explanation:
        info.maturity === null
          ? `Not rated in the guide. Neutral value: the mean of the rated formats in this family (${fmtValue(neutralMaturity)}).`
          : `L${info.maturity} (${MATURITY_SCALE[info.maturity]}). You accept L${inputs.minMaturity} or higher.`,
      ref: REF.maturity,
    });
    if (info.maturity === null) {
      warnings.push({ kind: 'maturity-not-rated', text: 'Maturity: not rated in the guide.', ref: REF.maturity });
    } else if (info.maturity < inputs.minMaturity) {
      warnings.push({
        kind: 'maturity',
        text: `L${info.maturity} is below the lowest level you accept (L${inputs.minMaturity}). Plan for change: budget for convention churn, pin the versions you depend on.`,
        ref: REF.maturityWarning,
      });
    }

    const encWeight = ENCODING_TERM.weight[inputs.encodingImportance].value;
    const encValue = info.encoding === 'not-rated' ? neutralEncoding : encodingValue(format);
    terms.push({
      kind: 'encoding',
      label: 'Interpretation encoding',
      weight: encWeight,
      value: encValue,
      explanation:
        info.encoding === 'not-rated'
          ? `Not rated in the guide. Neutral value: the mean of the rated formats in this family (${fmtValue(neutralEncoding)}).`
          : info.encoding === 'first-class'
            ? 'First-class: units, CRS, fill value and scale/offset are array properties.'
            : 'CRS only: the value transform is in side metadata.',
      ref: REF.encoding,
    });
    if (info.encoding === 'crs-only' && inputs.encodingImportance === 'high') {
      warnings.push({
        kind: 'encoding',
        text: 'Scale, offset and nodata are in side metadata. Readers honor side metadata unevenly.',
        ref: REF.encoding,
      });
    }

    if (sizeActive) {
      const mean = m.meanObjectBytes;
      let value: number | null = null;
      let explanation = 'No benchmark data for this format. Left out of the mean.';
      if (isNum(mean)) {
        const fit = tierFit(mean, tiers);
        value = fit.length / tiers.length;
        explanation = `Mean object size ${formatBytes(mean)} clears ${fit.length ? fit.join(', ') : 'no tier'} (${fit.length} of ${tiers.length}).`;
        if (fit.length === 0) {
          warnings.push({
            kind: 'tier',
            text: `Mean object size ${formatBytes(mean)} clears no tier of your policy. Use the grouping lever: ${info.groupingLever ?? 'see the format page'}.`,
            ref: REF.groupingLever,
          });
        }
      } else {
        warnings.push({ kind: 'no-data', text: 'Object size: no benchmark data.', ref: REF.quantitative });
      }
      terms.push({ kind: 'object-size', label: 'Object size (tier fit)', weight: OBJECT_SIZE_TERM.weight.value, value, explanation, ref: REF.groupingLever });
    }

    for (const c of benchActive) {
      const spec = BENCH_SPEC[c];
      const v = m[spec.key];
      const b = best[c];
      let value: number | null = null;
      let explanation = 'No benchmark data for this format. Left out of the mean.';
      if (isNum(v) && isNum(b) && v > 0) {
        value = spec.lowerIsBetter ? b / v : v / b;
        explanation = `${spec.unitText(v)}; best ${spec.unitText(b)}.`;
      } else {
        warnings.push({ kind: 'no-data', text: `${BENCHMARK_LABEL[c]}: no benchmark data.`, ref: REF.quantitative });
      }
      terms.push({ kind: `bench:${c}`, label: BENCHMARK_LABEL[c], weight: inputs.benchmarkWeights[c], value, explanation, ref: REF.quantitative });
    }

    const used = terms.filter((t) => t.value !== null && t.weight > 0);
    const sumW = used.reduce((s, t) => s + t.weight, 0);
    const finalTerms: ScoreTerm[] = terms.map((t) => ({
      ...t,
      points: t.value === null || sumW === 0 ? 0 : (100 * t.weight * t.value) / sumW,
    }));
    const score = finalTerms.reduce((s, t) => s + t.points, 0);
    return { format, score, order, terms: finalTerms, warnings };
  });

  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const candidates: RankedCandidate[] = scored.map(({ order: _order, ...rest }, i) => ({ ...rest, rank: i + 1 }));

  const [first, second] = candidates;
  const close = !!first && !!second && first.score - second.score < CLOSE_MARGIN.value;

  const notes: string[] = [];
  if (inputs.intentWeights.processing > 0) notes.push(PROCESSING_LAYOUT_ADVICE[inputs.processingMode]);
  if (inputs.intentWeights.fusion > 0 && inputs.encodingImportance !== 'high' && INTENT_NOTES.fusion) {
    notes.push(`${INTENT_NOTES.fusion} Consider importance "high" for interpretation encoding.`);
  }
  if (inputs.intentWeights.visualization > 0 && INTENT_NOTES.visualization) notes.push(INTENT_NOTES.visualization);

  return { candidates, close, notes, measureNotes };
}
