import { useState } from 'react';
import { CASES } from '../framework/data/cases';
import { FRAMEWORK_URL, GUIDE_BASE } from '../framework/data/guide';
import type { CasePresetId } from '../framework/data/judgements';
import { STEPS, STEP_TITLE } from '../framework/steps';

const STEP_HINT: Record<(typeof STEPS)[number], string> = {
  control: 'Existing data, reprocessing, mandates. This can settle the answer early.',
  shape: 'Raster, cube, point cloud or vector. The shape selects a family of formats.',
  priorities: 'Archive, processing, visualization, distribution, fusion.',
  result: 'Ranked formats, with the reason for each score and links to the guide.',
};

export function Welcome({
  onStart,
  onCase,
  casesOpen = false,
}: {
  onStart: () => void;
  onCase: (id: CasePresetId) => void;
  casesOpen?: boolean;
}) {
  const [showCases, setShowCases] = useState(casesOpen);
  return (
    <main className="wrap welcome">
      <section className="hero" aria-labelledby="welcome-h">
        <h1 id="welcome-h">Find the cloud-optimized format for your geospatial data</h1>
        <p className="lead">
          Answer a few questions. Get a short list of formats, ranked, with the reason for each rank. You make the final
          call.
        </p>
      </section>

      <ol className="step-map" aria-label="The four steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <strong>{STEP_TITLE[s]}</strong>
              <span className="small muted">{STEP_HINT[s]}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="doors">
        <button type="button" className="door primary" onClick={onStart}>
          <span className="door-title">Start with my product →</span>
          <span className="door-sub">Four short steps. You can go back to any step.</span>
        </button>
        <button
          type="button"
          className="door"
          aria-expanded={showCases}
          aria-controls="case-list"
          onClick={() => setShowCases(!showCases)}
        >
          <span className="door-title">Explore a case study {showCases ? '↓' : '→'}</span>
          <span className="door-sub">Sentinel-1, Sentinel-2 and SWOT products from the guide, with measurements.</span>
        </button>
      </div>

      {showCases && (
        <section id="case-list" className="case-list" aria-label="Case studies">
          {CASES.filter((c) => c.id !== 'new-product').map((c) => (
            <button key={c.id} type="button" className="preset" onClick={() => onCase(c.id)}>
              <span className="title">{c.title}</span>
              <span className="sub">{c.product}</span>
              <span className="sub">
                <strong>Lands on:</strong> {c.inGuide ? c.outcome.split('.')[0] : 'no published outcome'}
              </span>
              {!c.inGuide && <span className="badge">Not in the guide</span>}
            </button>
          ))}
        </section>
      )}

      <p className="small muted welcome-foot">
        Based on the{' '}
        <a href={FRAMEWORK_URL} target="_blank" rel="noopener noreferrer">
          format selection decision framework ↗
        </a>{' '}
        of the{' '}
        <a href={GUIDE_BASE} target="_blank" rel="noopener noreferrer">
          Cloud-Optimized Geospatial Formats Guide ↗
        </a>
        . Not a compliance checklist: no format is removed by one answer.
      </p>
    </main>
  );
}
