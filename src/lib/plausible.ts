/**
 * Small typed wrapper around Plausible custom events.
 *
 * The script tags are in index.html only when the build has VITE_PLAUSIBLE_SRC
 * (see plausible-html.ts). Without the script, `track()` does nothing: local
 * development, tests, pull request builds and ad blockers.
 *
 * Events carry no user data and no file content. The URL that Plausible
 * records has no hash, because the hash holds the decision state.
 */

export type EventName =
  | 'Preset Selected'
  | 'Decision Reached'
  | 'Benchmark Loaded'
  | 'Share Link Copied'
  | 'Summary Copied';

export type EventProps = Record<string, string | number | boolean>;

type PlausibleFn = (event: string, options?: { props?: EventProps; u?: string }) => void;

function plausible(): PlausibleFn | undefined {
  const w = (globalThis as { window?: { plausible?: unknown } }).window;
  const fn = w?.plausible;
  return typeof fn === 'function' ? (fn as PlausibleFn) : undefined;
}

/** Send a custom event. A no-op when the Plausible script is absent. */
export function track(event: EventName, props?: EventProps): boolean {
  const fn = plausible();
  if (!fn) return false;
  try {
    fn(event, props ? { props } : undefined);
    return true;
  } catch {
    return false;
  }
}
