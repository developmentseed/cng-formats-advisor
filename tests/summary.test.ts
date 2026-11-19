import { describe, expect, it } from 'vitest';
import { decideControl } from '../src/framework/control';
import { rank } from '../src/framework/score';
import { presetState } from '../src/framework/state';
import { buildSummary } from '../src/framework/summary';

describe('copy summary', () => {
  it('gives the decision path and the ranking in Markdown', () => {
    const s = presetState('case1');
    const md = buildSummary(s, decideControl(s.answers), rank(s), 'https://example.org/#v=1');
    expect(md).toMatch(/^# Format selection summary/);
    expect(md).toMatch(/Preset: Case 1/);
    expect(md).toMatch(/Can you reprocess\? Yes/);
    expect(md).toMatch(/\| 1 \| COG \|/);
    expect(md).toMatch(/https:\/\/example.org\/#v=1/);
  });

  it('names what is missing when the outcome is "not yet possible"', () => {
    const s = presetState('case6');
    s.answers.sourceFormat = 'other';
    const md = buildSummary(s, decideControl(s.answers), null, 'x');
    expect(md).toMatch(/Not yet possible/);
    expect(md).toMatch(/Missing: No parser/);
  });
});
