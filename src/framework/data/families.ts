/**
 * Topology -> format family, transcribed from the topology table of the guide.
 * The "Zarr" and "[Geo]Zarr" entries of the table both map to the one
 * "GeoZarr (Zarr v3)" candidate (cases 1 and 2 open {COG, GeoZarr}).
 */
import type { FormatId, GuideRef, Topology } from '../types';
import { REF } from './guide';

export interface Family {
  topology: Topology;
  label: string;
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
