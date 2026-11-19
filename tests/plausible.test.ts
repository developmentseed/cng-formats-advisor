import { afterEach, describe, expect, it, vi } from 'vitest';
import { plausibleTags } from '../plausible-html';
import { track } from '../src/lib/plausible';

const g = globalThis as { window?: unknown };

afterEach(() => {
  delete g.window;
});

describe('Plausible', () => {
  it('track() is a no-op when window.plausible is absent', () => {
    expect(track('Share Link Copied')).toBe(false);
    g.window = {};
    expect(track('Share Link Copied')).toBe(false);
  });

  it('track() sends the event and its props when the script is loaded', () => {
    const fn = vi.fn();
    g.window = { plausible: fn };
    expect(track('Preset Selected', { preset: 'case1' })).toBe(true);
    expect(fn).toHaveBeenCalledWith('Preset Selected', { props: { preset: 'case1' } });
  });

  it('no script tags without VITE_PLAUSIBLE_SRC', () => {
    expect(plausibleTags(undefined)).toEqual([]);
    expect(plausibleTags('  ')).toEqual([]);
  });

  it('script tags with a script URL, and the hash is removed from the page URL', () => {
    const tags = plausibleTags('https://plausible.io/js/pa-TEST.js');
    expect(tags).toHaveLength(2);
    expect(tags[0]!.attrs).toEqual({ async: true, src: 'https://plausible.io/js/pa-TEST.js' });
    expect(String(tags[1]!.children)).toMatch(/split\("#"\)\[0\]/);
  });

  it('rejects a script URL that is not https', () => {
    expect(() => plausibleTags('http://example.com/x.js')).toThrow();
    expect(() => plausibleTags('https://x.io/a.js"><script>')).toThrow();
  });
});
