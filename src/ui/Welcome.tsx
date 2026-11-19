import { useRef } from 'react';
import { CASES } from '../framework/data/cases';
import type { CasePresetId } from '../framework/data/judgements';

export function Welcome({
  onStart,
  onCase,
  casesOpen = false,
}: {
  onStart: () => void;
  onCase: (id: CasePresetId) => void;
  /** Scroll to the examples on arrival (from "Other example"). */
  casesOpen?: boolean;
}) {
  const examples = useRef<HTMLElement | null>(null);
  const scrollToExamples = () => examples.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <main className="wrap welcome">
      <section className="hero-intro" aria-labelledby="welcome-h">
        <p className="eyebrow">Cloud-native geospatial</p>
        <h1 id="welcome-h">Find the right cloud-optimized format</h1>
        <p className="lead">Answer a few questions. See which formats fit, and why.</p>
      </section>

      <div className="doors">
        <button type="button" className="door primary" onClick={onStart}>
          <span className="door-title">Start with my data →</span>
          <span className="door-sub">Three steps, one question at a time.</span>
        </button>
        <button type="button" className="door" onClick={scrollToExamples}>
          <span className="door-title">Explore an example →</span>
          <span className="door-sub">Real products from the guide, with measurements.</span>
        </button>
      </div>

      <section
        ref={(el) => {
          examples.current = el;
          if (el && casesOpen) el.scrollIntoView({ block: 'start' });
        }}
        className="case-list"
        aria-label="Examples"
      >
        {CASES.filter((c) => c.id !== 'new-product').map((c) => (
          <button key={c.id} type="button" className="case-tile" onClick={() => onCase(c.id)}>
            <span className="case-title">{c.name}</span>
            <span className="case-short">{c.short}</span>
            <span className="case-tags">
              {c.tag && <span className="tag">{c.tag}</span>}
              {c.edgeCase && <span className="badge badge-edge">Edge case</span>}
            </span>
          </button>
        ))}
      </section>

    </main>
  );
}
