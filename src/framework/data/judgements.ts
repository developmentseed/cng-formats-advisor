/**
 * JUDGEMENTS: values that are our encoding of the guide text.
 *
 * The guide gives rules, tables and levels in words. The score needs numbers.
 * Every number and every choice in this file is a translation of guide text
 * into a value, so a person must review it. Each value has a citation: the
 * guide text that supports it (`why`) and a link to the guide section (`ref`).
 *
 * Facts that the guide states directly (maturity levels, grouping levers,
 * format families, published measurements) are NOT in this file. They are in
 * formats.ts, families.ts, tiers.ts and cases.ts.
 *
 * Review status: NOT REVIEWED. Review before publication.
 */
import type {
  Cited,
  FormatId,
  Importance,
  Intent,
  MaturityLevel,
  ProcessingMode,
  Topology,
} from '../types';
import { REF } from './guide';

export type Fit = 0 | 1 | 2 | 3;

/** Meaning of each intent-fit value. */
export const FIT_SCALE: Record<Fit, string> = {
  3: 'The guide names this format as the winner for this intent.',
  2: 'Good fit: the guide or a case study supports the format for this intent.',
  1: 'Possible, not favored: the guide gives no role, or names a weaker point.',
  0: 'The guide text points away from this format for this intent.',
};

function c<T>(value: T, why: string, ref: Cited<T>['ref']): Cited<T> {
  return { value, why, ref };
}

/* ------------------------------------------------------------------------ */
/* 1. Intent-fit matrix: format x intent, 0 to 3.                            */
/* ------------------------------------------------------------------------ */

export const INTENT_FIT: Record<FormatId, Record<Intent, Cited<Fit>>> = {
  cog: {
    archive: c(2, 'Case 5 lands on COG for a "distribution and download" mix. The guide names no archival role for COG (the archival formats it names are HDF5, netCDF, GRIB).', REF.case5),
    processing: c(2, 'Topology table: "COG per time step if slices are read alone". Case 2: across thousands of per-timestamp COGs a time-series request "becomes a large fan-out".', REF.case2),
    visualization: c(3, 'Topology table: "COG for distribution and visualization". Case 1 lands on COG for visualization.', REF.topology),
    distribution: c(3, 'Topology table: "COG for distribution and visualization". Case 2: "COG for the serving path".', REF.topology),
    fusion: c(2, 'Fusion needs that "subsets from each must line up": a gridded raster does this. Case 5 lands on COG with fusion in the mix. Fusion "usually rewards a tabular or columnar target", so not 3.', REF.intent),
  },
  geozarr: {
    archive: c(2, 'Case 5: "GeoZarr is the alternative to compare" for a "distribution and download" mix.', REF.case5),
    processing: c(3, 'Topology table: "GeoZarr for analysis across the cube". Case 2: "GeoZarr for the analysis path".', REF.topology),
    visualization: c(2, 'Cases 1 and 2: with a pyramid, zoomed-out display is 5x to 10x faster than without. Maturity section: "expect visualization tooling in particular to improve".', REF.maturityWarning),
    distribution: c(2, 'Case 1: distribution served per scene "favors COG". Case 2: COG, not GeoZarr, for the serving path.', REF.case1),
    fusion: c(2, 'Fusion needs that "subsets from each must line up": a gridded cube does this. Fusion "usually rewards a tabular or columnar target", so not 3. The encoding advantage is in the encoding term, not here.', REF.intent),
  },
  pmtiles: {
    archive: c(1, 'The guide names PMTiles only for "pre-rendered tile delivery" and "tiled web delivery". No archive role.', REF.topology),
    processing: c(0, 'Topology table: "pre-rendered tile delivery". Pre-rendered tiles are made for display, not for analysis.', REF.topology),
    visualization: c(3, 'Topology table: "PMTiles for pre-rendered tile delivery" and "PMTiles for tiled web delivery".', REF.topology),
    distribution: c(2, 'Topology table: tile "delivery" is a form of distribution, but for tiles only.', REF.topology),
    fusion: c(0, 'Pre-rendered tiles do not give back "the same physical value" that fusion needs.', REF.intent),
  },
  'co-hdf5': {
    archive: c(3, 'Topology table: "cloud-optimized HDF/netCDF where an archival format is mandated or existing tooling must keep working".', REF.topology),
    processing: c(2, 'Topology table: "where existing tooling must keep working". The guide gives specific guidance on chunk sizing for analysis access.', REF.topology),
    visualization: c(1, 'Visualization "has its own layout needs, mainly overviews or a level of detail". The guide names no overview mechanism for HDF/netCDF.', REF.intent),
    distribution: c(1, 'The guide gives no distribution role. Its role is the mandated archive or existing tooling.', REF.topology),
    fusion: c(1, 'The guide gives no fusion role. Fusion "usually rewards a tabular or columnar target".', REF.intent),
  },
  copc: {
    archive: c(2, 'Case 3: size parity with the source; "LASzip does out-compress the source".', REF.case3),
    processing: c(2, 'Topology table: "COPC for spatial subsetting". "GeoParquet if columnar analytics dominate", so not 3.', REF.topology),
    visualization: c(3, 'Topology table: "COPC for spatial subsetting and level of detail". Case 3: level of detail is "the point-cloud analogue of COG overviews".', REF.topology),
    distribution: c(3, 'Case 3 lands on COPC for a "distribution, visualization, and data fusion" mix: "partial access and level of detail at size parity".', REF.case3),
    fusion: c(2, 'Case 3: fusion needs a reader to "recover the same physical value per point and subset the same area cheaply". COPC gives the spatial index. Not columnar, so not 3.', REF.case3),
  },
  geoparquet: {
    archive: c(3, 'Case 4: "Download favors GeoParquet, not FlatGeobuf". GeoParquet compresses per column by default.', REF.case4),
    processing: c(3, 'Topology table: "GeoParquet for joins and analytics" and "GeoParquet if columnar analytics dominate".', REF.topology),
    visualization: c(1, 'The guide gives GeoParquet no visualization role. Case 4: streaming, a visualization property, is the FlatGeobuf strength.', REF.case4),
    distribution: c(2, 'Case 4 lands on GeoParquet with distribution in the mix, but it "wins on size, on download, and on fusion", not on distribution.', REF.case4),
    fusion: c(3, 'Intent section: fusion "usually rewards a tabular or columnar target where joins are cheap". Case 4: "GeoParquet wins on download and fusion".', REF.intent),
  },
  flatgeobuf: {
    archive: c(1, 'Case 4: FlatGeobuf "has no internal compression" and "cannot simply be gzipped". 57 % larger than GeoParquet in the measured case.', REF.case4),
    processing: c(2, 'Case 4: "FlatGeobuf wins on whole-row spatial subsetting", about 10x faster for a bounding-box query.', REF.case4),
    visualization: c(3, 'Case 4: "Streaming is a visualization property": features "render progressively as they arrive".', REF.case4),
    distribution: c(2, 'Topology table: "FlatGeobuf for streaming download".', REF.topology),
    fusion: c(1, 'Case 4: "GeoParquet wins on download and fusion". A NULL geometry cannot be indexed, which can disqualify the product as delivered.', REF.case4),
  },
};

/* ------------------------------------------------------------------------ */
/* 2. Score terms: weights and values.                                       */
/* ------------------------------------------------------------------------ */

/** Each intent weight (0 to 3) is the weight of that intent term. Fit / 3 is its value. */
export const INTENT_TERM_RULE = c(
  'value = fit / 3; weight = the intent weight that you set',
  'Most real datasets serve several intents at once. The case studies "state an intent mix for each product, which is what decides the ranking inside a candidate set".',
  REF.intent,
);

export const MATURITY_TERM = {
  weight: c(2, 'Maturity "may influence the final decision". It is one of four refinements. Weight 2 of 3: it matters, but it is "a warning, not a veto".', REF.maturity),
  /** Value is 1 at or above the lowest level you accept, minus this value per level below it, not below 0. */
  penaltyPerLevel: c(0.5, '"A low level does not mean choose something else. It means plan for change." The penalty lowers the score but never removes the format.', REF.maturityWarning),
  notRated: c(
    'mean value of the rated candidates in the family',
    'The guide gives no level for PMTiles or Cloud-Optimized HDF/NetCDF. The term takes the mean value of the rated candidates in the same family, so it does not move the format up or down against them. The card shows "not rated in the guide".',
    REF.maturity,
  ),
};

export const ENCODING_TERM = {
  /** Weight per importance. */
  weight: {
    low: c(1, 'Importance "low": the product has no scaled integers and no fill value that changes a result.', REF.encoding),
    medium: c(2, 'Importance "medium": default.', REF.encoding),
    high: c(3, '"If your product stores scaled integers, or if an undeclared fill value would change a computed result, weigh this aspect heavily."', REF.encoding),
  } satisfies Record<Importance, Cited<number>>,
  value: {
    'first-class': c(1, '"Zarr v3 makes the information first-class ... Every reader recovers the same value."', REF.encoding),
    'crs-only': c(0.5, '"COG, GeoParquet, and COPC standardize the CRS but leave the value transform to side metadata." Half: the CRS is standard, the value transform is not.', REF.encoding),
  },
  notRated: c(
    'mean value of the rated candidates in the family',
    'The guide rates Zarr v3, COG, GeoParquet and COPC only. For FlatGeobuf, PMTiles and Cloud-Optimized HDF/NetCDF the term takes the mean value of the rated candidates in the same family.',
    REF.encoding,
  ),
};

export const OBJECT_SIZE_TERM = {
  weight: c(2, 'One of the four refinements: "the object-size and grouping lever". Applies only with benchmark data and a tier policy.', REF.groupingLever),
  /** Value = number of tiers that the mean object size clears / number of tiers. */
  rule: c(
    'value = tiers cleared / tiers in the policy',
    'Tier fit from the mean object size, the same rule as cng-formats-benchmark: "Object stores degrade when they must index very many tiny objects, so most reward a larger average object."',
    REF.groupingLever,
  ),
};

export const BENCHMARK_TERMS = {
  rule: c(
    'value = best / this (lower is better) or this / best (higher is better); active only with data for two or more candidates',
    '"When two or three candidates remain and the choice is close, a transparent score can make the trade-off explicit." Each measured value is relative to the best candidate, so a criterion needs data for two or more candidates.',
    REF.quantitative,
  ),
  defaultWeight: c(0, 'Off by default: you turn a criterion on when you have measurements.', REF.quantitative),
};

/** Two first scores closer than this margin (points out of 100) are "close". */
export const CLOSE_MARGIN = c(
  10,
  '"It does not replace a benchmark. When two candidates are close, measure them."',
  REF.whatItIs,
);

/* ------------------------------------------------------------------------ */
/* 3. Default inputs and preset inputs.                                      */
/* ------------------------------------------------------------------------ */

export interface PresetInputs {
  topology: Cited<Topology | null>;
  intentWeights: Cited<Record<Intent, number>>;
  processingMode: Cited<ProcessingMode>;
  minMaturity: Cited<MaturityLevel>;
  encodingImportance: Cited<Importance>;
}

const W = (archive: number, processing: number, visualization: number, distribution: number, fusion: number): Record<Intent, number> => ({
  archive,
  processing,
  visualization,
  distribution,
  fusion,
});

const MIN_MATURITY_ASSUMPTION =
  'The guide gives no maturity level per case. L3 ("stable: released spec, multiple implementations") is our assumption for a production product. "A one-off internal product and a mission archive ... can reasonably land on different levels."';

export const DEFAULT_INPUTS: PresetInputs = {
  topology: c(null, 'No default: you answer "what shape are the data?".', REF.topology),
  intentWeights: c(W(1, 1, 1, 1, 1), 'All intents equal until you set the mix: "Most real datasets serve several intents at once."', REF.intent),
  processingMode: c('on-the-fly', 'Default sub-choice. Text only, no effect on the score.', REF.intent),
  minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
  encodingImportance: c('medium', 'Default importance.', REF.encoding),
};

export type CasePresetId = 'case1' | 'case2' | 'case3' | 'case4' | 'case5' | 'case6' | 's2-l2b-snow' | 'new-product';

export const PRESET_INPUTS: Record<CasePresetId, PresetInputs> = {
  case1: {
    topology: c('raster-2d', '"2D raster per scene".', REF.case1),
    intentWeights: c(W(0, 0, 3, 3, 0), '"Distribution and visualization, both served per scene." Equal weights: the guide does not rank the two.', REF.case1),
    processingMode: c('on-the-fly', 'No processing intent. Default.', REF.case1),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('high', '"Interpretation encoding is a real differentiator here. The source reflectance is stored as scaled integers, and the nodata fill is left undeclared."', REF.case1),
  },
  case2: {
    topology: c('nd-cube', 'The guide says "2D raster over time" and "a year of RTC over a region is naturally a time × y × x × pol cube". We use the N-D cube branch. Both branches open COG and GeoZarr.', REF.case2),
    intentWeights: c(W(0, 3, 3, 2, 0), '"Advanced analysis and visualization lead, with distribution close behind but weighted a little lower." Analysis is processing.', REF.case2),
    processingMode: c('batched', '"Zarr sharding, sized to the object store\'s preference for large objects."', REF.case2),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('medium', 'The case does not discuss encoding. Default.', REF.case2),
  },
  case3: {
    topology: c('point-cloud', '"Point cloud, which opens {COPC, GeoParquet}".', REF.case3),
    intentWeights: c(W(0, 0, 3, 3, 3), '"Distribution, visualization, and data fusion." Equal weights: the guide does not rank them, but says "the fusion intent matters most here".', REF.case3),
    processingMode: c('on-the-fly', 'No processing intent. Default.', REF.case3),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('high', '"A reader has to recover the same physical value per point." Fusion "weights interpretation encoding ... far higher".', REF.case3),
  },
  case4: {
    topology: c('vector', '"Vector and tabular, which opens {GeoParquet, FlatGeobuf}".', REF.case4),
    intentWeights: c(W(3, 0, 0, 3, 3), '"Distribution, download, and data fusion. Visualization is absent from this mix." Download is the archive-and-download intent.', REF.case4),
    processingMode: c('batched', 'No processing intent. Aggregation across passes, then row groups.', REF.case4),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('high', 'Fusion is in the mix: fusion "weights interpretation encoding ... far higher than single-product analysis does".', REF.intent),
  },
  case5: {
    topology: c('nd-cube', '"N-D grid, which opens {GeoZarr, COG}".', REF.case5),
    intentWeights: c(W(3, 0, 1, 3, 2), '"Distribution and download, with data fusion against the other SWOT products, and some visualization." The guide says this mix "is provisional".', REF.case5),
    processingMode: c('batched', 'No processing intent. Aggregation above the product.', REF.case5),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('high', 'Fusion is in the mix: fusion "weights interpretation encoding ... far higher than single-product analysis does".', REF.intent),
  },
  case6: {
    topology: c(null, 'Case 6 "does not reach the topology question at all".', REF.case6),
    intentWeights: c(W(1, 1, 1, 1, 1), 'Not used: no Stage 2.', REF.case6),
    processingMode: c('on-the-fly', 'Not used: no Stage 2.', REF.case6),
    minMaturity: c(3, 'Not used: no Stage 2.', REF.case6),
    encodingImportance: c('medium', 'Not used: no Stage 2.', REF.case6),
  },
  's2-l2b-snow': {
    topology: c('raster-2d', 'NOT IN THE GUIDE. Assumption: a per-tile 2D raster product.', REF.topology),
    intentWeights: c(W(1, 2, 2, 3, 0), 'NOT IN THE GUIDE. Assumption: distribution first, then visualization and time-series processing of snow cover, some download.', REF.intent),
    processingMode: c('batched', 'NOT IN THE GUIDE. Assumption: snow-cover time series over a season are batch jobs.', REF.intent),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('medium', 'NOT IN THE GUIDE. Assumption: default importance.', REF.encoding),
  },
  'new-product': {
    topology: c(null, 'NOT IN THE GUIDE. You answer "what shape are the data?".', REF.topology),
    intentWeights: c(W(1, 1, 1, 1, 1), 'NOT IN THE GUIDE. All intents equal until you set the mix.', REF.intent),
    processingMode: c('on-the-fly', 'Default.', REF.intent),
    minMaturity: c(3, MIN_MATURITY_ASSUMPTION, REF.maturity),
    encodingImportance: c('medium', 'Default.', REF.encoding),
  },
};
