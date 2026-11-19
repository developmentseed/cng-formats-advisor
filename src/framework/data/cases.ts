/**
 * The presets: the six case studies of the guide, plus two presets that are
 * not in the guide. Text and numbers here are copied from case-studies.qmd.
 * No number here is computed or added: if the guide does not give it, it is not here.
 *
 * The score inputs of each preset (topology, intent weights, maturity limit,
 * encoding importance) are our encoding of the case text: see judgements.ts.
 */
import type { ControlAnswers, FormatId, GuideRef, TierPolicyKind } from '../types';
import { REF } from './guide';
import type { CasePresetId } from './judgements';

export type { CasePresetId } from './judgements';

/** A quantity exactly as the guide writes it. */
export interface Quantity {
  value: number;
  unit: 'MiB' | 'MB' | 'KiB' | 'KB' | 's' | 'objects' | '%' | 'x';
}

/** One measured arm of a case, as published in the guide. */
export interface PublishedArm {
  label: string;
  format: FormatId | 'source';
  /** The measured unit of the arm, for example "16-product area block". */
  unit: string;
  totalSize?: Quantity;
  objectCount?: number;
  meanObjectSize?: Quantity;
  /** Tier as the guide states it, with the CNES example policy. */
  tierAsPublished?: string;
  /** Other published values, as text with the numbers of the guide. */
  notes?: string[];
}

export interface CasePreset {
  id: CasePresetId;
  title: string;
  product: string;
  sourceFormat?: string;
  inGuide: boolean;
  ref?: GuideRef;
  answers: ControlAnswers;
  tierPolicy: TierPolicyKind;
  /** Published measurements. Empty when the guide gives none. */
  measurements: PublishedArm[];
  /** "Where it lands", as the guide writes it. */
  outcome: string;
  /** Cautions of the guide for this case. */
  cautions: string[];
  /** For the tests: the formats the guide puts first. */
  expectedTop: FormatId[];
}

const BLANK: ControlAnswers = {
  existingData: null,
  mandate: null,
  canReprocess: null,
  canRepackage: null,
  chunkedInternally: null,
  workableChunkSize: null,
  sourceFormat: null,
  existingUsers: null,
};

/** Existing data that the producer can reprocess: cases 1 to 5. */
const REPROCESS: ControlAnswers = { ...BLANK, existingData: true, canReprocess: true };

export const CASES: CasePreset[] = [
  {
    id: 'case1',
    title: 'Case 1: per-scene optical raster',
    product: 'Sentinel-2 L2A',
    sourceFormat: 'geoTiff in a .zip',
    inGuide: true,
    ref: REF.case1,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [
      {
        label: 'COG (ZSTD)',
        format: 'cog',
        unit: '16-product area block',
        totalSize: { value: 25478, unit: 'MiB' },
        objectCount: 448,
        meanObjectSize: { value: 57, unit: 'MiB' },
        tierAsPublished: 'warm',
        notes: ['Deflate instead of ZSTD: 25998 MiB, a change of 2 %.'],
      },
      {
        label: 'Zarr, flat (no overview pyramid)',
        format: 'geozarr',
        unit: '16-product area block',
        totalSize: { value: 19432, unit: 'MiB' },
        notes: ['About 24 % smaller than the COG: the pyramid that it does not carry.', 'Zoomed-out display: 0.98 s.'],
      },
      {
        label: 'GeoZarr, pyramid-complete',
        format: 'geozarr',
        unit: '16-product area block',
        totalSize: { value: 26026, unit: 'MiB' },
        objectCount: 2510,
        meanObjectSize: { value: 10.4, unit: 'MiB' },
        tierAsPublished: 'none',
        notes: [
          'About 2 % larger than the COG.',
          'Zoomed-out display: 0.198 s, about 5x faster than the flat store.',
          'Object count: 5x more than the flat store.',
        ],
      },
      {
        label: 'COG per scene, against the delivered .zip',
        format: 'cog',
        unit: 'one scene',
        totalSize: { value: 2625.7, unit: 'MiB' },
        notes: ['Source .zip: 2023.7 MiB. The COG is about 30 % larger, mostly because of the overviews.'],
      },
    ],
    outcome: 'COG per scene for distribution and visualization.',
    cautions: [
      'For temporal analysis GeoZarr is the right target, but the GeoZarr store measured here does not yet deliver it: it is a per-scene, two-dimensional store.',
      'A pyramid-less store measures smaller. Do not read that as the efficient option: it cannot serve a web map at speed.',
      'The related masking product is written as many small GeoTIFFs, far below the warm-tier floor. The producer must correct this at the source.',
    ],
    expectedTop: ['cog'],
  },
  {
    id: 'case2',
    title: 'Case 2: raster time-cube',
    product: 'Sentinel-1 RTC',
    sourceFormat: 'geoTiff in a .zip',
    inGuide: true,
    ref: REF.case2,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [
      {
        label: 'COG (ZSTD)',
        format: 'cog',
        unit: '20-product area block',
        totalSize: { value: 16449, unit: 'MiB' },
        objectCount: 40,
        meanObjectSize: { value: 411, unit: 'MiB' },
        tierAsPublished: 'cold',
        notes: ['Deflate instead of ZSTD: 16498 MiB, a change of 0.3 %.'],
      },
      {
        label: 'Zarr, flat (no overview pyramid)',
        format: 'geozarr',
        unit: '20-product area block',
        totalSize: { value: 12344, unit: 'MiB' },
        objectCount: 80,
        tierAsPublished: 'cold',
        notes: ['About 25 % smaller than the COG.', 'Zoomed-out display: 1.82 s.'],
      },
      {
        label: 'GeoZarr, pyramid-complete',
        format: 'geozarr',
        unit: '20-product area block',
        totalSize: { value: 15867, unit: 'MiB' },
        objectCount: 480,
        meanObjectSize: { value: 33, unit: 'MiB' },
        tierAsPublished: 'warm',
        notes: [
          'About 3.5 % smaller than the COG.',
          'Zoomed-out display: 0.171 s, about 10x faster than the flat store.',
          'Object count: 6x the flat store, and one tier level lower.',
        ],
      },
      {
        label: 'COG per scene, against the delivered .zip',
        format: 'cog',
        unit: 'one scene',
        totalSize: { value: 728, unit: 'MiB' },
        notes: ['Source .zip: 496 MiB. The COG is about 47 % larger.'],
      },
    ],
    outcome:
      'COG for the serving path, because it keeps both the tier and the display speed. GeoZarr for the analysis path, once the cube is built and measured.',
    cautions: [
      'The cube itself is not measured. Every GeoZarr figure describes a per-scene, two-dimensional store. Read the case as an argument for the cube, and the numbers as evidence about the per-scene shape only.',
    ],
    expectedTop: ['cog', 'geozarr'],
  },
  {
    id: 'case3',
    title: 'Case 3: point cloud',
    product: 'SWOT L2_HR Pixel Cloud',
    sourceFormat: 'netCDF',
    inGuide: true,
    ref: REF.case3,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [
      {
        label: 'COPC',
        format: 'copc',
        unit: 'six granules, content-complete',
        totalSize: { value: 3518.6, unit: 'MiB' },
        meanObjectSize: { value: 586, unit: 'MiB' },
        tierAsPublished: 'cold (both tiers)',
        notes: [
          'Size parity: about 3 % smaller in total, between 6 % smaller and 5 % larger for each granule.',
          'LASzip compression 2.72x to 3.45x, against 2.56x for the source.',
          'Octree: 9,925 to 17,635 nodes for each granule, depth 9 to 10.',
          'Octree-node spatial query: 3.3 s to 3.8 s, about 7 s at four-way concurrency.',
        ],
      },
      {
        label: 'Source netCDF',
        format: 'source',
        unit: 'six granules',
        totalSize: { value: 3621.4, unit: 'MiB' },
      },
    ],
    outcome:
      'COPC. The cloud-optimized value is partial access and level of detail at size parity, not a size saving. GeoParquet is the alternative where columnar analytics dominate.',
    cautions: [
      'An earlier measurement looked like a 97 % size saving. It had dropped most of the per-point variables. Size comparisons must be like for like on content.',
      'Geometry precision decides whether the octree is usable: reproject to a local UTM zone before the octree is built.',
    ],
    expectedTop: ['copc'],
  },
  {
    id: 'case4',
    title: 'Case 4: vector and tabular',
    product: 'SWOT L2_HR Lake Single Pass',
    sourceFormat: 'shapefile',
    inGuide: true,
    ref: REF.case4,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [
      {
        label: 'GeoParquet',
        format: 'geoparquet',
        unit: 'two passes',
        totalSize: { value: 35.6, unit: 'MiB' },
        notes: ['17.8 MiB per pass. About 14 % larger than the zipped shapefile.'],
      },
      {
        label: 'Zipped shapefile (source)',
        format: 'source',
        unit: 'two passes',
        totalSize: { value: 31.1, unit: 'MiB' },
        notes: ['15.6 MiB per pass.'],
      },
      {
        label: 'GeoParquet (ZSTD)',
        format: 'geoparquet',
        unit: 'three passes',
        totalSize: { value: 47.9, unit: 'MB' },
        notes: ['Bounding-box query: 0.522 s warm.', 'Snappy is 12 % larger than ZSTD.'],
      },
      {
        label: 'FlatGeobuf (R-tree index)',
        format: 'flatgeobuf',
        unit: 'three passes',
        totalSize: { value: 75.1, unit: 'MB' },
        notes: [
          'About 57 % larger than GeoParquet. The R-tree is only about 2 % of the object.',
          'Bounding-box query: 0.049 s warm, about 10x faster.',
          '20,689 geometries synthesized on the largest pass: 78 % of the rows carry a NULL geometry.',
        ],
      },
    ],
    outcome:
      'GeoParquet, with pass-level aggregation. It wins on size, on download, and on fusion. FlatGeobuf is the measured alternative where whole-row spatial subsetting dominates.',
    cautions: [
      'Each pass sits below the warm-tier floor. The lever is aggregation across passes, then row-group size.',
      'FlatGeobuf could not hold the product as delivered: its R-tree cannot index a NULL geometry.',
    ],
    expectedTop: ['geoparquet'],
  },
  {
    id: 'case5',
    title: 'Case 5: small N-D grid',
    product: 'SWOT L2_HR Raster',
    sourceFormat: 'geoTiff',
    inGuide: true,
    ref: REF.case5,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [
      {
        label: 'COG, one object for each variable',
        format: 'cog',
        unit: '12 granules, all 38 CF variables',
        totalSize: { value: 1107.8, unit: 'MiB' },
        objectCount: 456,
        meanObjectSize: { value: 2.55, unit: 'MiB' },
        tierAsPublished: 'none',
        notes: ['The smallest COG object is 19 KB.'],
      },
      {
        label: 'GeoZarr, one store for each variable',
        format: 'geozarr',
        unit: '12 granules, all 38 CF variables',
        totalSize: { value: 1214.8, unit: 'MiB' },
        objectCount: 2640,
        meanObjectSize: { value: 471, unit: 'KiB' },
        tierAsPublished: 'none',
        notes: ['The shard (2048 px) was wider than the grid (about 1457 px), so the sharding lever grouped nothing.'],
      },
    ],
    outcome:
      'COG for the small raster, plus aggregation across variables and granules. GeoZarr is the alternative to compare once the shard is sized against this grid.',
    cautions: [
      'The content-subset trap: a COG of the water-surface-elevation variable alone is 4.3 MiB, against about 67 MiB for the whole granule. The apparent 92 % saving is dropped content.',
      'Aggregation is sized, not measured. Treat every aggregation figure as arithmetic, never as a measurement.',
      'The intent mix is provisional and still to be confirmed with the product owner.',
    ],
    expectedTop: ['cog'],
  },
  {
    id: 'case6',
    title: 'Case 6: existing archive to a virtual store',
    product: 'A large immutable archive in a chunked array format, for example HDF5 or netCDF',
    sourceFormat: 'whatever was delivered',
    inGuide: true,
    ref: REF.case6,
    answers: {
      ...BLANK,
      existingData: true,
      canReprocess: false,
      canRepackage: false,
      chunkedInternally: true,
      workableChunkSize: true,
      sourceFormat: 'hdf5',
    },
    tierPolicy: 'none',
    measurements: [],
    outcome: 'Virtual Zarr. Range access with no reprocessing.',
    cautions: [
      'This case has no benchmark.',
      "Chunk sizes are whatever the source chose, you cannot add overviews, and you inherit the source's codec.",
      'If the source cannot even be virtualized, name what is missing rather than declaring the case impossible.',
    ],
    expectedTop: [],
  },
  {
    id: 's2-l2b-snow',
    title: 'Sentinel-2 L2B snow',
    product: 'Sentinel-2 L2B snow cover',
    inGuide: false,
    answers: REPROCESS,
    tierPolicy: 'cnes',
    measurements: [],
    outcome: 'Not in the guide. No published outcome.',
    cautions: ['This preset is not a case study of the guide. Its inputs are assumptions. Review them for your product.'],
    expectedTop: [],
  },
  {
    id: 'new-product',
    title: 'New product, no data yet',
    product: 'A new product',
    inGuide: false,
    answers: { ...BLANK, existingData: false, mandate: false },
    tierPolicy: 'none',
    measurements: [],
    outcome: 'Not in the guide. Answer the questions for your product.',
    cautions: [],
    expectedTop: [],
  },
];

export function getCase(id: string): CasePreset | undefined {
  return CASES.find((c) => c.id === id);
}

export const BLANK_ANSWERS = BLANK;

/** Convert a published quantity to bytes, or null when it is not a size. */
export function quantityToBytes(q: Quantity): number | null {
  switch (q.unit) {
    case 'MiB':
      return q.value * 1024 * 1024;
    case 'KiB':
      return q.value * 1024;
    case 'MB':
      return q.value * 1e6;
    case 'KB':
      return q.value * 1e3;
    default:
      return null;
  }
}
