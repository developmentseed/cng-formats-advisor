import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { selectedMeasurements } from '../framework/benchmark/criteria';
import { parseBenchmarkText, type ParsedRun } from '../framework/benchmark/parse';
import { decideControl } from '../framework/control';
import { getCase } from '../framework/data/cases';
import { REF } from '../framework/data/guide';
import type { CasePresetId } from '../framework/data/judgements';
import { rank } from '../framework/score';
import { defaultState, hashToState, presetState, stateToHash, type AppState } from '../framework/state';
import { buildSummary } from '../framework/summary';
import type { AnyFormatId } from '../framework/types';
import { track } from '../lib/plausible';
import { BenchmarkPanel, type UploadError } from './BenchmarkPanel';
import { Ref } from './common';
import { ControlStage } from './ControlStage';
import { CrossCutting, Footer, Method, Preconditions, PresetOutcome } from './Notes';
import { PresetPicker } from './PresetPicker';
import { Refinements } from './Refinements';
import { Results } from './Results';
import { TopologyStage } from './TopologyStage';

type Theme = 'auto' | 'light' | 'dark';

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('cng-advisor-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function initialState(): AppState {
  return hashToState(window.location.hash) ?? defaultState();
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

export function App() {
  const [state, setState] = useState<AppState>(initialState);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [selection, setSelection] = useState<Partial<Record<AnyFormatId, string>>>({});
  const [status, setStatus] = useState('');

  // Theme: a per-viewer convenience in localStorage.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('cng-advisor-theme', theme);
    } catch {
      /* storage blocked: the theme still applies for this visit */
    }
  }, [theme]);

  // State -> URL hash (the share link).
  const hash = stateToHash(state);
  useEffect(() => {
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [hash]);

  // URL hash -> state, when a person pastes a link in the same tab.
  useEffect(() => {
    const onHash = () => {
      const s = hashToState(window.location.hash);
      if (s) setState(s);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const control = useMemo(() => decideControl(state.answers), [state.answers]);
  const measures = useMemo(
    () => selectedMeasurements(runs, selection, state.tierPolicy.tiers),
    [runs, selection, state.tierPolicy.tiers],
  );
  const ranking = useMemo(
    () => (control.continuesToStage2 ? rank(state, measures) : null),
    [control.continuesToStage2, state, measures],
  );
  const preset = state.preset ? getCase(state.preset) : undefined;
  const modified = !!state.preset && stateToHash(presetState(state.preset)) !== hash;

  // Analytics: one "Decision Reached" per distinct decision, after the inputs settle.
  const sent = useRef(new Set<string>());
  useEffect(() => {
    if (control.kind === 'incomplete') return;
    if (control.continuesToStage2 && !ranking) return;
    const top = ranking?.candidates[0]?.format ?? 'none';
    const props = { outcome: control.kind, topology: state.topology ?? 'none', top };
    const key = JSON.stringify(props);
    if (sent.current.has(key)) return;
    const timer = window.setTimeout(() => {
      sent.current.add(key);
      track('Decision Reached', props);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [control.kind, control.continuesToStage2, ranking, state.topology]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(''), 2500);
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;

  const onShare = async () => {
    const ok = await copyText(shareUrl);
    flash(ok ? 'Share link copied.' : 'Copy failed. Copy the URL from the address bar.');
    if (ok) track('Share Link Copied');
  };

  const onSummary = async () => {
    const ok = await copyText(buildSummary(state, control, ranking, shareUrl));
    flash(ok ? 'Summary copied as Markdown.' : 'Copy failed.');
    if (ok) track('Summary Copied');
  };

  const onPreset = (id: CasePresetId) => {
    setState(presetState(id));
    track('Preset Selected', { preset: id });
  };

  const onFiles = useCallback(async (files: File[]) => {
    const json = files.filter((f) => f.name.toLowerCase().endsWith('.json') || f.type === 'application/json');
    const skipped = files.filter((f) => !json.includes(f)).map((f) => ({ fileName: f.name, error: 'Not a .json file.' }));
    const results = await Promise.all(
      json.map(async (f) => {
        try {
          return parseBenchmarkText(await f.text(), f.name);
        } catch (e) {
          return [{ ok: false as const, fileName: f.name, error: `Cannot read the file: ${(e as Error).message}` }];
        }
      }),
    );
    const flat = results.flat();
    const newRuns = flat.filter((r) => r.ok).map((r) => (r as { ok: true; run: ParsedRun }).run);
    const newErrors = [...skipped, ...flat.filter((r) => !r.ok).map((r) => r as UploadError)];
    const names = new Set(json.map((f) => f.name));
    setRuns((prev) => [...prev.filter((r) => !names.has(r.fileName)), ...newRuns]);
    setErrors(newErrors);
    if (newRuns.length) {
      track('Benchmark Loaded', {
        files: json.length,
        formats: [...new Set(newRuns.map((r) => r.formatId))].sort().join(','),
      });
    }
  }, []);

  const hasBenchmark = runs.length > 0;
  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };

  return (
    <>
      <header className="site-header">
        <div className="wrap">
          <div>
            <h1>CNG Formats Advisor</h1>
            <p>
              Go from data that you must publish to a short list of cloud-optimized formats. This dashboard applies the
              format selection decision framework of the Cloud-Optimized Geospatial Formats Guide.{' '}
              <Ref to={REF.whatItIs}>Read the framework</Ref>
            </p>
          </div>
          <div className="actions">
            <button type="button" className="btn primary" onClick={onShare}>
              Copy share link
            </button>
            <button type="button" className="btn" onClick={onSummary}>
              Copy summary
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setTheme(nextTheme[theme])}
              aria-label={`Theme: ${theme}. Select to change.`}
            >
              Theme: {theme === 'auto' ? 'system' : theme}
            </button>
            <span className="small muted status" role="status" aria-live="polite">
              {status}
            </span>
          </div>
        </div>
      </header>

      <main className="wrap layout">
        <div className="col">
          <PresetPicker
            current={state.preset}
            modified={modified}
            onPick={onPreset}
            onReset={() => setState(defaultState())}
          />
          <Preconditions />
          <ControlStage answers={state.answers} outcome={control} onChange={(answers) => setState({ ...state, answers })} />
          {control.continuesToStage2 && (
            <TopologyStage value={state.topology} onChange={(topology) => setState({ ...state, topology })} />
          )}
          {control.continuesToStage2 && state.topology && (
            <Refinements state={state} hasBenchmark={hasBenchmark} onChange={setState} />
          )}
        </div>

        <div className="col">
          {preset && <PresetOutcome preset={preset} modified={modified} />}
          {ranking && state.topology ? (
            <Results ranking={ranking} topology={state.topology} />
          ) : (
            <section className="panel">
              <h2>Result</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                {control.kind === 'incomplete'
                  ? 'Answer the Stage 1 questions to see the result.'
                  : control.kind === 'virtual'
                    ? 'No format ranking: Stage 1 ends in a virtual store. The grouping lever is not available: you inherit the source chunking.'
                    : control.kind === 'not-yet-possible'
                      ? 'No format decision is possible yet. See what is missing in Stage 1.'
                      : 'Select the shape of the data to rank the candidates.'}
              </p>
            </section>
          )}
          {control.continuesToStage2 && (
            <BenchmarkPanel
              runs={runs}
              errors={errors}
              selection={selection}
              tiers={state.tierPolicy.tiers}
              preset={preset}
              onFiles={onFiles}
              onSelect={(f, id) => setSelection({ ...selection, [f]: id })}
              onClear={() => {
                setRuns([]);
                setErrors([]);
                setSelection({});
              }}
            />
          )}
          <CrossCutting />
          <Method />
        </div>
      </main>
      <Footer />
    </>
  );
}
