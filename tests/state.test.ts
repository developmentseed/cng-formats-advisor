import { describe, expect, it } from 'vitest';
import { PRESET_INPUTS, type CasePresetId } from '../src/framework/data/judgements';
import { defaultState, hashToState, presetState, stateToHash, withTierPolicy, withTopology } from '../src/framework/state';

describe('share link state', () => {
  it('round-trips every preset through the hash', () => {
    for (const id of Object.keys(PRESET_INPUTS) as CasePresetId[]) {
      const s = presetState(id);
      expect(hashToState(stateToHash(s))).toEqual(s);
    }
  });

  it('round-trips a custom tier policy and benchmark weights', () => {
    let s = presetState('case4');
    s = withTierPolicy(s, 'custom', [{ name: 'hot, fast', minObjectBytes: 8 * 1024 * 1024 }, { name: 'archive', minObjectBytes: 512 * 1024 * 1024 }]);
    s = { ...s, benchmarkWeights: { storage: 2, read: 0, display: 3, write: 1 } };
    expect(hashToState(stateToHash(s))).toEqual(s);
  });

  it('a new shape resets the follow-up answer; a foreign answer in the hash is dropped', () => {
    const s = presetState('case2');
    expect(s.familyFocus).toBe('across');
    expect(withTopology(s, 'vector').familyFocus).toBeNull();
    expect(withTopology(s, 'nd-cube').familyFocus).toBe('across');
    expect(hashToState('#v=1&t=vt&ff=across')!.familyFocus).toBeNull();
    expect(hashToState('#v=1&t=vt&ff=joins')!.familyFocus).toBe('joins');
  });

  it('ignores an empty or foreign hash', () => {
    expect(hashToState('')).toBeNull();
    expect(hashToState('#section-2')).toBeNull();
  });

  it('falls back to defaults for bad values', () => {
    const s = hashToState('#v=1&p=nope&t=zz&w=9.-1.x&mm=7&ei=q&tp=custom&tc=bad')!;
    const d = defaultState();
    expect(s.preset).toBeNull();
    expect(s.topology).toBeNull();
    expect(s.minMaturity).toBe(d.minMaturity);
    expect(s.intentWeights).toEqual(d.intentWeights);
    expect(s.tierPolicy.tiers.length).toBeGreaterThan(0);
  });

  it('clamps weights to 0-3', () => {
    const s = hashToState('#v=1&w=9.0.1.2.3')!;
    expect(s.intentWeights.archive).toBe(3);
  });
});
