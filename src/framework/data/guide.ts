import type { GuideRef } from '../types';

/** Base URL of the published guide. */
export const GUIDE_BASE = 'https://guide.cloudnativegeo.org';
export const FRAMEWORK_URL = `${GUIDE_BASE}/decision-framework/`;
export const CASES_URL = `${GUIDE_BASE}/decision-framework/case-studies.html`;
export const BENCHMARK_REPO_URL = 'https://github.com/developmentseed/cng-formats-benchmark';
export const BENCHMARK_DOCS_URL = 'https://developmentseed.github.io/cng-formats-benchmark/';

function fw(anchor: string, label: string): GuideRef {
  return { url: `${FRAMEWORK_URL}#${anchor}`, label };
}

function cs(anchor: string, label: string): GuideRef {
  return { url: `${CASES_URL}#${anchor}`, label };
}

/** Sections of the framework page. Anchors checked against the published page. */
export const REF = {
  whatItIs: fw('what-this-framework-is', 'What this framework is'),
  keyTerms: fw('key-terms', 'Key terms'),
  preconditions: fw('preconditions', 'Preconditions'),
  twoStages: fw('the-two-stages', 'The two stages'),
  control: fw('control', 'The control fork'),
  whichBranch: fw('how-to-tell-which-branch-you-are-on', 'How to tell which branch you are on'),
  topology: fw('topology', 'Topology'),
  refinements: fw('refinements', 'Refinements'),
  intent: fw('intent', 'Intent'),
  groupingLever: fw('grouping-lever', 'The object size and grouping lever'),
  maturity: fw('maturity', 'Ecosystem maturity'),
  zarrVsGeozarr: fw(
    'new-zarr-standards-distinguishing-zarr-v3-and-geozarr',
    'Distinguishing Zarr v3 and GeoZarr',
  ),
  maturityWarning: fw('maturity-is-a-warning-not-a-veto', 'Maturity is a warning, not a veto'),
  encoding: fw('interpretation-encoding', 'Interpretation encoding'),
  crossCutting: fw('cross-cutting-considerations', 'Cross-cutting considerations'),
  metadata: fw('metadata-and-cataloging', 'Metadata and cataloging'),
  withinFormat: fw('within-format-depth', 'Within-format depth'),
  multiscale: fw('multiscale-and-native-mixed-resolution', 'Multiscale and native mixed resolution'),
  existingUsers: fw('existing-users', 'Existing users and their tools'),
  notYetPossible: fw('not-yet-possible', 'Not yet possible'),
  quantitative: fw('optional-make-it-quantitative', 'Optional: make it quantitative'),
  workedExamples: fw('worked-examples', 'Worked examples'),
  case1: cs(
    'per-scene-optical-raster-cog-vs-geozarr-for-visualization-and-distribution',
    'Case 1: per-scene optical raster',
  ),
  case2: cs('case-time-cube', 'Case 2: raster time-cube'),
  case3: cs('point-cloud-netcdf-to-copc', 'Case 3: point cloud'),
  case4: cs('vector-and-tabular-shapefile-to-geoparquet', 'Case 4: vector and tabular'),
  case5: cs('small-n-d-grid-the-aggregation-regime', 'Case 5: small N-D grid'),
  case6: cs('existing-archive-to-a-virtual-store', 'Case 6: existing archive to a virtual store'),
  caseSummary: cs('summary', 'Case studies summary'),
} as const satisfies Record<string, GuideRef>;
