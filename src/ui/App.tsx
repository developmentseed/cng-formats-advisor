import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeRuns, selectedMeasurements } from '../framework/benchmark/criteria';
import { parseBenchmarkText, type ParsedRun } from '../framework/benchmark/parse';
import { decideControl } from '../framework/control';
import { getCase } from '../framework/data/cases';
import { REF } from '../framework/data/guide';
import type { CasePresetId } from '../framework/data/judgements';
import { rank } from '../framework/score';
import { defaultState, hashToState, presetState, stateToHash, withTopology, type AppState } from '../framework/state';
import { firstStep, nextStep, prevStep, STEP_TITLE, stepStatuses, type StepId } from '../framework/steps';
import { buildSummary } from '../framework/summary';
import type { AnyFormatId, GuideRef } from '../framework/types';
import { track } from '../lib/plausible';
import { BenchmarkPanel, type UploadError } from './BenchmarkPanel';
import { Ref } from './common';
import { ControlStage, OutcomeBox } from './ControlStage';
import { CrossCutting, Footer, Method, Preconditions, PresetOutcome } from './Notes';
import { PathSummary } from './PathSummary';
import { MeasuredWeights, Priorities } from './Refinements';
import { Results } from './Results';
import { ShortList } from './ShortList';
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

const KICKER: Record<StepId, string> = {
  control: 'Step 1 of 4 · Stage 1 in the guide: control',
  shape: 'Step 2 of 4 · Stage 2 in the guide: topology',
  priorities: 'Step 3 of 4 · Stage 2 in the guide: refinements',
  result: 'Step 4 of 4',
};

const INTRO: Record<Exclude<StepId, 'result'>, { text: string; refs: GuideRef[] }> = {
  control: {
    text: 'The framework asks first if the choice is yours. Your answers can settle the question before format comes up.',
    refs: [REF.control, REF.whichBranch],
  },
  shape: {
    text: 'The shape of the data selects a family of formats. Your priorities then rank the members.',
    refs: [REF.topology],
  },
  priorities: {
    text: 'Tell what the data are for. The short list changes with each answer.',
    refs: [REF.refinements],
  },
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
              <button type="button" className="btn" onClick={onShare} aria-label="Copy share link">
                <span className="long">Copy share link</span>
                <span className="short" aria-hidden="true">Share</span>
              </button>
              <button type="button" className="btn" onClick={onSummary} aria-label="Copy summary">
                <span className="long">Copy summary</span>
                <span className="short" aria-hidden="true">Summary</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => setTheme(nextTheme[theme])}
            aria-label={`Theme: ${theme}. Select to change.`}
          >
            <span className="long">Theme: {theme === 'auto' ? 'system' : theme}</span>
            <span className="short" aria-hidden="true">
              {theme === 'auto' ? '◐' : theme === 'light' ? '☀' : '☾'}
            </span>
          </button>
        </div>
      </div>
      <div className="wrap">
        <span className="small muted status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
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
    control:
      control.kind === 'virtual' || control.kind === 'not-yet-possible' ? 'See the result' : 'Next: the shape of the data',
    shape: 'Next: your priorities',
    priorities: 'See my short list',
    result: '',
  };
  const blockedHint: Record<StepId, string> = {
    control: 'Answer the questions above to continue.',
    shape: 'Select a shape to continue. The follow-up question is optional.',
    priorities: '',
    result: '',
  };

  const presetBanner = preset && (
    <div className="preset-banner small">
      <span>
        {preset.inGuide ? 'Case study loaded' : 'Example loaded'}: <strong>{preset.title}</strong> ({preset.product}).{' '}
        {preset.edgeCase && <span className="badge badge-edge">Edge case</span>}
        {modified && ' You changed some inputs.'}
      </span>
      <button
        type="button"
        className="link-btn small"
        onClick={() => {
          setCasesOpen(true);
          go('welcome');
        }}
      >
        Other case study
      </button>
    </div>
  );

  const stepHead = (
    <>
      <p className="kicker">{KICKER[step]}</p>
      <h1 id="step-h" ref={heading} tabIndex={-1}>
        {STEP_TITLE[step]}
      </h1>
    </>
  );

  const nav = (
    <div className="step-nav">
      <button type="button" className="btn" onClick={() => go(prev ?? 'welcome')}>
        ‹ {prev ? 'Back' : 'Home'}
      </button>
      {step !== 'result' && (
        <span className="step-nav-next">
          {!canNext && blockedHint[step] && <span className="small muted">{blockedHint[step]}</span>}
          <button type="button" className="btn primary" disabled={!canNext} onClick={() => next && go(next)}>
            {nextLabel[step]} ›
          </button>
        </span>
      )}
    </div>
  );

  let body: ReactNode;
  if (step === 'result') {
    body = (
      <main className="wrap result-page">
        {presetBanner}
        <div className="panel result-head">
          {stepHead}
          <PathSummary state={state} control={control} onGo={go} />
        </div>
        <div className={`result-grid${preset ? ' with-aside' : ''}`}>
          <div className="col">
            {ranking && state.topology ? (
              <Results ranking={ranking} topology={state.topology} />
            ) : (
              <section className="panel">
                <h2>{control.kind === 'virtual' ? 'Publish a virtual store' : 'No format decision yet'}</h2>
                <OutcomeBox outcome={control} answers={state.answers} />
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
                weights={<MeasuredWeights state={state} hasBenchmark={runs.length > 0} onChange={setState} />}
              />
            )}
            <section aria-labelledby="further-h" className="further">
              <h2 id="further-h">Go further</h2>
              <CrossCutting />
              <Method />
            </section>
          </div>
          {preset && (
            <div className="col">
              <PresetOutcome preset={preset} modified={modified} />
            </div>
          )}
        </div>
        {nav}
      </main>
    );
  } else {
    const intro = INTRO[step];
    body = (
      <main className="wrap step-page">
        {presetBanner}
        <div className={`step-grid${ranking ? ' with-aside' : ''}`}>
          <section className="panel step-main" aria-labelledby="step-h">
            {stepHead}
            <p className="small">
              {intro.text}{' '}
              {intro.refs.map((r, i) => (
                <span key={r.url}>
                  {i > 0 && ' · '}
                  <Ref to={r} />
                </span>
              ))}
            </p>
            {step === 'control' && (
              <>
                <Preconditions />
                <ControlStage
                  answers={state.answers}
                  outcome={control}
                  onChange={(answers) => setState({ ...state, answers })}
                />
              </>
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
            {nav}
          </section>
          {ranking && <ShortList ranking={ranking} onOpen={() => statuses.result.available && go('result')} />}
        </div>
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
