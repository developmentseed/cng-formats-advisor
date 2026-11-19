/**
 * Topology -> format family, transcribed from the topology table of the guide.
 * The "Zarr" and "[Geo]Zarr" entries of the table both map to the one
 * "GeoZarr (Zarr v3)" candidate (cases 1 and 2 open {COG, GeoZarr}).
 */
import type { FormatId, GuideRef, Topology } from '../types';
import { REF } from './guide';

/** One answer to the follow-up question of a family: it favours one member. */
export interface FocusOption {
  id: string;
  label: string;
  favours: FormatId;
  /** The words of the "Where each member wins" column. */
  guideText: string;
}

export interface Family {
  topology: Topology;
  label: string;
  /**
   * Follow-up question, from the "Where each member wins" column: which
   * access pattern or use dominates. The answer favours one member.
   */
  focusQuestion: string;
  focus: FocusOption[];
  /** Example from the guide. */
  example?: string;
  members: FormatId[];
  /** "Where each member wins" column, per member. */
  wins: Partial<Record<FormatId, string>>;
  ref: GuideRef;
}

export const FAMILIES: Record<Topology, Family> = {
  'raster-2d': {
    topology: 'raster-2d',
    label: '2D raster, per scene or per tile',
    members: ['cog', 'geozarr', 'pmtiles'],
    focusQuestion: 'Which use fits the product best?',
    focus: [
      { id: 'scene', label: 'Distribution and visualization, scene by scene', favours: 'cog', guideText: 'COG for distribution and visualization' },
      { id: 'cube', label: 'The product is really a cube: many dates or bands read together', favours: 'geozarr', guideText: 'Zarr if the product is really a cube' },
      { id: 'tiles', label: 'Pre-rendered tile delivery to web maps', favours: 'pmtiles', guideText: 'PMTiles for pre-rendered tile delivery' },
    ],
    wins: {
      cog: 'COG for distribution and visualization',
      geozarr: 'Zarr if the product is really a cube',
      pmtiles: 'PMTiles for pre-rendered tile delivery',
    },
    ref: REF.topology,
  },
  'nd-cube': {
    topology: 'nd-cube',
    label: 'N-D cubes',
    example: 'time × y × x × band',
    members: ['geozarr', 'cog', 'co-hdf5'],
    focusQuestion: 'How do readers use the cube?',
    focus: [
      { id: 'across', label: 'Analysis across the cube: time series, an area over many dates', favours: 'geozarr', guideText: 'GeoZarr for analysis across the cube' },
      { id: 'slices', label: 'Slices are read alone: one time step at a time', favours: 'cog', guideText: 'COG per time step if slices are read alone' },
      { id: 'archival', label: 'An archival format is mandated, or existing tooling must keep working', favours: 'co-hdf5', guideText: 'cloud-optimized HDF/netCDF where an archival format is mandated or existing tooling must keep working' },
    ],
    wins: {
      geozarr: 'GeoZarr for analysis across the cube',
      cog: 'COG per time step if slices are read alone',
      'co-hdf5':
        'cloud-optimized HDF/netCDF where an archival format is mandated or existing tooling must keep working',
    },
    ref: REF.topology,
  },
  'point-cloud': {
    topology: 'point-cloud',
    label: 'Point cloud',
    members: ['copc', 'geoparquet'],
    focusQuestion: 'What do readers mostly do with the points?',
    focus: [
      { id: 'subset', label: 'Spatial subsets and level of detail', favours: 'copc', guideText: 'COPC for spatial subsetting and level of detail' },
      { id: 'columnar', label: 'Columnar analytics over the attributes', favours: 'geoparquet', guideText: 'GeoParquet if columnar analytics dominate' },
    ],
    wins: {
      copc: 'COPC for spatial subsetting and level of detail',
      geoparquet: 'GeoParquet if columnar analytics dominate',
    },
    ref: REF.topology,
  },
  vector: {
    topology: 'vector',
    label: 'Vector or tabular',
    members: ['geoparquet', 'flatgeobuf', 'pmtiles'],
    focusQuestion: 'What is the main use of the features?',
    focus: [
      { id: 'joins', label: 'Joins and analytics', favours: 'geoparquet', guideText: 'GeoParquet for joins and analytics' },
      { id: 'streaming', label: 'Streaming download: features arrive and render progressively', favours: 'flatgeobuf', guideText: 'FlatGeobuf for streaming download' },
      { id: 'tiles', label: 'Tiled web delivery', favours: 'pmtiles', guideText: 'PMTiles for tiled web delivery' },
    ],
    wins: {
      geoparquet: 'GeoParquet for joins and analytics',
      flatgeobuf: 'FlatGeobuf for streaming download',
      pmtiles: 'PMTiles for tiled web delivery',
    },
    ref: REF.topology,
  },
};

export const TOPOLOGY_NOTE =
  'The question is about topology, not about the format the data arrives in. A netCDF granule that holds a point cloud belongs on the point-cloud branch.';

/** The focus option of a family, or undefined when the id does not belong to it. */
export function focusOption(topology: Topology | null, id: string | null): FocusOption | undefined {
  if (!topology || !id) return undefined;
  return FAMILIES[topology].focus.find((o) => o.id === id);
}
