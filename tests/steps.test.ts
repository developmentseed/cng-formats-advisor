import { describe, expect, it } from 'vitest';
import { decideControl } from '../src/framework/control';
import { rank } from '../src/framework/score';
import { defaultState, presetState, type AppState } from '../src/framework/state';
import { firstStep, nextStep, prevStep, stepStatuses } from '../src/framework/steps';

function st(s: AppState) {
  const c = decideControl(s.answers);
  return stepStatuses(s, c, c.continuesToStage2 ? rank(s) : null);
}

describe('steps', () => {
  it('a blank state opens on the control step; later steps are not available', () => {
    const x = st(defaultState());
    expect(firstStep(x)).toBe('control');
    expect(x.shape.available).toBe(false);
    expect(x.result.available).toBe(false);
  });

  it('a complete preset opens on the result, with a summary per step', () => {
    const x = st(presetState('case1'));
    expect(firstStep(x)).toBe('result');
    expect(x.control.summary).toBe('Free choice');
    expect(x.shape.summary).toBe('2D raster · scene by scene');
    expect(x.priorities.summary).toBe('Visualization, Distribution');
    expect(x.result.summary).toBe('COG first');
  });

  it('the default intent mix reads "All intents equal"', () => {
    const s = { ...presetState('new-product'), topology: 'vector' as const };
    expect(st(s).priorities.summary).toBe('All intents equal');
  });

  it('free choice with no shape yet opens on the shape step', () => {
    const x = st(presetState('new-product'));
    expect(firstStep(x)).toBe('shape');
    expect(x.priorities.available).toBe(false);
  });

  it('a virtual store skips Stage 2: next from control is the result', () => {
    const x = st(presetState('case6'));
    expect(x.shape.skipped).toBe(true);
    expect(x.priorities.skipped).toBe(true);
    expect(nextStep('control', x)).toBe('result');
    expect(prevStep('result', x)).toBe('control');
    expect(firstStep(x)).toBe('result');
  });

  it('next and previous follow the order when Stage 2 applies', () => {
    const x = st(presetState('case2'));
    expect(nextStep('control', x)).toBe('shape');
    expect(nextStep('priorities', x)).toBe('result');
    expect(nextStep('result', x)).toBeNull();
    expect(prevStep('control', x)).toBeNull();
  });
});
