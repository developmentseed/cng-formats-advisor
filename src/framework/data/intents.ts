/**
 * The five intents and the intent notes, transcribed from the guide.
 * The intent-fit matrix is our encoding of the guide text: see judgements.ts.
 */
import type { Intent, ProcessingMode } from '../types';

export const INTENTS: Intent[] = ['archive', 'processing', 'visualization', 'distribution', 'fusion'];

export const INTENT_LABEL: Record<Intent, string> = {
  archive: 'Archive and download',
  processing: 'Processing',
  visualization: 'Visualization',
  distribution: 'Distribution',
  fusion: 'Data fusion',
};

/** The three points of the intent section of the guide. */
export const INTENT_NOTES: Partial<Record<Intent, string>> = {
  visualization:
    'Visualization is a first-class intent, not a side effect. It has its own layout needs, mainly overviews or a level of detail.',
  processing:
    'On-the-fly and batched processing pull the layout in opposite directions.',
  fusion:
    'Data fusion raises the stakes on encoding. It weights interpretation encoding and consistent grids far higher than single-product analysis does, and it usually rewards a tabular or columnar target where joins are cheap.',
};

/** Layout advice per processing mode. Text only: no effect on the score. */
export const PROCESSING_LAYOUT_ADVICE: Record<ProcessingMode, string> = {
  'on-the-fly':
    'On-the-fly access rewards small chunks, fine overviews, and cache locality: a reader fetches a little and wants it back fast.',
  batched:
    'Batched processing rewards large shards or row groups, so that a bulk scan becomes a few large contiguous reads that many workers can run in parallel, instead of thousands of small scattered ones.',
};
