import { STEPS, STEP_SHORT, type StepId, type StepStatus } from '../framework/steps';

export function Stepper({
  current,
  statuses,
  visited,
  onGo,
  onRestart,
}: {
  current: StepId;
  statuses: Record<StepId, StepStatus>;
  /** Steps the person has opened, or that a case study filled in. */
  visited: Set<StepId>;
  onGo: (s: StepId) => void;
  onRestart: () => void;
}) {
  return (
    <nav className="stepper" aria-label="Steps">
      <div className="wrap stepper-inner">
        <ol>
          {STEPS.map((s, i) => {
            const st = statuses[s];
            const done = st.done && visited.has(s);
            const state = s === current ? 'current' : st.skipped ? 'skipped' : done ? 'done' : 'todo';
            return (
              <li key={s} className={`stp ${state}`}>
                <button
                  type="button"
                  disabled={!st.available || st.skipped}
                  aria-current={s === current ? 'step' : undefined}
                  onClick={() => onGo(s)}
                >
                  <span className="stp-num" aria-hidden="true">
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  <span className="stp-text">
                    <span className="stp-label">{STEP_SHORT[s]}</span>
                    <span className="stp-sum">{st.skipped ? 'Does not apply' : visited.has(s) || s === 'result' ? st.summary : ''}</span>
                  </span>
                  <span className="sr-only">
                    {state === 'done' ? ' (done)' : state === 'skipped' ? ' (does not apply)' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="link-btn small" onClick={onRestart}>
          Start over
        </button>
      </div>
    </nav>
  );
}
