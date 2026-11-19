import { CASES } from '../framework/data/cases';
import type { CasePresetId } from '../framework/data/judgements';

export function PresetPicker({
  current,
  modified,
  onPick,
  onReset,
}: {
  current: CasePresetId | null;
  modified: boolean;
  onPick: (id: CasePresetId) => void;
  onReset: () => void;
}) {
  return (
    <section className="panel" aria-labelledby="presets-h">
      <h2 id="presets-h">Start from a preset</h2>
      <p className="small muted">
        The six case studies of the guide set the answers and the inputs. You can change each value after.
      </p>
      <div className="presets">
        {CASES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="preset"
            aria-pressed={current === c.id}
            onClick={() => onPick(c.id)}
          >
            <span className="title">{c.title}</span>
            <span className="sub">{c.product}</span>
            {!c.inGuide && <span className="badge">Not in the guide</span>}
          </button>
        ))}
      </div>
      <div className="field-row" style={{ marginTop: 8 }}>
        <span className="small muted">
          {current && modified ? 'You changed some inputs of this preset.' : ' '}
        </span>
        <button type="button" className="btn" onClick={onReset}>
          Clear all answers
        </button>
      </div>
    </section>
  );
}
