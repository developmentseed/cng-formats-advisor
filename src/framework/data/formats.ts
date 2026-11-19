/**
 * Format facts, transcribed from the guide. Each value here is in the guide
 * text. Values that are our encoding of the guide text are in judgements.ts.
 */
import type { AnyFormatId, EncodingClass, GuideRef, MaturityLevel } from '../types';
import { GUIDE_BASE, REF } from './guide';

export interface FormatInfo {
  id: AnyFormatId;
  name: string;
  /** Format page in the guide. */
  page: GuideRef;
  /**
   * Level from the maturity table of the guide.
   * `null` when the guide gives no level: the UI shows "not rated in the guide".
   */
  maturity: MaturityLevel | null;
  /** "Specification" and "Tooling" columns of the maturity table, when present. */
  specification?: string;
  tooling?: string;
  /** Extra maturity text from the guide. */
  maturityNote?: string;
  /** Grouping lever from the guide table, or from guide text that names it. */
  groupingLever: string | null;
  groupingLeverRef: GuideRef;
  /**
   * Interpretation encoding class as the guide states it.
   * `not-rated` when the guide does not rate the format.
   */
  encoding: EncodingClass;
  /** Benchmark `format_id` values that map to this format. */
  benchmarkIds: string[];
}

function page(path: string, label: string): GuideRef {
  return { url: `${GUIDE_BASE}/${path}`, label };
}

export const FORMATS: Record<AnyFormatId, FormatInfo> = {
  cog: {
    id: 'cog',
    name: 'COG',
    page: page('cloud-optimized-geotiffs/intro.html', 'Cloud-Optimized GeoTIFFs'),
    maturity: 5,
    specification: 'De-facto standard, on a GeoTIFF base',
    tooling: 'GDAL, rio-tiler, TiTiler, every GIS',
    maturityNote:
      'COG is the reference case and the format the others are measured against.',
    groupingLever: 'internal tiling and overviews',
    groupingLeverRef: REF.groupingLever,
    encoding: 'crs-only',
    benchmarkIds: ['cog'],
  },
  geozarr: {
    id: 'geozarr',
    name: 'GeoZarr (Zarr v3)',
    page: page('zarr/intro.html', 'Zarr'),
    maturity: 2,
    specification: 'Draft, in an OGC Standards Working Group',
    tooling: 'Emerging, mostly xarray-based stacks',
    maturityNote:
      'The L2 belongs to the GeoZarr convention layer, not to Zarr. ' +
      'Judged on its own, the Zarr v3 core behaves like an L4 (Zarr v2 and v3 stable; GDAL, zarr-python, zarrs).',
    groupingLever: 'chunks and shards',
    groupingLeverRef: REF.groupingLever,
    encoding: 'first-class',
    benchmarkIds: ['geozarr', 'zarr'],
  },
  pmtiles: {
    id: 'pmtiles',
    name: 'PMTiles',
    page: page('pmtiles/intro.html', 'PMTiles'),
    maturity: null,
    groupingLever: null,
    groupingLeverRef: REF.groupingLever,
    encoding: 'not-rated',
    benchmarkIds: ['pmtiles'],
  },
  'co-hdf5': {
    id: 'co-hdf5',
    name: 'Cloud-Optimized HDF/NetCDF',
    page: page('cloud-optimized-netcdf4-hdf5/index.html', 'Cloud-Optimized HDF/NetCDF'),
    maturity: null,
    groupingLever: 'consolidated metadata and chunk sizing',
    groupingLeverRef: REF.control,
    encoding: 'not-rated',
    benchmarkIds: ['hdf5', 'netcdf', 'netcdf4', 'co-hdf5'],
  },
  copc: {
    id: 'copc',
    name: 'COPC',
    page: page('copc/index.html', 'COPC'),
    maturity: 4,
    specification: 'v1.0, stable, on a LAZ base',
    tooling: 'PDAL, untwine, QGIS, copc.js',
    maturityNote: 'The risk is integration effort, not the specification.',
    groupingLever: 'octree nodes',
    groupingLeverRef: REF.groupingLever,
    encoding: 'crs-only',
    benchmarkIds: ['copc'],
  },
  geoparquet: {
    id: 'geoparquet',
    name: 'GeoParquet',
    page: page('geoparquet/index.html', 'GeoParquet'),
    maturity: 4,
    specification: 'v1.x, stable, on an Apache Parquet base',
    tooling: 'GDAL, GeoPandas, DuckDB, Arrow',
    maturityNote: 'The risk is integration effort, not the specification.',
    groupingLever: 'row groups, plus partitioning',
    groupingLeverRef: REF.groupingLever,
    encoding: 'crs-only',
    benchmarkIds: ['geoparquet'],
  },
  flatgeobuf: {
    id: 'flatgeobuf',
    name: 'FlatGeobuf',
    page: page('flatgeobuf/intro.html', 'FlatGeobuf'),
    maturity: 3,
    specification: 'Stable, on a flatbuffers base',
    tooling: 'GDAL and OGR, QGIS, flatgeobuf.js',
    groupingLever: null,
    groupingLeverRef: REF.groupingLever,
    encoding: 'not-rated',
    benchmarkIds: ['flatgeobuf'],
  },
  'virtual-zarr': {
    id: 'virtual-zarr',
    name: 'Virtual Zarr',
    page: page('zarr/virtual-zarr.html', 'Virtual Zarr'),
    maturity: null,
    groupingLever: "None available. You inherit the source's chunking exactly.",
    groupingLeverRef: REF.case6,
    encoding: 'not-rated',
    benchmarkIds: [],
  },
};

/** Map a benchmark `format_id` to a Stage 2 candidate. */
export function formatFromBenchmarkId(id: string): AnyFormatId | null {
  const key = id.trim().toLowerCase();
  for (const info of Object.values(FORMATS)) {
    if (info.benchmarkIds.includes(key)) return info.id;
  }
  return null;
}

export const MATURITY_SCALE: Record<MaturityLevel, string> = {
  5: 'De-facto standard: universal tooling, no specification risk',
  4: 'Established: released spec, broad independent tooling, in production use',
  3: 'Stable: released spec, multiple implementations, growing tooling',
  2: 'Emerging: spec stabilizing, reference implementations, early adopters',
  1: 'Experimental: draft or in-flux spec, few implementations',
};

export const ENCODING_TEXT: Record<EncodingClass, string> = {
  'first-class':
    'Zarr v3 makes the information first-class: scale_offset codec, declared fill value, conventions for projection, CRS and multiscales. Every reader recovers the same value.',
  'crs-only':
    'Standardizes the CRS but leaves the value transform to side metadata. Readers honor side metadata unevenly.',
  'not-rated': 'The guide does not rate this format for interpretation encoding.',
};
