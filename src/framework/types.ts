/**
 * Types for the format selection decision framework.
 * Pure TypeScript: no React, no DOM.
 */

/** The candidate formats that Stage 2 can rank. */
export type FormatId =
  | 'cog'
  | 'geozarr'
  | 'pmtiles'
  | 'co-hdf5'
  | 'copc'
  | 'geoparquet'
  | 'flatgeobuf';

/** Virtual Zarr is a Stage 1 outcome, not a Stage 2 candidate. */
export type AnyFormatId = FormatId | 'virtual-zarr';

export type Topology = 'raster-2d' | 'nd-cube' | 'point-cloud' | 'vector';

export type Intent = 'archive' | 'processing' | 'visualization' | 'distribution' | 'fusion';

export type ProcessingMode = 'on-the-fly' | 'batched';

export type MaturityLevel = 1 | 2 | 3 | 4 | 5;

export type EncodingClass = 'first-class' | 'crs-only' | 'not-rated';

export type Importance = 'low' | 'medium' | 'high';

/** A link to a section of the guide, with the text of the link. */
export interface GuideRef {
  /** Absolute URL with anchor. */
  url: string;
  /** Short name of the section, for the link text. */
  label: string;
}

/** A value that is our encoding of guide text, with the text that supports it. */
export interface Cited<T> {
  value: T;
  /** Why this value: a short paraphrase or quote of the guide. */
  why: string;
  ref: GuideRef;
}

/* ---------- Stage 1 ---------- */

/** Tri-state answer. `null` means "not answered yet". */
export type Answer = boolean | null;

export type ParserFormat = 'netcdf4' | 'hdf5' | 'grib2' | 'tiff' | 'fits' | 'other';

export interface ControlAnswers {
  existingData: Answer;
  /** Only when there are no existing data. */
  mandate: Answer;
  /** Only when there are existing data. */
  canReprocess: Answer;
  canRepackage: Answer;
  /** The three virtualization tests. */
  chunkedInternally: Answer;
  workableChunkSize: Answer;
  sourceFormat: ParserFormat | null;
  /** Advisory only: no effect on the outcome or the score. */
  existingUsers: Answer;
}

export type ControlOutcomeKind =
  | 'incomplete'
  | 'free'
  | 'mandate'
  | 'repackage'
  | 'virtual'
  | 'not-yet-possible';

export type VirtualTest = 'chunked' | 'chunk-size' | 'parser';

export interface ControlOutcome {
  kind: ControlOutcomeKind;
  /** True when Stage 2 (topology and score) applies. */
  continuesToStage2: boolean;
  /** The question that needs an answer, for `incomplete`. */
  nextQuestion?: keyof ControlAnswers;
  /** The failed virtualization tests, for `not-yet-possible`. */
  missing: VirtualTest[];
  /** Notes to show with the outcome. */
  notes: string[];
  ref: GuideRef;
}

/* ---------- Stage 2 ---------- */

export type TierPolicyKind = 'none' | 'cnes' | 'custom';

export interface Tier {
  name: string;
  minObjectBytes: number;
}

export interface TierPolicy {
  kind: TierPolicyKind;
  /** Ordered from the smallest threshold to the largest. */
  tiers: Tier[];
}

export type BenchmarkCriterion = 'storage' | 'read' | 'display' | 'write';

export interface ScoreInputs {
  topology: Topology | null;
  /** Answer to the follow-up question of the family (an option id), or null for "not sure". */
  familyFocus: string | null;
  intentWeights: Record<Intent, number>;
  processingMode: ProcessingMode;
  minMaturity: MaturityLevel;
  encodingImportance: Importance;
  tierPolicy: TierPolicy;
  benchmarkWeights: Record<BenchmarkCriterion, number>;
}

/** Benchmark-derived values for one candidate (one selected arm). */
export interface CandidateMeasurements {
  meanObjectBytes?: number;
  totalBytes?: number;
  readLatencyP50?: number;
  displayLatency?: number;
  /** Number of display scenarios behind displayLatency, when they are shared by the compared formats. */
  displayScenarios?: number;
  writeThroughput?: number;
}

export type TermKind =
  | `intent:${Intent}`
  | 'family-fit'
  | 'maturity'
  | 'encoding'
  | `bench:${BenchmarkCriterion}`;

export interface ScoreTerm {
  kind: TermKind;
  label: string;
  weight: number;
  /** 0 to 1, or null when the term has no data for this candidate. */
  value: number | null;
  /** weight * value / sum of weights, times 100. 0 when value is null. */
  points: number;
  explanation: string;
  /** The guide text behind the value, shown under the explanation with the name of its source. */
  detail?: string;
  ref?: GuideRef;
}

export interface Warning {
  /** Information, not a warning: shown with an "i" icon. */
  info?: boolean;
  kind: 'maturity' | 'maturity-not-rated' | 'encoding' | 'tier' | 'no-data' | 'low-fit';
  text: string;
  ref?: GuideRef;
}

export interface RankedCandidate {
  format: FormatId;
  score: number;
  rank: number;
  terms: ScoreTerm[];
  warnings: Warning[];
}

export interface Ranking {
  candidates: RankedCandidate[];
  /** True when the two first scores are within the "close" margin. */
  close: boolean;
  notes: string[];
  /** Why a measured criterion with a weight is not in the score. */
  measureNotes: string[];
}
