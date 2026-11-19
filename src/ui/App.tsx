import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeRuns, selectedMeasurements } from '../framework/benchmark/criteria';
import { parseBenchmarkText, type ParsedRun } from '../framework/benchmark/parse';
import { decideControl } from '../framework/control';
import { getCase } from '../framework/data/cases';
import { focusOption } from '../framework/data/families';
import { FORMATS } from '../framework/data/formats';
import { REF } from '../framework/data/guide';
import type { CasePresetId } from '../framework/data/judgements';
import { rank } from '../framework/score';
import { defaultState, hashToState, presetState, stateToHash, withTopology, type AppState } from '../framework/state';
import { firstStep, nextStep, prevStep, STEPS, STEP_TITLE, stepStatuses, type StepId } from '../framework/steps';
import { buildSummary } from '../framework/summary';
import type { AnyFormatId, GuideRef } from '../framework/types';
import { track } from '../lib/plausible';
import { BenchmarkPanel, type UploadError } from './BenchmarkPanel';
import { Ref } from './common';
import { ControlStage, OutcomeBox } from './ControlStage';
import { CrossCutting, Footer, Method, Preconditions, PresetOutcome } from './Notes';
import { PathSummary } from './PathSummary';
import { MeasuredWeights, Priorities } from './Refinements';
import { Results, verdict } from './Results';
import { DsLogo } from './DsLogo';
import { Stepper } from './Stepper';
import { TopologyStage } from './TopologyStage';
import { Welcome } from './Welcome';

type Theme = 'auto' | 'light' | 'dark';
type View = 'welcome' | StepId;

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('cng-advisor-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function statusesFor(s: AppState) {
  const c = decideControl(s.answers);
  return stepStatuses(s, c, c.continuesToStage2 ? rank(s) : null);
}

/** A share link opens on the result (or the first open question). No hash: the welcome screen. */
function initial(): { state: AppState; view: View } {
  const s = hashToState(window.location.hash);
  if (!s) return { state: defaultState(), view: 'welcome' };
  return { state: s, view: firstStep(statusesFor(s)) };
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

const INTRO: Record<Exclude<StepId, 'result'>, { text: string; ref: GuideRef }> = {
  control: { text: 'Your answers can settle the choice before format comes up.', ref: REF.control },
  shape: { text: 'The shape picks a family of formats.', ref: REF.topology },
  priorities: { text: 'What are the data for? Most products serve several uses.', ref: REF.intent },
};

export function App() {
  const init = useMemo(initial, []);
  const [state, setState] = useState<AppState>(init.state);
  const [view, setView] = useState<View>(init.view);
  // A share link or a case study fills in every step; a fresh start fills in none.
  const [visited, setVisited] = useState<Set<StepId>>(
    () => new Set(init.view === 'welcome' ? [] : (['control', 'shape', 'priorities'] as StepId[])),
  );
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [runs, setRuns] = useState<ParsedRun[]>([]);
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [selection, setSelection] = useState<Partial<Record<AnyFormatId, string>>>({});
  const [status, setStatus] = useState('');
  const [casesOpen, setCasesOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const uploadSeq = useRef(0);
  const firstRender = useRef(true);

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

  // History. A move to another step pushes an entry, so Back and Forward work.
  // A change of an answer replaces the current entry: the URL hash is always the
  // share link of the current state. The welcome screen has no hash.
  const hash = stateToHash(state);
  const urlFor = (v: View, s: AppState) =>
    window.location.pathname + window.location.search + (v === 'welcome' ? '' : stateToHash(s));
  useEffect(() => {
    const url = urlFor(view, state);
    const current = window.location.pathname + window.location.search + window.location.hash;
    const entry = (window.history.state as { view?: View } | null)?.view;
    if (url !== current || entry !== view) window.history.replaceState({ view }, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, view]);

  // Back and Forward: our own entries change the step and keep the latest answers.
  // An entry with no step (a pasted or edited link) loads the state from the hash.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const v = (e.state as { view?: View } | null)?.view;
      if (v) {
        if (v !== 'welcome') setVisited((prev) => new Set(prev).add(v));
        setView(v);
        return;
      }
      const s = hashToState(window.location.hash);
      if (s) {
        setState(s);
        setVisited(new Set<StepId>(['control', 'shape', 'priorities']));
        setView(firstStep(statusesFor(s)));
      } else {
        setView('welcome');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // On a change of view: go to the top and move the focus to the heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, [view]);

  const control = useMemo(() => decideControl(state.answers), [state.answers]);
  const measures = useMemo(
    () => selectedMeasurements(runs, selection, state.tierPolicy.tiers),
    [runs, selection, state.tierPolicy.tiers],
  );
  const ranking = useMemo(
    () => (control.continuesToStage2 ? rank(state, measures) : null),
    [control.continuesToStage2, state, measures],
  );
  const statuses = useMemo(() => stepStatuses(state, control, ranking), [state, control, ranking]);
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

  /** Go to a view and add a browser history entry. */
  const navigate = (v: View, s: AppState = state) => {
    if (v === view && s === state) return;
    window.history.pushState({ view: v }, '', urlFor(v, s));
    setView(v);
  };

  const go = (v: View) => {
    if (v !== 'welcome') setVisited((prev) => new Set(prev).add(v));
    navigate(v);
  };

  const onCase = (id: CasePresetId) => {
    const s = presetState(id);
    setState(s);
    setVisited(new Set<StepId>(['control', 'shape', 'priorities']));
    navigate(firstStep(statusesFor(s)), s);
    track('Preset Selected', { preset: id });
  };

  const onStart = () => {
    const s = defaultState();
    setState(s);
    setVisited(new Set<StepId>(['control']));
    setCasesOpen(false);
    navigate('control', s);
  };

  const onRestart = () => {
    const s = defaultState();
    setState(s);
    setRuns([]);
    setErrors([]);
    setSelection({});
    setCasesOpen(false);
    navigate('welcome', s);
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
    uploadSeq.current += 1;
    const seq = uploadSeq.current;
    setRuns((prev) => mergeRuns(prev, newRuns, seq));
    setErrors(newErrors);
    if (newRuns.length) {
      track('Benchmark Loaded', {
        files: json.length,
        formats: [...new Set(newRuns.map((r) => r.formatId))].sort().join(','),
      });
    }
  }, []);

  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };

  const header = (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="ds-logo" href="https://developmentseed.org" aria-label="Development Seed">
          <DsLogo height={26} />
        </a>
        <span className="header-sep" aria-hidden="true" />
        {view === 'welcome' ? (
          <span className="brand">CNG Formats Advisor</span>
        ) : (
          <button type="button" className="brand" onClick={() => go('welcome')}>
            CNG Formats Advisor
          </button>
        )}
        <div className="actions">
          {view !== 'welcome' && (
            <>
              <button type="button" className="pill" onClick={onShare} aria-label="Copy share link">
                Share
              </button>
              <button type="button" className="pill" onClick={onSummary} aria-label="Copy summary">
                <span className="long">Copy summary</span>
                <span className="short" aria-hidden="true">Summary</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="pill"
            onClick={() => setTheme(nextTheme[theme])}
            aria-label={`Theme: ${theme}. Select to change.`}
            title={`Theme: ${theme === 'auto' ? 'system' : theme}`}
          >
            {theme === 'auto' ? '◐' : theme === 'light' ? '☀' : '☾'}
          </button>
        </div>
      </div>
      <span className={`toast${status ? ' on' : ''}`} role="status" aria-live="polite">
        {status}
      </span>
    </header>
  );

  if (view === 'welcome') {
    return (
      <>
        {header}
        <Welcome onStart={onStart} onCase={onCase} casesOpen={casesOpen} />
        <Footer />
      </>
    );
  }

  const step = view;
  const prev = prevStep(step, statuses);
  const next = nextStep(step, statuses);
  const canNext = next !== null && statuses[next].available;

  const nextLabel: Record<StepId, string> = {
    control: control.kind === 'virtual' || control.kind === 'not-yet-possible' ? 'See the result' : 'Next question',
    shape: 'Next question',
    priorities: 'See my short list',
    result: '',
  };
  const blockedHint: Record<StepId, string> = {
    control: '',
    shape: 'Pick a shape to continue.',
    priorities: '',
    result: '',
  };

  const presetBanner = preset && (
    <div className="preset-banner">
      <span>
        {preset.inGuide ? 'Case study' : 'Example'}: <strong>{preset.name}</strong>
        {preset.edgeCase && (
          <>
            {' '}
            <span className="badge badge-edge">Edge case</span>
          </>
        )}
        {modified && <span className="muted"> · you changed some answers</span>}
      </span>
      <button
        type="button"
        className="link-btn small"
        onClick={() => {
          setCasesOpen(true);
          go('welcome');
        }}
      >
        Other example
      </button>
    </div>
  );

  const nav = (
    <div className="step-nav">
      <button type="button" className="btn ghost" onClick={() => go(prev ?? 'welcome')}>
        ← {prev ? 'Back' : 'Home'}
      </button>
      {step !== 'result' && (
        <span className="step-nav-next">
          {!canNext && blockedHint[step] && <span className="small muted">{blockedHint[step]}</span>}
          <button type="button" className="btn primary" disabled={!canNext} onClick={() => next && go(next)}>
            {nextLabel[step]}
          </button>
        </span>
      )}
    </div>
  );

  const openMeasurements = () => {
    const el = document.getElementById('measurements') as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  let body: ReactNode;
  if (step === 'result') {
    const focus = focusOption(state.topology, state.familyFocus);
    body = (
      <main className="wrap result-page">
        <header className="result-intro">
          <p className="eyebrow">
            Your short list
            {preset && (
              <>
                {' · '}
                {preset.name}
                {preset.edgeCase && (
                  <>
                    {' '}
                    <span className="badge badge-edge">Edge case</span>
                  </>
                )}
                {' · '}
                <button
                  type="button"
                  className="link-btn eyebrow-link"
                  onClick={() => {
                    setCasesOpen(true);
                    go('welcome');
                  }}
                >
                  other example
                </button>
              </>
            )}
          </p>
          <h1 id="step-h" ref={heading} tabIndex={-1}>
            {ranking ? verdict(ranking) : control.kind === 'virtual' ? 'Publish a virtual store' : 'No format decision yet'}
          </h1>
          <PathSummary state={state} control={control} onGo={go} />
        </header>

        {ranking && state.topology ? (
          <Results ranking={ranking} topology={state.topology} focusChip={focus?.short} />
        ) : (
          <section className="plain-card">
            <OutcomeBox outcome={control} answers={state.answers} />
          </section>
        )}

        <div className="strip">
          {control.continuesToStage2 && (
            <button type="button" className="strip-card" onClick={openMeasurements}>
              <b>{ranking?.close ? 'Close call? Measure them' : 'Measure your own data'}</b>
              <span>Run cng-formats-benchmark, then upload the results here.</span>
            </button>
          )}
          {preset && <PresetOutcome preset={preset} modified={modified} />}
          {state.answers.existingUsers && control.kind !== 'incomplete' && (
            <div className="strip-card">
              <b>Your users have their own tools</b>
              <span>Publish the new format alongside what they read today, and announce the change.</span>
            </div>
          )}
          <a className="strip-card" href={REF.whatItIs.url} target="_blank" rel="noopener noreferrer">
            <b>Read the guide ↗</b>
            <span>Every rule here comes from the decision framework.</span>
          </a>
        </div>

        {control.continuesToStage2 && (
          <details className="section" id="measurements">
            <summary>Measurements</summary>
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
              weights={<MeasuredWeights state={state} hasBenchmark={runs.length > 0} onChange={setState} />}
            />
          </details>
        )}
        <details className="section">
          <summary>Go further: how the score works, and more</summary>
          <CrossCutting />
          <Method />
        </details>
        {nav}
      </main>
    );
  } else {
    const intro = INTRO[step];
    const index = STEPS.indexOf(step) + 1;
    body = (
      <main className="wrap step-page">
        {presetBanner}
        <section className="step-main" aria-labelledby="step-h">
          <p className="eyebrow">Question {index} of 3</p>
          <h1 id="step-h" ref={heading} tabIndex={-1}>
            {STEP_TITLE[step]}
          </h1>
          <p className="step-sub">
            {intro.text} <Ref to={intro.ref}>Why</Ref>
          </p>
          {step === 'control' && (
            <ControlStage
              answers={state.answers}
              outcome={control}
              onChange={(answers) => setState((s) => ({ ...s, answers }))}
            />
          )}
          {step === 'shape' && (
            <TopologyStage
              value={state.topology}
              focus={state.familyFocus}
              onChange={(topology) => setState((s) => withTopology(s, topology))}
              onFocus={(familyFocus) => setState((s) => ({ ...s, familyFocus }))}
            />
          )}
          {step === 'priorities' && <Priorities state={state} onChange={setState} />}
          {ranking && step !== 'control' && (
            <p className="so-far">
              Short list so far:{' '}
              {ranking.candidates.map((c, i) => (
                <span key={c.format}>
                  {i > 0 && ' · '}
                  {i === 0 ? <b>{FORMATS[c.format].name}</b> : FORMATS[c.format].name}
                </span>
              ))}
            </p>
          )}
          {nav}
          {step === 'control' && <Preconditions />}
        </section>
      </main>
    );
  }

  return (
    <>
      {header}
      <Stepper current={step} statuses={statuses} visited={visited} onGo={go} onRestart={onRestart} />
      {body}
      <Footer />
    </>
  );
}
