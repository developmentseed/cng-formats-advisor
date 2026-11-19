import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(casesOpen);
  // Arrival from "Other example": the examples are open; bring them into view once.
  useEffect(() => {
    if (casesOpen) examples.current?.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Show or hide the examples. When they open, bring them into view. */
  const toggleExamples = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      requestAnimationFrame(() => {
        examples.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

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
        <button type="button" className="door" onClick={toggleExamples} aria-controls="examples" aria-expanded={open}>
          <span className="door-title">Explore an example {open ? '↑' : '↓'}</span>
          <span className="door-sub">Real products from the guide, with measurements.</span>
        </button>
      </div>

      {open && (
        <section
          ref={examples}
          id="examples"
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
      )}
    </main>
  );
}
