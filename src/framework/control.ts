/**
 * Stage 1, control: do you have a choice?
 * The order of the questions is the order of the guide flowchart.
 */
import { REF } from './data/guide';
import type { ControlAnswers, ControlOutcome, ParserFormat, VirtualTest } from './types';

/** Formats that VirtualiZarr and Kerchunk can parse, from the guide. */
export const PARSER_FORMATS: ParserFormat[] = ['netcdf4', 'hdf5', 'grib2', 'tiff', 'fits'];

export const PARSER_LABEL: Record<ParserFormat, string> = {
  netcdf4: 'netCDF4',
  hdf5: 'HDF5',
  grib2: 'GRIB2',
  tiff: 'TIFF',
  fits: 'FITS',
  other: 'Other (for example HDF4, encrypted files, a format with no parser)',
};

export const VIRTUAL_TEST_TEXT: Record<VirtualTest, { question: string; missing: string }> = {
  chunked: {
    question: 'Is the data chunked internally?',
    missing:
      'The source has no internal chunking. A single contiguous block virtualizes into one enormous chunk and buys you no useful partial access.',
  },
  'chunk-size': {
    question: 'Are those chunks a workable size?',
    missing:
      "The source chunks are not a workable size. You inherit the source's chunk size and shape, so its chunking limits which access patterns stay cheap.",
  },
  parser: {
    question: 'Is there a parser for the format?',
    missing:
      'No parser covers the source format. VirtualiZarr and Kerchunk cover netCDF4, HDF5, GRIB2, TIFF and FITS.',
  },
};

const EXISTING_USERS_NOTE =
  'Existing users and tools: publish the cloud-optimized format alongside what your users already consume, and announce a migration with a deprecation window and documentation.';

function outcome(partial: Omit<ControlOutcome, 'missing' | 'notes'> & Partial<ControlOutcome>): ControlOutcome {
  return { missing: [], notes: [], ...partial };
}

function withUsers(o: ControlOutcome, answers: ControlAnswers): ControlOutcome {
  if (answers.existingUsers === true) {
    return { ...o, notes: [...o.notes, EXISTING_USERS_NOTE] };
  }
  return o;
}

export function decideControl(a: ControlAnswers): ControlOutcome {
  return withUsers(decide(a), a);
}

function decide(a: ControlAnswers): ControlOutcome {
  if (a.existingData === null) {
    return outcome({ kind: 'incomplete', continuesToStage2: false, nextQuestion: 'existingData', ref: REF.control });
  }

  if (a.existingData === false) {
    if (a.mandate === null) {
      return outcome({ kind: 'incomplete', continuesToStage2: false, nextQuestion: 'mandate', ref: REF.control });
    }
    if (a.mandate) {
      return outcome({
        kind: 'mandate',
        continuesToStage2: true,
        ref: REF.control,
        notes: [
          'Optimize the mandated format: make it as range-request-friendly as it can be. For HDF5 or netCDF, see the guide on consolidated metadata and chunk sizing.',
          'Publish a cloud-optimized copy for readers (recommended). Stage 2 ranks the formats for this copy.',
          "A virtual Zarr layer over the archive is cheaper to maintain, but you inherit the archive's chunk shape.",
        ],
      });
    }
    return outcome({
      kind: 'free',
      continuesToStage2: true,
      ref: REF.control,
      notes: ['No existing data: you are designing a new product, so you can choose freely.'],
    });
  }

  if (a.canReprocess === null) {
    return outcome({ kind: 'incomplete', continuesToStage2: false, nextQuestion: 'canReprocess', ref: REF.control });
  }
  if (a.canReprocess) {
    return outcome({
      kind: 'free',
      continuesToStage2: true,
      ref: REF.control,
      notes: ['You control the production chain, so format and layout are both free choices.'],
    });
  }

  if (a.canRepackage === null) {
    return outcome({ kind: 'incomplete', continuesToStage2: false, nextQuestion: 'canRepackage', ref: REF.control });
  }
  if (a.canRepackage) {
    return outcome({
      kind: 'repackage',
      continuesToStage2: true,
      ref: REF.whichBranch,
      notes: [
        'Format is a free choice; the content is fixed at whatever was delivered.',
        'Layout shape is limited: only reprocessing lets you choose the chunk shape freely.',
      ],
    });
  }

  // Virtualization: three tests, in order.
  const tests: [VirtualTest, boolean | null][] = [
    ['chunked', a.chunkedInternally],
    ['chunk-size', a.workableChunkSize],
    ['parser', a.sourceFormat === null ? null : PARSER_FORMATS.includes(a.sourceFormat)],
  ];
  const failed = tests.filter(([, v]) => v === false).map(([t]) => t);
  if (failed.length > 0) {
    return outcome({
      kind: 'not-yet-possible',
      continuesToStage2: false,
      missing: failed,
      ref: REF.notYetPossible,
      notes: [
        'Not yet possible does not mean never possible. The blocker is usually a missing parser, an unsupported codec, or source files with no internal chunking. Every one of those can change.',
        'Re-evaluate reprocessing, conversion and virtualization to find what must change.',
      ],
    });
  }
  const firstOpen = tests.find(([, v]) => v === null);
  if (firstOpen) {
    const q: Record<VirtualTest, keyof ControlAnswers> = {
      chunked: 'chunkedInternally',
      'chunk-size': 'workableChunkSize',
      parser: 'sourceFormat',
    };
    return outcome({ kind: 'incomplete', continuesToStage2: false, nextQuestion: q[firstOpen[0]], ref: REF.whichBranch });
  }
  return outcome({
    kind: 'virtual',
    continuesToStage2: false,
    ref: REF.control,
    notes: [
      'Publish a virtual Zarr store with VirtualiZarr or Kerchunk. Store the index in Icechunk, kerchunk JSON or kerchunk Parquet.',
      "Limits: chunk sizes are whatever the source chose, you cannot add overviews, and you inherit the source's codec.",
      'It is more limited than a native store, but it is much better than whole-file download.',
    ],
  });
}

/** The questions that apply to the current answers, in flowchart order. */
export function visibleQuestions(a: ControlAnswers): (keyof ControlAnswers)[] {
  const qs: (keyof ControlAnswers)[] = ['existingData'];
  if (a.existingData === false) qs.push('mandate');
  if (a.existingData === true) {
    qs.push('canReprocess');
    if (a.canReprocess === false) {
      qs.push('canRepackage');
      if (a.canRepackage === false) qs.push('chunkedInternally', 'workableChunkSize', 'sourceFormat');
    }
  }
  qs.push('existingUsers');
  return qs;
}
