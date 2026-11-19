import { describe, expect, it } from 'vitest';
import { decideControl, visibleQuestions } from '../src/framework/control';
import { BLANK_ANSWERS } from '../src/framework/data/cases';
import type { ControlAnswers } from '../src/framework/types';

const a = (over: Partial<ControlAnswers>): ControlAnswers => ({ ...BLANK_ANSWERS, ...over });

describe('Stage 1: control', () => {
  it('asks "existing data?" first', () => {
    const o = decideControl(a({}));
    expect(o.kind).toBe('incomplete');
    expect(o.nextQuestion).toBe('existingData');
    expect(o.continuesToStage2).toBe(false);
  });

  it('no existing data: asks about a mandate', () => {
    expect(decideControl(a({ existingData: false })).nextQuestion).toBe('mandate');
  });

  it('no existing data, no mandate: free choice', () => {
    const o = decideControl(a({ existingData: false, mandate: false }));
    expect(o.kind).toBe('free');
    expect(o.continuesToStage2).toBe(true);
  });

  it('no existing data, mandate: optimize the archive and rank formats for the copy', () => {
    const o = decideControl(a({ existingData: false, mandate: true }));
    expect(o.kind).toBe('mandate');
    expect(o.continuesToStage2).toBe(true);
    expect(o.notes.join(' ')).toMatch(/cloud-optimized copy/);
  });

  it('existing data, can reprocess: free choice', () => {
    const o = decideControl(a({ existingData: true, canReprocess: true }));
    expect(o.kind).toBe('free');
    expect(o.continuesToStage2).toBe(true);
  });

  it('existing data, cannot reprocess: asks about repackaging', () => {
    expect(decideControl(a({ existingData: true, canReprocess: false })).nextQuestion).toBe('canRepackage');
  });

  it('can repackage: format free, content fixed, Stage 2 continues', () => {
    const o = decideControl(a({ existingData: true, canReprocess: false, canRepackage: true }));
    expect(o.kind).toBe('repackage');
    expect(o.continuesToStage2).toBe(true);
    expect(o.notes.join(' ')).toMatch(/content is fixed/);
  });

  it('cannot repackage: asks the three virtualization tests in order', () => {
    const base = { existingData: true, canReprocess: false, canRepackage: false } as const;
    expect(decideControl(a(base)).nextQuestion).toBe('chunkedInternally');
    expect(decideControl(a({ ...base, chunkedInternally: true })).nextQuestion).toBe('workableChunkSize');
    expect(decideControl(a({ ...base, chunkedInternally: true, workableChunkSize: true })).nextQuestion).toBe('sourceFormat');
  });

  it('all three tests pass: Virtual Zarr, no Stage 2', () => {
    for (const sf of ['netcdf4', 'hdf5', 'grib2', 'tiff', 'fits'] as const) {
      const o = decideControl(
        a({ existingData: true, canReprocess: false, canRepackage: false, chunkedInternally: true, workableChunkSize: true, sourceFormat: sf }),
      );
      expect(o.kind).toBe('virtual');
      expect(o.continuesToStage2).toBe(false);
    }
  });

  it('a failed test: not yet possible, and names what is missing', () => {
    const o = decideControl(
      a({ existingData: true, canReprocess: false, canRepackage: false, chunkedInternally: false, workableChunkSize: true, sourceFormat: 'other' }),
    );
    expect(o.kind).toBe('not-yet-possible');
    expect(o.missing).toEqual(['chunked', 'parser']);
    expect(o.continuesToStage2).toBe(false);
  });

  it('one failed test is enough, even with open questions', () => {
    const o = decideControl(a({ existingData: true, canReprocess: false, canRepackage: false, chunkedInternally: false }));
    expect(o.kind).toBe('not-yet-possible');
    expect(o.missing).toEqual(['chunked']);
  });

  it('existing users: advisory note only, the outcome does not change', () => {
    const without = decideControl(a({ existingData: true, canReprocess: true }));
    const withUsers = decideControl(a({ existingData: true, canReprocess: true, existingUsers: true }));
    expect(withUsers.kind).toBe(without.kind);
    expect(withUsers.notes.length).toBe(without.notes.length + 1);
    expect(withUsers.notes.at(-1)).toMatch(/alongside/);
  });

  it('shows only the questions on the current path', () => {
    expect(visibleQuestions(a({}))).toEqual(['existingData', 'existingUsers']);
    expect(visibleQuestions(a({ existingData: false }))).toEqual(['existingData', 'mandate', 'existingUsers']);
    expect(visibleQuestions(a({ existingData: true, canReprocess: false, canRepackage: false }))).toEqual([
      'existingData', 'canReprocess', 'canRepackage', 'chunkedInternally', 'workableChunkSize', 'sourceFormat', 'existingUsers',
    ]);
  });
});
